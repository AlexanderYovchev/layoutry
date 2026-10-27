// @vitest-environment node
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileCapabilityRegistry } from "../files/fileCapabilities";
import {
  createProjectFileService,
  InvalidPayloadError,
} from "../files/projectFileService";
import { createRecoveryService } from "./recoveryService";
import { createRecoveryStore } from "./recoveryStore";

const WINDOW = 7;
const OTHER_WINDOW = 8;

let root: string;
let recoveryDir: string;
let sessionCounter: number;
let saveAnswer: string | null;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "layoutry-recovery-svc-"));
  recoveryDir = path.join(root, "Recovery");
  sessionCounter = 0;
  saveAnswer = null;
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

function projectText(heading: string, name = "Website", id = "project-1") {
  return `${JSON.stringify(
    {
      format: "layoutry-project",
      formatVersion: 1,
      project: {
        id,
        name,
        createdAt: "2026-10-28T08:00:00.000Z",
        updatedAt: "2026-10-28T08:00:00.000Z",
      },
      document: { id: "page-root", tag: "page", children: [{ heading }] },
    },
    null,
    2,
  )}\n`;
}

function sha256(text: string) {
  return createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");
}

function setup() {
  const registry = new FileCapabilityRegistry();
  const files = createProjectFileService({
    registry,
    defaultFolder: () => root,
    showOpenDialog: async () => null,
    showSaveDialog: async () => saveAnswer,
    writeHooks: { sleep: () => Promise.resolve() },
  });
  const recovery = createRecoveryService({
    store: createRecoveryStore({
      directory: recoveryDir,
      writeHooks: { sleep: () => Promise.resolve() },
    }),
    registry,
    now: () => new Date("2026-10-28T09:00:00.000Z"),
    createSessionId: () => {
      sessionCounter += 1;
      return sessionCounter.toString(16).padStart(32, "0");
    },
  });
  return { registry, files, recovery };
}

function snapshot(
  generation: number,
  text: string,
  source: unknown = { kind: "unsaved" },
) {
  return { generation, source, sha256: sha256(text), text };
}

