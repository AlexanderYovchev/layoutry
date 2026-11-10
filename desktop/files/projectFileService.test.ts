// @vitest-environment node
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileCapabilityRegistry } from "./fileCapabilities";
import {
  InvalidPayloadError,
  MAX_PROJECT_TEXT_LENGTH,
  createProjectFileService,
  safeSuggestedFileName,
} from "./projectFileService";

const PROJECT = (v: string) =>
  `{"format":"layoutry-project","formatVersion":1,"v":"${v}"}\n`;
const OWNER = 7;

let dir: string;
let openAnswer: string | null;
let saveAnswer: string | null;
let lastSaveDefault: string | null;

function setup() {
  const registry = new FileCapabilityRegistry();
  const service = createProjectFileService({
    registry,
    defaultFolder: () => dir,
    showOpenDialog: async () => openAnswer,
    showSaveDialog: async (defaultPath) => {
      lastSaveDefault = defaultPath;
      return saveAnswer;
    },
    writeHooks: { sleep: () => Promise.resolve() },
  });
  return { registry, service };
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "layoutry-service-"));
  openAnswer = null;
  saveAnswer = null;
  lastSaveDefault = null;
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

async function chooseAndWrite(
  service: ReturnType<typeof setup>["service"],
  fileName: string,
  text: string,
) {
  saveAnswer = path.join(dir, fileName);
  const choice = await service.chooseSaveLocation(OWNER, {
    suggestedName: fileName,
  });
  if (choice.status !== "chosen") throw new Error(JSON.stringify(choice));
  const written = await service.write(OWNER, {
    token: choice.target.token,
    text,
    force: false,
    upgradeFormat: false,
  });
  return { token: choice.target.token, written };
}

describe("open", () => {
  it("returns a token, the file name and the text — never the path", async () => {
    const { service } = setup();
    openAnswer = path.join(dir, "Site.layoutry");
    await fs.writeFile(openAnswer, PROJECT("a"));
    const result = await service.open(OWNER);
    expect(result).toMatchObject({
      status: "opened",
      file: { fileName: "Site.layoutry", text: PROJECT("a") },
    });
    expect(JSON.stringify(result)).not.toContain(dir.replace(/\\/g, "\\\\"));
  });

  it("respects a cancelled dialog", async () => {
    const { service } = setup();
    expect(await service.open(OWNER)).toEqual({ status: "cancelled" });
  });

  it("refuses a file that isn't .layoutry, even if typed into the dialog", async () => {
    const { service } = setup();
    openAnswer = path.join(dir, "notes.txt");
    await fs.writeFile(openAnswer, "hello");
    expect(await service.open(OWNER)).toMatchObject({
      status: "error",
      error: { code: "invalid-path" },
    });
  });
});

describe("save locations", () => {
  it("suggests a safe file name in the last folder, and adds a missing extension", async () => {
    const { service } = setup();
    saveAnswer = path.join(dir, "Shop");
    const result = await service.chooseSaveLocation(OWNER, {
      suggestedName: "Shop.layoutry",
    });
    expect(lastSaveDefault).toBe(path.join(dir, "Shop.layoutry"));
    expect(result).toMatchObject({
      status: "chosen",
      target: { fileName: "Shop.layoutry" },
    });
  });

  it("refuses to add an extension onto an existing file the dialog didn't confirm", async () => {
    const { service } = setup();
    await fs.writeFile(path.join(dir, "Shop.layoutry"), PROJECT("other"));
    saveAnswer = path.join(dir, "Shop");
    expect(
      await service.chooseSaveLocation(OWNER, { suggestedName: "Shop" }),
    ).toMatchObject({
      status: "error",
      error: { code: "invalid-path" },
    });
    expect(await fs.readFile(path.join(dir, "Shop.layoutry"), "utf8")).toBe(
      PROJECT("other"),
    );
  });

  it.each([
    ["..\\..\\Windows\\System32\\evil.layoutry", "evil.layoutry"],
    ["C:\\Users\\Public\\x.layoutry", "x.layoutry"],
    ["/etc/passwd", "passwd.layoutry"],
    ['a<b>:"|?*.layoutry', "a-b------.layoutry"],
    ["...", "Untitled Project.layoutry"],
  ])(
    "keeps only a file name from the renderer's suggestion %j",
    (input, expected) => {
      expect(safeSuggestedFileName(input)).toBe(expected);
    },
  );
});

