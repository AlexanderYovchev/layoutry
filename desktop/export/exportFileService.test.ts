// @vitest-environment node
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InvalidPayloadError } from "../files/projectFileService";
import {
  MAX_EXPORT_FILE_CHARACTERS,
  createExportFileService,
  nodeExportFileOps,
  safeSuggestedHtmlName,
  type ExportFileOps,
} from "./exportFileService";

const OWNER = 7;
const HTML = "<!DOCTYPE html>\n<p>New</p>\n";
const CSS = "p { color: red; }\n";
const JS = "(() => {})();\n";

let dir: string;
let saveAnswer: string | null;
let folderAnswer: string | null;
let lastSaveDefault: string | null;

function setup(ops: ExportFileOps = nodeExportFileOps) {
  return createExportFileService({
    defaultFolder: () => dir,
    showSaveHtmlDialog: async (defaultPath) => {
      lastSaveDefault = defaultPath;
      return saveAnswer;
    },
    showFolderDialog: async () => folderAnswer,
    ops,
    writeHooks: { sleep: () => Promise.resolve(), replaceRetryDelaysMs: [] },
  });
}

type Service = ReturnType<typeof setup>;

async function chooseFolder(service: Service, folder: string, owner = OWNER) {
  folderAnswer = folder;
  const chosen = await service.chooseDestination(owner, { mode: "separate", suggestedName: "Site" });
  if (chosen.status !== "chosen") throw new Error(JSON.stringify(chosen));
  return chosen.destination.token;
}

const separateFiles = (html = HTML) => [
  { path: "index.html", content: html },
  { path: "styles.css", content: CSS },
  { path: "script.js", content: JS },
];

