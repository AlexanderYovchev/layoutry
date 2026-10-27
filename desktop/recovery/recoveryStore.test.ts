// @vitest-environment node
import {
  mkdtempSync,
  promises as fs,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  fingerprintOf,
  nodeProjectFileOps,
  type ProjectFileOps,
} from "../files/projectFileSystem";
import {
  recordIdOf,
  RECOVERY_RECORD_FORMAT,
  RECOVERY_RECORD_VERSION,
  type RecoveryHeader,
} from "./recoveryRecord";
import { createRecoveryStore, RecoveryStoreError } from "./recoveryStore";

const SESSION = "a".repeat(32);
const OTHER = "b".repeat(32);
const noSleep = { sleep: () => Promise.resolve() };

/** File symbolic links need Developer Mode or admin rights on Windows. */
const canCreateFileSymlinks = (() => {
  const probe = mkdtempSync(path.join(os.tmpdir(), "layoutry-symlink-probe-"));
  try {
    writeFileSync(path.join(probe, "target"), "");
    symlinkSync(path.join(probe, "target"), path.join(probe, "link"), "file");
    return true;
  } catch {
    return false;
  } finally {
    rmSync(probe, { recursive: true, force: true });
  }
})();

let root: string;
let dir: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "layoutry-recovery-"));
  dir = path.join(root, "Recovery");
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

function projectText(heading: string): string {
  return `${JSON.stringify({
    format: "layoutry-project",
    formatVersion: 1,
    project: { id: "project-1", name: "Website" },
    document: { heading },
  })}\n`;
}

function headerFor(
  text: string,
  generation: number,
  overrides: Partial<RecoveryHeader> = {},
): RecoveryHeader {
  const sessionId = overrides.sessionId ?? SESSION;
  const fingerprint = fingerprintOf(Buffer.from(text, "utf8"));
  return {
    format: RECOVERY_RECORD_FORMAT,
    recoveryVersion: RECOVERY_RECORD_VERSION,
    recordId: recordIdOf(sessionId, generation),
    sessionId,
    generation,
    projectId: "project-1",
    projectName: "Website",
    savedAt: new Date(Date.UTC(2026, 9, 28, 9, 0, generation)).toISOString(),
    source: { kind: "unsaved" },
    textBytes: fingerprint.size,
    sha256: fingerprint.sha256,
    association: null,
    ...overrides,
  };
}

async function storeWith(ops: ProjectFileOps = nodeProjectFileOps) {
  const store = createRecoveryStore({
    directory: dir,
    ops,
    writeHooks: noSleep,
  });
  await store.prepare();
  return store;
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  if (!(error instanceof RecoveryStoreError))
    throw new Error(`expected a RecoveryStoreError, got ${String(error)}`);
  return error.code;
}

const live = { liveSessionIds: new Set([SESSION]) };