describe("write", () => {
  it("writes, then rewrites the same file without a dialog", async () => {
    const { service } = setup();
    const { token, written } = await chooseAndWrite(
      service,
      "Site.layoutry",
      PROJECT("1"),
    );
    expect(written).toEqual({ status: "saved", fileName: "Site.layoutry" });
    expect(
      await service.write(OWNER, {
        token,
        text: PROJECT("2"),
        force: false,
        upgradeFormat: false,
      }),
    ).toEqual({
      status: "saved",
      fileName: "Site.layoutry",
    });
    expect(await fs.readFile(path.join(dir, "Site.layoutry"), "utf8")).toBe(
      PROJECT("2"),
    );
  });

  it("reports external modification and deletion as conflicts, and overwrites only when forced", async () => {
    const { service } = setup();
    const target = path.join(dir, "Site.layoutry");
    const { token } = await chooseAndWrite(
      service,
      "Site.layoutry",
      PROJECT("1"),
    );

    await fs.writeFile(target, PROJECT("external"));
    expect(
      await service.write(OWNER, {
        token,
        text: PROJECT("2"),
        force: false,
        upgradeFormat: false,
      }),
    ).toEqual({
      status: "conflict",
      reason: "modified",
      fileName: "Site.layoutry",
    });
    expect(await fs.readFile(target, "utf8")).toBe(PROJECT("external"));

    expect(
      await service.write(OWNER, {
        token,
        text: PROJECT("2"),
        force: true,
        upgradeFormat: false,
      }),
    ).toMatchObject({ status: "saved" });

    await fs.rm(target);
    expect(
      await service.write(OWNER, {
        token,
        text: PROJECT("3"),
        force: false,
        upgradeFormat: false,
      }),
    ).toMatchObject({
      status: "conflict",
      reason: "missing",
    });
  });

  it("refuses unknown, released and other windows' tokens", async () => {
    const { service } = setup();
    const { token } = await chooseAndWrite(
      service,
      "Site.layoutry",
      PROJECT("1"),
    );
    expect(
      await service.write(8, {
        token,
        text: PROJECT("x"),
        force: true,
        upgradeFormat: false,
      }),
    ).toMatchObject({
      status: "error",
      error: { code: "invalid-token" },
    });
    service.release(OWNER, { token });
    expect(
      await service.write(OWNER, {
        token,
        text: PROJECT("x"),
        force: true,
        upgradeFormat: false,
      }),
    ).toMatchObject({
      error: { code: "invalid-token" },
    });
  });

  it.each([
    ["not an object", "nope"],
    [
      "an extra key",
      {
        token: "a".repeat(32),
        text: PROJECT("x"),
        force: false,
        upgradeFormat: false,
        path: "C:\\x.layoutry",
      },
    ],
    [
      "a path instead of a token",
      {
        token: "C:\\Windows\\win.ini",
        text: PROJECT("x"),
        force: false,
        upgradeFormat: false,
      },
    ],
    [
      "non-boolean force",
      { token: "a".repeat(32), text: PROJECT("x"), force: "yes" },
    ],
    [
      "text that isn't JSON",
      {
        token: "a".repeat(32),
        text: "MZ\u0090binary",
        force: false,
        upgradeFormat: false,
      },
    ],
    [
      "JSON that isn't a project",
      { token: "a".repeat(32), text: '{"evil":true}', force: false },
    ],
    [
      "oversized text",
      {
        token: "a".repeat(32),
        text: "x".repeat(MAX_PROJECT_TEXT_LENGTH + 1),
        force: false,
        upgradeFormat: false,
      },
    ],
  ])("rejects a malformed write payload: %s", async (_label, payload) => {
    const { service } = setup();
    await expect(service.write(OWNER, payload)).rejects.toBeInstanceOf(
      InvalidPayloadError,
    );
  });

  it("rejects malformed release and save-location payloads", async () => {
    const { service } = setup();
    expect(() => service.release(OWNER, { token: 5 })).toThrow(
      InvalidPayloadError,
    );
    await expect(
      service.chooseSaveLocation(OWNER, { suggestedName: "a", folder: "C:\\" }),
    ).rejects.toBeInstanceOf(InvalidPayloadError);
    await expect(
      service.chooseSaveLocation(OWNER, { suggestedName: "x".repeat(300) }),
    ).rejects.toBeInstanceOf(InvalidPayloadError);
  });
});