async function listFolder(folder: string) {
  return (await fs.readdir(folder)).sort();
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "layoutry-export-service-"));
  saveAnswer = null;
  folderAnswer = null;
  lastSaveDefault = null;
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe("single HTML file", () => {
  it("saves exactly the generated text where the Save dialog pointed, and returns no path", async () => {
    const service = setup();
    saveAnswer = path.join(dir, "Landing page.html");
    const chosen = await service.chooseDestination(OWNER, { mode: "standalone", suggestedName: "index.html" });
    expect(lastSaveDefault).toBe(path.join(dir, "index.html"));
    if (chosen.status !== "chosen") throw new Error("not chosen");
    expect(chosen.destination.label).toBe("Landing page.html");
    const written = await service.write(OWNER, { token: chosen.destination.token, files: [{ path: "index.html", content: HTML }], overwrite: false });
    expect(written).toEqual({ status: "saved", label: path.basename(dir), fileNames: ["Landing page.html"] });
    expect(await fs.readFile(saveAnswer, "utf8")).toBe(HTML);
    expect(await listFolder(dir)).toEqual(["Landing page.html"]);
    expect(JSON.stringify([chosen, written])).not.toContain(dir.replace(/\\/g, "\\\\"));
  });

  it("respects a cancelled dialog", async () => {
    const service = setup();
    expect(await service.chooseDestination(OWNER, { mode: "standalone", suggestedName: "index.html" })).toEqual({ status: "cancelled" });
  });

  it("adds .html to a name typed without it, and refuses to silently replace that other file", async () => {
    const service = setup();
    saveAnswer = path.join(dir, "page");
    const chosen = await service.chooseDestination(OWNER, { mode: "standalone", suggestedName: "index.html" });
    if (chosen.status !== "chosen") throw new Error("not chosen");
    expect(chosen.destination.label).toBe("page.html");

    await fs.writeFile(path.join(dir, "taken.html"), "mine");
    saveAnswer = path.join(dir, "taken");
    expect(await service.chooseDestination(OWNER, { mode: "standalone", suggestedName: "index.html" })).toMatchObject({ status: "error", error: { code: "invalid-path" } });
    expect(await fs.readFile(path.join(dir, "taken.html"), "utf8")).toBe("mine");
  });

  it("replaces the file the Save dialog confirmed, but not one that changed after the dialog", async () => {
    const service = setup();
    saveAnswer = path.join(dir, "index.html");
    await fs.writeFile(saveAnswer, "old");
    let chosen = await service.chooseDestination(OWNER, { mode: "standalone", suggestedName: "index.html" });
    if (chosen.status !== "chosen") throw new Error("not chosen");
    expect(await service.write(OWNER, { token: chosen.destination.token, files: [{ path: "index.html", content: HTML }], overwrite: false })).toMatchObject({ status: "saved" });
    expect(await fs.readFile(saveAnswer, "utf8")).toBe(HTML);

    chosen = await service.chooseDestination(OWNER, { mode: "standalone", suggestedName: "index.html" });
    if (chosen.status !== "chosen") throw new Error("not chosen");
    await fs.writeFile(saveAnswer, "edited elsewhere after the dialog");
    expect(await service.write(OWNER, { token: chosen.destination.token, files: [{ path: "index.html", content: "v2" }], overwrite: false })).toEqual({
      status: "conflict",
      label: path.basename(dir),
      existing: ["index.html"],
    });
    expect(await fs.readFile(saveAnswer, "utf8")).toBe("edited elsewhere after the dialog");
    expect(await service.write(OWNER, { token: chosen.destination.token, files: [{ path: "index.html", content: "v2" }], overwrite: true })).toMatchObject({ status: "saved" });
    expect(await fs.readFile(saveAnswer, "utf8")).toBe("v2");
  });

  it("uses each destination for one successful export only", async () => {
    const service = setup();
    saveAnswer = path.join(dir, "index.html");
    const chosen = await service.chooseDestination(OWNER, { mode: "standalone", suggestedName: "index.html" });
    if (chosen.status !== "chosen") throw new Error("not chosen");
    const payload = { token: chosen.destination.token, files: [{ path: "index.html", content: HTML }], overwrite: true };
    expect(await service.write(OWNER, payload)).toMatchObject({ status: "saved" });
    expect(await service.write(OWNER, payload)).toMatchObject({ status: "error", error: { code: "invalid-token" } });
  });

  it("sanitizes the suggested name to a bare .html file name", () => {
    expect(safeSuggestedHtmlName("index.html")).toBe("index.html");
    expect(safeSuggestedHtmlName("..\\..\\Windows\\evil")).toBe("evil.html");
    expect(safeSuggestedHtmlName("../../etc/passwd.htm")).toBe("passwd.htm");
    // "a:" reads as a drive and is dropped like any folder part.
    expect(safeSuggestedHtmlName("a:b*c?.html")).toBe("b-c-.html");
    expect(safeSuggestedHtmlName("b*c?.html")).toBe("b-c-.html");
    expect(safeSuggestedHtmlName(" . ")).toBe("index.html");
    expect(() => safeSuggestedHtmlName("x".repeat(300))).toThrow(InvalidPayloadError);
  });
});