describe("recovery store", () => {
  it("creates its folder and writes, lists and reads a snapshot exactly", async () => {
    const store = await storeWith();
    const text = projectText("Hello — ünïcödé");
    await store.write(headerFor(text, 1), text, live);

    expect(await fs.readdir(dir)).toEqual([
      `${recordIdOf(SESSION, 1)}.layoutry-recovery`,
    ]);
    const [entry] = await store.list();
    expect(entry).toMatchObject({ status: "ok", header: { generation: 1 } });
    const read = await store.read(recordIdOf(SESSION, 1));
    expect(read.text).toBe(text);
    expect(read.header).toEqual(headerFor(text, 1));
  });

  it("detects a truncated record (interrupted write) when listing and reading", async () => {
    const store = await storeWith();
    const text = projectText("whole");
    await store.write(headerFor(text, 1), text, live);
    const file = path.join(dir, `${recordIdOf(SESSION, 1)}.layoutry-recovery`);
    const bytes = await fs.readFile(file);
    await fs.writeFile(file, bytes.subarray(0, bytes.length - 5));

    expect(await store.list()).toEqual([
      {
        status: "damaged",
        recordId: recordIdOf(SESSION, 1),
        sessionId: SESSION,
        reason: "unreadable",
      },
    ]);
    expect(await codeOf(store.read(recordIdOf(SESSION, 1)))).toBe("damaged");
  });

  it("detects altered content by its hash even when the length is unchanged", async () => {
    const store = await storeWith();
    const text = projectText("zzzz");
    await store.write(headerFor(text, 1), text, live);
    const file = path.join(dir, `${recordIdOf(SESSION, 1)}.layoutry-recovery`);
    await fs.writeFile(
      file,
      (await fs.readFile(file, "utf8")).replace("zzzz", "yyyy"),
    );
    expect((await store.list())[0]?.status).toBe("ok");
    expect(await codeOf(store.read(recordIdOf(SESSION, 1)))).toBe("damaged");
  });

  it("reports a record from a newer Layoutry as unsupported, not damaged", async () => {
    const store = await storeWith();
    const text = projectText("future");
    const header = { ...headerFor(text, 1), recoveryVersion: 9 };
    await fs.writeFile(
      path.join(dir, `${recordIdOf(SESSION, 1)}.layoutry-recovery`),
      `${JSON.stringify(header)}\n${text}`,
    );
    expect((await store.list())[0]).toMatchObject({
      status: "damaged",
      reason: "unsupported-version",
    });
    expect(await codeOf(store.read(recordIdOf(SESSION, 1)))).toBe(
      "unsupported-version",
    );
  });

  it("removes temporary files of interrupted writes at startup, and nothing else", async () => {
    await fs.mkdir(dir);
    const temp = `.${recordIdOf(SESSION, 4)}.0123456789abcdef01234567.recovery-tmp`;
    await fs.writeFile(path.join(dir, temp), "half a snapshot");
    await fs.writeFile(path.join(dir, "notes.txt"), "not ours");
    const store = createRecoveryStore({ directory: dir });
    expect(await store.prepare()).toEqual({ removedTempFiles: 1 });
    expect(await fs.readdir(dir)).toEqual(["notes.txt"]);
    expect(await store.list()).toEqual([]);
  });

  it("refuses a recovery folder that is a junction to somewhere else", async () => {
    const elsewhere = path.join(root, "elsewhere");
    await fs.mkdir(elsewhere);
    await fs.symlink(elsewhere, dir, "junction");
    const store = createRecoveryStore({ directory: dir });
    expect(await codeOf(store.prepare())).toBe("unavailable");
    const text = projectText("x");
    expect(await codeOf(store.write(headerFor(text, 1), text, live))).toBe(
      "unavailable",
    );
    expect(await fs.readdir(elsewhere)).toEqual([]);
  });

  it.skipIf(!canCreateFileSymlinks)(
    "never follows a link planted in the folder",
    async () => {
      const store = await storeWith();
      const outside = path.join(root, "outside.txt");
      await fs.writeFile(outside, "secret");
      await fs.symlink(
        outside,
        path.join(dir, `${recordIdOf(OTHER, 1)}.layoutry-recovery`),
        "file",
      );
      expect(await store.list()).toEqual([]);
      expect(await codeOf(store.read(recordIdOf(OTHER, 1)))).toBe("damaged");
    },
  );

  it("never follows a junction named like a record", async () => {
    const store = await storeWith();
    const outside = path.join(root, "outside");
    await fs.mkdir(outside);
    await fs.symlink(
      outside,
      path.join(dir, `${recordIdOf(OTHER, 1)}.layoutry-recovery`),
      "junction",
    );
    expect(await store.list()).toEqual([]);
    expect(await codeOf(store.read(recordIdOf(OTHER, 1)))).toBe("damaged");
  });

  it("refuses record ids that could name a path", async () => {
    const store = await storeWith();
    expect(await codeOf(store.read("..\\..\\boot"))).toBe("not-found");
    await store.remove(["..\\..\\boot", "../x"]);
  });

  it("keeps the five newest snapshots of the writing session's project", async () => {
    const store = await storeWith();
    for (let generation = 1; generation <= 7; generation += 1) {
      const text = projectText(`v${generation}`);
      await store.write(headerFor(text, generation), text, live);
    }
    const generations = (await store.list())
      .flatMap((entry) =>
        entry.status === "ok" ? [entry.header.generation] : [],
      )
      .sort((a, b) => a - b);
    expect(generations).toEqual([3, 4, 5, 6, 7]);
  });

  it("a failed write leaves every earlier snapshot intact and no temporary file", async () => {
    const failing: ProjectFileOps = {
      ...nodeProjectFileOps,
      createExclusive: async (filePath) => {
        const file = await nodeProjectFileOps.createExclusive(filePath);
        return {
          ...file,
          write: () =>
            Promise.reject(
              Object.assign(new Error("ENOSPC"), { code: "ENOSPC" }),
            ),
        };
      },
    };
    const good = await storeWith();
    const first = projectText("first");
    await good.write(headerFor(first, 1), first, live);

    const store = await storeWith(failing);
    const second = projectText("second");
    expect(await codeOf(store.write(headerFor(second, 2), second, live))).toBe(
      "disk-full",
    );
    expect(await fs.readdir(dir)).toEqual([
      `${recordIdOf(SESSION, 1)}.layoutry-recovery`,
    ]);
    expect((await store.read(recordIdOf(SESSION, 1))).text).toBe(first);
  });

  it("measures a full startup scan, a 10 MB read and a retention pass", async () => {
    const store = createRecoveryStore({
      directory: dir,
      writeHooks: noSleep,
      limits: {
        snapshotsPerProject: 5,
        maxTotalBytes: 40 * 1024 * 1024,
        maxRecords: 100,
      },
    });
    await store.prepare();
    // 99 ended sessions with one 50 KB snapshot each…
    const small = projectText("x".repeat(50 * 1024));
    for (let index = 1; index <= 99; index += 1) {
      const sessionId = index.toString(16).padStart(32, "0");
      await store.write(headerFor(small, 1, { sessionId }), small, live);
    }
    // …and this session's 10 MB snapshot.
    const large = projectText("y".repeat(10 * 1024 * 1024));
    let started = performance.now();
    await store.write(headerFor(large, 1), large, live);
    const writeMs = performance.now() - started;

    started = performance.now();
    const entries = await store.list();
    const scanMs = performance.now() - started;
    expect(entries).toHaveLength(100);

    started = performance.now();
    expect((await store.read(recordIdOf(SESSION, 1))).text).toBe(large);
    const readMs = performance.now() - started;

    // A second 10 MB snapshot of another project: 101 records, over the
    // count bound, so retention runs; nothing is any project's only copy.
    const second = projectText("z".repeat(10 * 1024 * 1024));
    started = performance.now();
    await store.write(
      headerFor(second, 2, { projectId: "project-2" }),
      second,
      live,
    );
    const retentionWriteMs = performance.now() - started;
    expect(await store.list()).toHaveLength(101);

    console.log(
      `[recovery store perf] 10 MB write ${Math.round(writeMs)} ms (incl. retention scan of 100 records), header scan of 100 records ${Math.round(scanMs)} ms, verified 10 MB read ${Math.round(readMs)} ms, write + retention pass at 101 records ${Math.round(retentionWriteMs)} ms`,
    );
    expect(scanMs).toBeLessThan(5_000);
  }, 60_000);

  it("removes only the records it is asked to, and tolerates missing ones", async () => {
    const store = await storeWith();
    const text = projectText("x");
    await store.write(headerFor(text, 1), text, live);
    await store.write(headerFor(text, 1, { sessionId: OTHER }), text, live);
    await store.remove([recordIdOf(SESSION, 1), recordIdOf(SESSION, 99)]);
    expect(await fs.readdir(dir)).toEqual([
      `${recordIdOf(OTHER, 1)}.layoutry-recovery`,
    ]);
  });
});