describe("recovery service", () => {
  it("binds sessions to windows; a new page load starts a new session", () => {
    const { recovery } = setup();
    const first = recovery.beginSession(WINDOW, undefined).sessionId;
    const second = recovery.beginSession(WINDOW, undefined).sessionId;
    expect(first).not.toBe(second);
    expect([...recovery.liveSessionIds()]).toEqual([second]);
  });

  it("stores a snapshot, never lists a running session's work, and lists it once the page is gone", async () => {
    const { recovery } = setup();
    const { sessionId } = recovery.beginSession(WINDOW, undefined);
    const text = projectText("Draft");
    expect(await recovery.write(WINDOW, snapshot(1, text))).toEqual({
      status: "written",
      recordId: `${sessionId}-1`,
    });
    expect(await recovery.list(WINDOW, undefined)).toEqual({
      status: "ok",
      entries: [],
    });

    recovery.endSession(WINDOW); // renderer crash
    recovery.beginSession(WINDOW, undefined); // the next page load
    const listed = await recovery.list(WINDOW, undefined);
    expect(listed).toMatchObject({
      status: "ok",
      entries: [
        {
          status: "ok",
          summary: {
            recordId: `${sessionId}-1`,
            projectId: "project-1",
            projectName: "Website",
            savedAt: "2026-10-28T09:00:00.000Z",
            source: { kind: "unsaved" },
            original: null,
          },
        },
      ],
    });
    const read = await recovery.read(WINDOW, {
      recordId: `${sessionId}-1`,
      forRestore: true,
    });
    expect(read).toMatchObject({ status: "ok", text, file: null });
  });

  it("refuses an older generation after a newer one (out-of-order writes)", async () => {
    const { recovery } = setup();
    recovery.beginSession(WINDOW, undefined);
    expect(
      await recovery.write(WINDOW, snapshot(5, projectText("new"))),
    ).toMatchObject({
      status: "written",
    });
    expect(
      await recovery.write(WINDOW, snapshot(4, projectText("old"))),
    ).toEqual({
      status: "stale",
    });
    expect(
      await recovery.write(WINDOW, snapshot(5, projectText("dup"))),
    ).toEqual({
      status: "stale",
    });
  });

  it("refuses a snapshot whose hash doesn't match its text", async () => {
    const { recovery } = setup();
    recovery.beginSession(WINDOW, undefined);
    const text = projectText("x");
    expect(
      await recovery.write(WINDOW, {
        ...snapshot(1, text),
        sha256: "0".repeat(64),
      }),
    ).toMatchObject({
      status: "error",
      error: { code: "verification-failed" },
    });
    expect(await fs.readdir(recoveryDir).catch(() => [])).toEqual([]);
  });

  it("needs a session first", async () => {
    const { recovery } = setup();
    expect(
      await recovery.write(WINDOW, snapshot(1, projectText("x"))),
    ).toMatchObject({
      status: "error",
      error: { code: "no-session" },
    });
  });

  it.each([
    ["no payload", undefined],
    ["extra keys", { ...snapshot(1, projectText("x")), path: "C:\\x" }],
    ["a fractional generation", snapshot(1.5, projectText("x"))],
    ["generation 0", snapshot(0, projectText("x"))],
    ["a non-project text", snapshot(1, '{"format":"other"}')],
    [
      "a project without an id",
      snapshot(
        1,
        '{"format":"layoutry-project","formatVersion":1,"project":{}}',
      ),
    ],
    ["an unknown source", snapshot(1, projectText("x"), { kind: "cloud" })],
    [
      "a source with a path",
      snapshot(1, projectText("x"), { kind: "unsaved", path: "C:\\x" }),
    ],
    [
      "a malformed token",
      snapshot(1, projectText("x"), {
        kind: "file",
        token: "../x",
        fileName: "a.layoutry",
      }),
    ],
  ])("rejects a payload with %s", async (_label, payload) => {
    const { recovery } = setup();
    recovery.beginSession(WINDOW, undefined);
    await expect(recovery.write(WINDOW, payload)).rejects.toBeInstanceOf(
      InvalidPayloadError,
    );
  });

  it("takes the project's identity from the text, not from the caller", async () => {
    const { recovery } = setup();
    const { sessionId } = recovery.beginSession(WINDOW, undefined);
    const text = projectText("x", "Real name", "real-id");
    await recovery.write(WINDOW, snapshot(1, text));
    recovery.endSession(WINDOW);
    const listed = await recovery.list(OTHER_WINDOW, undefined);
    expect(listed).toMatchObject({
      entries: [
        {
          summary: {
            recordId: `${sessionId}-1`,
            projectId: "real-id",
            projectName: "Real name",
          },
        },
      ],
    });
  });

  it("another running window can't read or delete this session's snapshots", async () => {
    const { recovery } = setup();
    const { sessionId } = recovery.beginSession(WINDOW, undefined);
    recovery.beginSession(OTHER_WINDOW, undefined);
    await recovery.write(WINDOW, snapshot(1, projectText("mine")));
    expect(
      await recovery.read(OTHER_WINDOW, {
        recordId: `${sessionId}-1`,
        forRestore: false,
      }),
    ).toMatchObject({ status: "error", error: { code: "in-use" } });
    expect(
      await recovery.discard(OTHER_WINDOW, { recordIds: [`${sessionId}-1`] }),
    ).toEqual({ status: "ok", removed: 0 });
    expect(await fs.readdir(recoveryDir)).toHaveLength(1);
    // Its own window may discard them (Don't Save, or a clean save).
    expect(
      await recovery.discard(WINDOW, { recordIds: [`${sessionId}-1`] }),
    ).toEqual({ status: "ok", removed: 1 });
    expect(await fs.readdir(recoveryDir)).toEqual([]);
  });

  it("rejects path-like record ids", async () => {
    const { recovery } = setup();
    recovery.beginSession(WINDOW, undefined);
    await expect(
      recovery.read(WINDOW, { recordId: "..\\..\\x", forRestore: false }),
    ).rejects.toBeInstanceOf(InvalidPayloadError);
    await expect(
      recovery.discard(WINDOW, { recordIds: ["C:\\Windows\\win.ini"] }),
    ).rejects.toBeInstanceOf(InvalidPayloadError);
  });

  describe("native files", () => {
    async function savedFile(
      services: ReturnType<typeof setup>,
      fileName: string,
      text: string,
    ) {
      saveAnswer = path.join(root, fileName);
      const choice = await services.files.chooseSaveLocation(WINDOW, {
        suggestedName: fileName,
      });
      if (choice.status !== "chosen") throw new Error(JSON.stringify(choice));
      const written = await services.files.write(WINDOW, {
        token: choice.target.token,
        text,
        force: false,
      });
      if (written.status !== "saved") throw new Error(JSON.stringify(written));
      return choice.target.token;
    }

    it("a restored file project still detects a change made outside Layoutry after the crash", async () => {
      const services = setup();
      const { recovery, files, registry } = services;
      const { sessionId } = recovery.beginSession(WINDOW, undefined);
      const saved = projectText("Saved version");
      const token = await savedFile(services, "Site.layoutry", saved);
      const edited = projectText("Unsaved edits");
      await recovery.write(
        WINDOW,
        snapshot(1, edited, { kind: "file", token, fileName: "Site.layoutry" }),
      );

      // Crash: the page's tokens and session die with it.
      registry.revokeOwner(WINDOW);
      recovery.endSession(WINDOW);
      // Meanwhile a colleague changes the file.
      const external = projectText("Colleague's version");
      await fs.writeFile(path.join(root, "Site.layoutry"), external);

      recovery.beginSession(WINDOW, undefined);
      const listed = await recovery.list(WINDOW, undefined);
      expect(listed).toMatchObject({
        entries: [
          {
            summary: {
              source: { kind: "file", fileName: "Site.layoutry" },
              original: "modified",
            },
          },
        ],
      });
      // No path ever reaches the renderer.
      expect(JSON.stringify(listed)).not.toContain(
        root.replaceAll("\\", "\\\\"),
      );

      const read = await recovery.read(WINDOW, {
        recordId: `${sessionId}-1`,
        forRestore: true,
      });
      if (read.status !== "ok" || !read.file) throw new Error("no file");
      expect(read.matchesOriginal).toBe(false);
      expect(read.file.fileName).toBe("Site.layoutry");

      // Save of the restored work: refused as a conflict, file untouched.
      expect(
        await files.write(WINDOW, {
          token: read.file.token,
          text: edited,
          force: false,
        }),
      ).toEqual({
        status: "conflict",
        reason: "modified",
        fileName: "Site.layoutry",
      });
      expect(await fs.readFile(path.join(root, "Site.layoutry"), "utf8")).toBe(
        external,
      );
    });

    it("an unchanged original saves straight back after restore", async () => {
      const services = setup();
      const { recovery, files, registry } = services;
      const { sessionId } = recovery.beginSession(WINDOW, undefined);
      const token = await savedFile(
        services,
        "Site.layoutry",
        projectText("v1"),
      );
      const edited = projectText("v2");
      await recovery.write(
        WINDOW,
        snapshot(1, edited, { kind: "file", token, fileName: "Site.layoutry" }),
      );
      registry.revokeOwner(WINDOW);
      recovery.endSession(WINDOW);

      recovery.beginSession(WINDOW, undefined);
      const read = await recovery.read(WINDOW, {
        recordId: `${sessionId}-1`,
        forRestore: true,
      });
      if (read.status !== "ok" || !read.file) throw new Error("no file");
      expect(read.summary.original).toBe("unchanged");
      expect(
        await files.write(WINDOW, {
          token: read.file.token,
          text: edited,
          force: false,
        }),
      ).toMatchObject({ status: "saved" });
    });

    it("recognizes a snapshot whose work the original file already holds", async () => {
      const services = setup();
      const { recovery, registry } = services;
      const { sessionId } = recovery.beginSession(WINDOW, undefined);
      const text = projectText("Same");
      const token = await savedFile(
        services,
        "Site.layoutry",
        projectText("Old"),
      );
      await recovery.write(
        WINDOW,
        snapshot(1, text, { kind: "file", token, fileName: "Site.layoutry" }),
      );
      // Saved, but the cleanup never happened (crash right after Save).
      await fs.writeFile(
        path.join(root, "Site.layoutry"),
        text.replace("08:00", "09:30"),
      );
      registry.revokeOwner(WINDOW);
      recovery.endSession(WINDOW);

      recovery.beginSession(WINDOW, undefined);
      expect(
        await recovery.read(WINDOW, {
          recordId: `${sessionId}-1`,
          forRestore: false,
        }),
      ).toMatchObject({ status: "ok", matchesOriginal: true, file: null });
    });

    it("a token from the snapshot payload is never trusted on its own", async () => {
      const { recovery } = setup();
      const { sessionId } = recovery.beginSession(WINDOW, undefined);
      await recovery.write(
        WINDOW,
        snapshot(1, projectText("x"), {
          kind: "file",
          token: "f".repeat(32),
          fileName: "..\\..\\Windows\\evil.layoutry",
        }),
      );
      recovery.endSession(WINDOW);
      recovery.beginSession(WINDOW, undefined);
      const read = await recovery.read(WINDOW, {
        recordId: `${sessionId}-1`,
        forRestore: true,
      });
      expect(read).toMatchObject({
        status: "ok",
        file: null,
        summary: {
          source: { kind: "file", fileName: "evil.layoutry" },
          original: null,
        },
      });
    });
  });
});