describe("separate files", () => {
  it("writes index.html, styles.css and script.js into the chosen folder and nothing else", async () => {
    const service = setup();
    await fs.writeFile(path.join(dir, "notes.txt"), "keep me");
    const token = await chooseFolder(service, dir);
    expect(await service.write(OWNER, { token, files: separateFiles(), overwrite: false })).toEqual({
      status: "saved",
      label: path.basename(dir),
      fileNames: ["styles.css", "script.js", "index.html"],
    });
    expect(await listFolder(dir)).toEqual(["index.html", "notes.txt", "script.js", "styles.css"]);
    expect(await fs.readFile(path.join(dir, "index.html"), "utf8")).toBe(HTML);
    expect(await fs.readFile(path.join(dir, "styles.css"), "utf8")).toBe(CSS);
    expect(await fs.readFile(path.join(dir, "script.js"), "utf8")).toBe(JS);
    expect(await fs.readFile(path.join(dir, "notes.txt"), "utf8")).toBe("keep me");
  });

  it("writes a static page as two files", async () => {
    const service = setup();
    const token = await chooseFolder(service, dir);
    expect(await service.write(OWNER, { token, files: separateFiles().slice(0, 2), overwrite: false })).toMatchObject({ status: "saved", fileNames: ["styles.css", "index.html"] });
    expect(await listFolder(dir)).toEqual(["index.html", "styles.css"]);
  });

  it("reports existing files as a conflict and writes nothing until the user confirms", async () => {
    const service = setup();
    await fs.writeFile(path.join(dir, "index.html"), "old page");
    await fs.writeFile(path.join(dir, "styles.css"), "old css");
    const token = await chooseFolder(service, dir);
    expect(await service.write(OWNER, { token, files: separateFiles(), overwrite: false })).toEqual({
      status: "conflict",
      label: path.basename(dir),
      existing: ["styles.css", "index.html"],
    });
    expect(await listFolder(dir)).toEqual(["index.html", "styles.css"]);
    expect(await fs.readFile(path.join(dir, "index.html"), "utf8")).toBe("old page");
    expect(await service.write(OWNER, { token, files: separateFiles(), overwrite: true })).toMatchObject({ status: "saved" });
    expect(await fs.readFile(path.join(dir, "index.html"), "utf8")).toBe(HTML);
    expect(await fs.readFile(path.join(dir, "styles.css"), "utf8")).toBe(CSS);
  });

  it("refuses a folder that is a junction or symbolic link", async () => {
    const service = setup();
    const real = path.join(dir, "real");
    const link = path.join(dir, "link");
    await fs.mkdir(real);
    await fs.symlink(real, link, "junction");
    folderAnswer = link;
    expect(await service.chooseDestination(OWNER, { mode: "separate", suggestedName: "Site" })).toMatchObject({ status: "error", error: { code: "symbolic-link" } });

    // Replaced by a junction after it was chosen.
    const site = path.join(dir, "site");
    await fs.mkdir(site);
    const token = await chooseFolder(service, site);
    await fs.rm(site, { recursive: true });
    await fs.symlink(real, site, "junction");
    expect(await service.write(OWNER, { token, files: separateFiles(), overwrite: true })).toMatchObject({ status: "error", error: { code: "symbolic-link" } });
    expect(await listFolder(real)).toEqual([]);
  });

  it("never writes through a link that sits where an exported file goes", async () => {
    const service = setup();
    const outside = path.join(dir, "outside");
    const site = path.join(dir, "site");
    await fs.mkdir(outside);
    await fs.mkdir(site);
    await fs.symlink(outside, path.join(site, "styles.css"), "junction");
    const token = await chooseFolder(service, site);
    expect(await service.write(OWNER, { token, files: separateFiles(), overwrite: true })).toMatchObject({ status: "error", error: { code: "symbolic-link" } });
    expect(await listFolder(site)).toEqual(["styles.css"]);
    expect(await listFolder(outside)).toEqual([]);
  });

  it("reports a folder that no longer exists", async () => {
    const service = setup();
    const site = path.join(dir, "site");
    await fs.mkdir(site);
    const token = await chooseFolder(service, site);
    await fs.rm(site, { recursive: true });
    expect(await service.write(OWNER, { token, files: separateFiles(), overwrite: false })).toMatchObject({ status: "error", error: { code: "not-found" } });
  });
});