describe("external opens (command line, Explorer, second launch)", () => {
  it("queues files, without duplicates, and hands them out in order", async () => {
    const { service } = setup();
    const a = path.join(dir, "a.layoutry");
    const b = path.join(dir, "b.layoutry");
    await fs.writeFile(a, PROJECT("a"));
    await fs.writeFile(b, PROJECT("b"));
    expect(service.queueExternalOpen(a)).toBe(true);
    expect(service.queueExternalOpen(a)).toBe(false);
    service.queueExternalOpen(b);
    expect(await service.takePending(OWNER)).toMatchObject({
      status: "opened",
      file: { fileName: "a.layoutry" },
    });
    expect(await service.takePending(OWNER)).toMatchObject({
      status: "opened",
      file: { fileName: "b.layoutry" },
    });
    expect(await service.takePending(OWNER)).toEqual({ status: "none" });
  });

  it("reports a queued file that no longer exists", async () => {
    const { service } = setup();
    service.queueExternalOpen(path.join(dir, "gone.layoutry"));
    expect(await service.takePending(OWNER)).toMatchObject({
      status: "error",
      error: { code: "not-found" },
    });
  });

  it("caps the queue", () => {
    const { service } = setup();
    const accepted = Array.from({ length: 12 }, (_, i) =>
      service.queueExternalOpen(path.join(dir, `${i}.layoutry`)),
    );
    expect(accepted.filter(Boolean)).toHaveLength(8);
  });
});

describe("older project formats (BC-05.4)", () => {
  const V1 = (v: string) =>
    `{"format":"layoutry-project","formatVersion":1,"v":"${v}"}\n`;
  const V2 = (v: string) =>
    `{"format":"layoutry-project","formatVersion":2,"v":"${v}"}\n`;

  async function openV1(service: ReturnType<typeof setup>["service"]) {
    openAnswer = path.join(dir, "Legacy.layoutry");
    await fs.writeFile(openAnswer, V1("original"));
    const opened = await service.open(OWNER);
    if (opened.status !== "opened") throw new Error(JSON.stringify(opened));
    return { token: opened.file.token, target: openAnswer };
  }

  const write = (
    service: ReturnType<typeof setup>["service"],
    token: string,
    text: string,
    flags: { force?: boolean; upgradeFormat?: boolean } = {},
  ) =>
    service.write(OWNER, {
      token,
      text,
      force: flags.force ?? false,
      upgradeFormat: flags.upgradeFormat ?? false,
    });

  it("refuses to upgrade a file opened in format 1 without consent, and writes nothing", async () => {
    const { service } = setup();
    const { token, target } = await openV1(service);
    const before = await fs.readFile(target);
    expect(await write(service, token, V2("new"))).toEqual({
      status: "older-format",
      fileName: "Legacy.layoutry",
      formatVersion: 1,
    });
    expect((await fs.readFile(target)).equals(before)).toBe(true);
    expect((await fs.readdir(dir)).sort()).toEqual(["Legacy.layoutry"]);
  });

  it("upgrades on explicit consent, then never asks again", async () => {
    const { service } = setup();
    const { token, target } = await openV1(service);
    expect(
      await write(service, token, V2("new"), { upgradeFormat: true }),
    ).toEqual({ status: "saved", fileName: "Legacy.layoutry" });
    expect(await fs.readFile(target, "utf8")).toBe(V2("new"));
    expect(await write(service, token, V2("again"))).toEqual({
      status: "saved",
      fileName: "Legacy.layoutry",
    });
  });

  it("a same-format write of a format 1 file needs no consent", async () => {
    const { service } = setup();
    const { token } = await openV1(service);
    expect(await write(service, token, V1("still 1"))).toMatchObject({
      status: "saved",
    });
  });

  it("a format 2 file saves straight back", async () => {
    const { service } = setup();
    openAnswer = path.join(dir, "Current.layoutry");
    await fs.writeFile(openAnswer, V2("a"));
    const opened = await service.open(OWNER);
    if (opened.status !== "opened") throw new Error("not opened");
    expect(await write(service, opened.file.token, V2("b"))).toMatchObject({
      status: "saved",
    });
  });

  it("a Save dialog destination replacing a format 1 file needs no second consent (the dialog confirmed it)", async () => {
    const { service } = setup();
    await fs.writeFile(path.join(dir, "Copy.layoutry"), V1("old copy"));
    const { written } = await chooseAndWrite(
      service,
      "Copy.layoutry",
      V2("new"),
    );
    expect(written).toMatchObject({ status: "saved" });
  });

  it("the external-change Overwrite (force) follows the format consent and is not asked twice", async () => {
    const { service } = setup();
    const { token } = await openV1(service);
    expect(await write(service, token, V2("x"), { force: true })).toMatchObject(
      {
        status: "saved",
      },
    );
  });

  it("rejects a non-boolean upgradeFormat", async () => {
    const { service } = setup();
    const { token } = await openV1(service);
    await expect(
      service.write(OWNER, {
        token,
        text: V2("x"),
        force: false,
        upgradeFormat: "yes",
      }),
    ).rejects.toBeInstanceOf(InvalidPayloadError);
  });
});