describe("payload validation", () => {
  it("accepts only the fixed export file names — no paths, traversal or other extensions", async () => {
    const service = setup();
    const token = await chooseFolder(service, dir);
    const bad = [
      "../index.html",
      "..\\index.html",
      "sub/index.html",
      "C:\\Windows\\index.html",
      "/etc/index.html",
      "INDEX.HTML",
      "index.html ",
      "index.html:stream",
      "styles.css.exe",
      "evil.js",
      "index.htm",
      "",
    ];
    for (const name of bad)
      await expect(service.write(OWNER, { token, files: [{ path: name, content: "x" }, { path: "styles.css", content: CSS }], overwrite: false }), name).rejects.toThrow(InvalidPayloadError);
    expect(await listFolder(dir)).toEqual([]);
  });

  it("rejects malformed, duplicate, oversized and mismatched file lists", async () => {
    const service = setup();
    const token = await chooseFolder(service, dir);
    const attempts: unknown[] = [
      { token, files: [], overwrite: false },
      { token, files: "index.html", overwrite: false },
      { token, files: [...separateFiles(), { path: "index.html", content: "" }], overwrite: false },
      { token, files: [{ path: "index.html", content: HTML }, { path: "index.html", content: HTML }], overwrite: false },
      { token, files: [{ path: "index.html", content: 5 }, { path: "styles.css", content: CSS }], overwrite: false },
      { token, files: [{ path: "index.html", content: HTML, folder: "C:\\" }, { path: "styles.css", content: CSS }], overwrite: false },
      { token, files: [{ path: "index.html", content: "x".repeat(MAX_EXPORT_FILE_CHARACTERS + 1) }, { path: "styles.css", content: CSS }], overwrite: false },
      { token, files: [{ path: "index.html", content: HTML }], overwrite: false },
      { token, files: [{ path: "styles.css", content: CSS }, { path: "script.js", content: JS }], overwrite: false },
      { token, files: separateFiles(), overwrite: "yes" },
      { token, files: separateFiles(), overwrite: false, path: "C:\\" },
      { token: "../../x", files: separateFiles(), overwrite: false },
      null,
    ];
    for (const attempt of attempts) await expect(service.write(OWNER, attempt)).rejects.toThrow(InvalidPayloadError);
    await expect(service.chooseDestination(OWNER, { mode: "zip", suggestedName: "Site" })).rejects.toThrow(InvalidPayloadError);
    await expect(service.chooseDestination(OWNER, { mode: "separate" })).rejects.toThrow(InvalidPayloadError);
    await expect(service.chooseDestination(OWNER, { mode: "separate", suggestedName: "Site", folder: "C:\\" })).rejects.toThrow(InvalidPayloadError);
    expect(await listFolder(dir)).toEqual([]);
  });

  it("rejects a single-file destination given separate files", async () => {
    const service = setup();
    saveAnswer = path.join(dir, "index.html");
    const chosen = await service.chooseDestination(OWNER, { mode: "standalone", suggestedName: "index.html" });
    if (chosen.status !== "chosen") throw new Error("not chosen");
    await expect(service.write(OWNER, { token: chosen.destination.token, files: separateFiles(), overwrite: false })).rejects.toThrow(InvalidPayloadError);
    expect(await listFolder(dir)).toEqual([]);
  });

  it("honours tokens only for the window they were issued to, and forgets them when it closes", async () => {
    const service = setup();
    const token = await chooseFolder(service, dir);
    expect(await service.write(OWNER + 1, { token, files: separateFiles(), overwrite: false })).toMatchObject({ status: "error", error: { code: "invalid-token" } });
    expect(await service.write(OWNER, { token: "0".repeat(32), files: separateFiles(), overwrite: false })).toMatchObject({ status: "error", error: { code: "invalid-token" } });
    service.revokeOwner(OWNER);
    expect(await service.write(OWNER, { token, files: separateFiles(), overwrite: false })).toMatchObject({ status: "error", error: { code: "invalid-token" } });
    expect(await listFolder(dir)).toEqual([]);
  });
});

describe("failures and rollback", () => {
  function failingOps(fail: { rename?: (to: string) => NodeJS.ErrnoException | null; write?: (tempPath: string) => NodeJS.ErrnoException | null; beforeRename?: (to: string) => Promise<void> }): ExportFileOps {
    return {
      ...nodeExportFileOps,
      createExclusive: async (filePath) => {
        const file = await nodeExportFileOps.createExclusive(filePath);
        return {
          ...file,
          write: async (bytes) => {
            const error = fail.write?.(filePath);
            if (error) throw error;
            await file.write(bytes);
          },
        };
      },
      rename: async (from, to) => {
        await fail.beforeRename?.(to);
        const error = fail.rename?.(to);
        if (error) throw error;
        await nodeExportFileOps.rename(from, to);
      },
    };
  }

  const errno = (code: string) => Object.assign(new Error(code), { code });

  it("changes nothing when staging fails (disk full), and leaves no temporary files", async () => {
    await fs.writeFile(path.join(dir, "styles.css"), "old css");
    const service = setup(failingOps({ write: (tempPath) => (tempPath.includes(".index.") ? errno("ENOSPC") : null) }));
    const token = await chooseFolder(service, dir);
    const result = await service.write(OWNER, { token, files: separateFiles(), overwrite: true });
    expect(result).toMatchObject({ status: "error", error: { code: "disk-full" } });
    if (result.status === "error") expect(result.error.message).toContain("Nothing was exported or changed.");
    expect(await listFolder(dir)).toEqual(["styles.css"]);
    expect(await fs.readFile(path.join(dir, "styles.css"), "utf8")).toBe("old css");
  });

  it("puts replaced files back when a later file can't be replaced (locked)", async () => {
    await fs.writeFile(path.join(dir, "styles.css"), "old css");
    await fs.writeFile(path.join(dir, "index.html"), "old page");
    await fs.writeFile(path.join(dir, "notes.txt"), "keep me");
    const service = setup(failingOps({ rename: (to) => (to.endsWith("index.html") ? errno("EBUSY") : null) }));
    const token = await chooseFolder(service, dir);
    const result = await service.write(OWNER, { token, files: separateFiles(), overwrite: true });
    expect(result).toMatchObject({ status: "error", error: { code: "locked" } });
    if (result.status === "error") expect(result.error.message).toContain("put back as they were");
    // styles.css restored, the new script.js removed, index.html untouched, notes kept, no temp files.
    expect(await listFolder(dir)).toEqual(["index.html", "notes.txt", "styles.css"]);
    expect(await fs.readFile(path.join(dir, "styles.css"), "utf8")).toBe("old css");
    expect(await fs.readFile(path.join(dir, "index.html"), "utf8")).toBe("old page");
    expect(await fs.readFile(path.join(dir, "notes.txt"), "utf8")).toBe("keep me");
  });

  it("stops if a file appears in the folder after the conflict check, and overwrites nothing", async () => {
    // index.html appears while styles.css is being replaced — after the
    // conflict check, before index.html's own re-check.
    const service = setup(
      failingOps({
        beforeRename: async (to) => {
          if (to.endsWith("styles.css")) await fs.writeFile(path.join(dir, "index.html"), "created meanwhile");
        },
      }),
    );
    const token = await chooseFolder(service, dir);
    const result = await service.write(OWNER, { token, files: separateFiles(), overwrite: false });
    expect(result).toMatchObject({ status: "error", error: { code: "changed" } });
    expect(await listFolder(dir)).toEqual(["index.html"]);
    expect(await fs.readFile(path.join(dir, "index.html"), "utf8")).toBe("created meanwhile");
  });

  it("never removes a file during rollback once something else has changed it", async () => {
    let wroteStyles = false;
    const service = setup(
      failingOps({
        rename: (to) => {
          if (to.endsWith("index.html")) return errno("EPERM");
          if (to.endsWith("styles.css")) wroteStyles = true;
          return null;
        },
        beforeRename: async (to) => {
          if (to.endsWith("index.html") && wroteStyles) await fs.writeFile(path.join(dir, "styles.css"), "user edit");
        },
      }),
    );
    const token = await chooseFolder(service, dir);
    const result = await service.write(OWNER, { token, files: separateFiles().slice(0, 2), overwrite: false });
    expect(result).toMatchObject({ status: "error" });
    if (result.status === "error") expect(result.error.message).toContain("couldn't be put back");
    expect(await fs.readFile(path.join(dir, "styles.css"), "utf8")).toBe("user edit");
  });

  it("retries a replace blocked for a moment (antivirus, indexer)", async () => {
    let blocked = 2;
    const service = createExportFileService({
      defaultFolder: () => dir,
      showSaveHtmlDialog: async () => null,
      showFolderDialog: async () => dir,
      ops: failingOps({ rename: () => (blocked-- > 0 ? errno("EPERM") : null) }),
      writeHooks: { sleep: () => Promise.resolve(), replaceRetryDelaysMs: [1, 1, 1] },
    });
    const chosen = await service.chooseDestination(OWNER, { mode: "separate", suggestedName: "Site" });
    if (chosen.status !== "chosen") throw new Error("not chosen");
    expect(await service.write(OWNER, { token: chosen.destination.token, files: separateFiles(), overwrite: false })).toMatchObject({ status: "saved" });
  });
});
