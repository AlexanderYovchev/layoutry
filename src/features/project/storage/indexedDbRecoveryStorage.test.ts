import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createIndexedDbProjectRepository } from "@/features/project/storage/indexedDbProjectRepository";
import {
  createIndexedDbRecoveryStorage,
  RECOVERY_DATABASE_NAME,
} from "@/features/project/storage/indexedDbRecoveryStorage";
import {
  createMemoryRecoveryLocks,
  SESSION_LOCK_PREFIX,
} from "@/features/project/storage/recoveryLocks";
import {
  RecoveryStorageError,
  type RecoverySnapshotWrite,
} from "@/features/project/storage/recoveryStorage";
import { recoveryRecordId } from "@/features/project/types/recoveryRecord";
import { pageWith } from "@/features/project/utils/projectTestDocuments";
import {
  createProjectMetadata,
  serializeProject,
} from "@/features/project/utils/serializeProject";
import { sha256Hex } from "@/features/project/utils/sha256Hex";

/** PROJECT-1.4 browser recovery storage on fake-indexeddb, with simulated tabs. */

const TAB_A = "a".repeat(32);
const TAB_B = "b".repeat(32);

function browser() {
  const factory = new IDBFactory();
  const locks = createMemoryRecoveryLocks();
  /** One tab of this browser profile. */
  const tab = (sessionId: string) =>
    createIndexedDbRecoveryStorage({
      getFactory: () => factory,
      locks: locks.locks,
      createSessionId: () => sessionId,
    });
  return {
    factory,
    tab,
    /** The browser drops a closed or crashed tab's locks. */
    endTab: (sessionId: string) =>
      locks.drop(`${SESSION_LOCK_PREFIX}${sessionId}`),
  };
}

const project = {
  metadata: createProjectMetadata({ id: "project-1", name: "Website" }),
  document: pageWith({ id: "h", tag: "h1", text: "Draft" }),
};

async function snapshot(
  generation: number,
  overrides: Partial<RecoverySnapshotWrite> = {},
): Promise<RecoverySnapshotWrite> {
  const text = serializeProject(project);
  return {
    generation,
    metadata: project.metadata,
    source: { kind: "unsaved" },
    savedAt: new Date(Date.UTC(2026, 9, 28, 9, generation)).toISOString(),
    sha256: await sha256Hex(text),
    text,
    ...overrides,
  };
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  if (!(error instanceof RecoveryStorageError))
    throw new Error(`expected a RecoveryStorageError, got ${String(error)}`);
  return error.code;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("browser recovery storage", () => {
  it("writes and reads a snapshot back exactly", async () => {
    const { tab } = browser();
    const storage = tab(TAB_A);
    await storage.beginSession();
    const written = await snapshot(1);
    await storage.write(written);
    const read = await storage.read(recoveryRecordId(TAB_A, 1), {
      forRestore: true,
    });
    expect(read.text).toBe(written.text);
    expect(read.summary).toMatchObject({
      projectId: "project-1",
      projectName: "Website",
      generation: 1,
      sha256: written.sha256,
      source: { kind: "unsaved" },
    });
    expect(read.file).toBeNull();
  });

  it("refuses an older or repeated generation", async () => {
    const storage = browser().tab(TAB_A);
    await storage.beginSession();
    await storage.write(await snapshot(3));
    expect(await codeOf(storage.write(await snapshot(2)))).toBe("stale");
    expect(await codeOf(storage.write(await snapshot(3)))).toBe("stale");
  });

  it("keeps a running tab's work private and offers it once the tab has ended", async () => {
    const { tab, endTab } = browser();
    const a = tab(TAB_A);
    const b = tab(TAB_B);
    await a.beginSession();
    await b.beginSession();
    await a.write(await snapshot(1));

    expect(await b.listOrphans()).toEqual([]);
    expect(
      await codeOf(b.read(recoveryRecordId(TAB_A, 1), { forRestore: false })),
    ).toBe("in-use");
    await b.remove([recoveryRecordId(TAB_A, 1)]);
    expect(
      await a.read(recoveryRecordId(TAB_A, 1), { forRestore: false }),
    ).toBeTruthy();

    endTab(TAB_A); // tab A crashes
    expect(await b.listOrphans()).toMatchObject([
      { status: "ok", summary: { recordId: recoveryRecordId(TAB_A, 1) } },
    ]);
  });

  it("only one tab can claim crashed work, so it is never offered twice at once", async () => {
    const { tab, endTab } = browser();
    const crashed = tab(TAB_A);
    await crashed.beginSession();
    await crashed.write(await snapshot(1));
    endTab(TAB_A);

    const b = tab(TAB_B);
    const c = tab("c".repeat(32));
    await b.beginSession();
    await c.beginSession();
    expect(await b.claim([TAB_A])).toEqual([TAB_A]);
    expect(await c.claim([TAB_A])).toEqual([]);
    expect(await c.listOrphans()).toEqual([]);
    b.release([TAB_A]); // Keep for Later
    expect(await c.listOrphans()).toHaveLength(1);
  });

  it("two tabs editing the same project never overwrite each other's snapshots", async () => {
    const { tab } = browser();
    const a = tab(TAB_A);
    const b = tab(TAB_B);
    await a.beginSession();
    await b.beginSession();
    await a.write(await snapshot(1));
    await b.write(await snapshot(1));
    expect(
      (await a.read(recoveryRecordId(TAB_A, 1), { forRestore: false })).summary
        .sessionId,
    ).toBe(TAB_A);
    expect(
      (await b.read(recoveryRecordId(TAB_B, 1), { forRestore: false })).summary
        .sessionId,
    ).toBe(TAB_B);
  });

  it("keeps the newest five snapshots per project", async () => {
    const { tab, endTab } = browser();
    const storage = tab(TAB_A);
    await storage.beginSession();
    for (let generation = 1; generation <= 7; generation += 1)
      await storage.write(await snapshot(generation));
    endTab(TAB_A);
    const reader = tab(TAB_B);
    await reader.beginSession();
    const generations = (await reader.listOrphans())
      .flatMap((entry) =>
        entry.status === "ok" ? [entry.summary.generation] : [],
      )
      .sort((x, y) => x - y);
    expect(generations).toEqual([3, 4, 5, 6, 7]);
  });

  it("reports corrupted and newer-version records as damaged instead of failing the scan", async () => {
    const { tab, factory, endTab } = browser();
    const storage = tab(TAB_A);
    await storage.beginSession();
    await storage.write(await snapshot(1));
    // Damage the stored records directly.
    await new Promise<void>((resolve, reject) => {
      const request = factory.open(RECOVERY_DATABASE_NAME);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(["summaries", "texts"], "readwrite");
        transaction.objectStore("summaries").put({
          recordId: recoveryRecordId(TAB_A, 2),
          recoveryVersion: 7,
        });
        transaction.objectStore("texts").delete(recoveryRecordId(TAB_A, 1));
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
      };
    });
    endTab(TAB_A);
    const reader = tab(TAB_B);
    await reader.beginSession();
    const entries = await reader.listOrphans();
    expect(entries).toContainEqual({
      status: "damaged",
      recordId: recoveryRecordId(TAB_A, 2),
      sessionId: TAB_A,
      reason: "unsupported-version",
    });
    expect(
      await codeOf(
        reader.read(recoveryRecordId(TAB_A, 1), { forRestore: false }),
      ),
    ).toBe("damaged");
    expect(
      await codeOf(
        reader.read(recoveryRecordId(TAB_A, 2), { forRestore: false }),
      ),
    ).toBe("unsupported-version");
  });

  it("reports a full disk as quota-exceeded and stores nothing", async () => {
    const storage = browser().tab(TAB_A);
    await storage.beginSession();
    await storage.write(await snapshot(1));
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementationOnce(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    expect(await codeOf(storage.write(await snapshot(2)))).toBe(
      "quota-exceeded",
    );
    expect(
      await codeOf(
        storage.read(recoveryRecordId(TAB_A, 2), { forRestore: false }),
      ),
    ).toBe("not-found");
    expect(
      (await storage.read(recoveryRecordId(TAB_A, 1), { forRestore: false }))
        .text,
    ).toBe((await snapshot(1)).text);
  });

  it("is unavailable without IndexedDB or Web Locks — the editor goes on without it", async () => {
    const noDatabase = createIndexedDbRecoveryStorage({
      getFactory: () => undefined,
      locks: createMemoryRecoveryLocks().locks,
    });
    expect(await codeOf(noDatabase.beginSession())).toBe("unavailable");
    const noLocks = createIndexedDbRecoveryStorage({
      getFactory: () => new IDBFactory(),
      locks: null,
    });
    expect(await codeOf(noLocks.beginSession())).toBe("unavailable");
  });

  it("reports a database upgraded by a newer Layoutry as unavailable, deleting nothing", async () => {
    const factory = new IDBFactory();
    await new Promise<void>((resolve) => {
      const request = factory.open(RECOVERY_DATABASE_NAME, 5);
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
    });
    const storage = createIndexedDbRecoveryStorage({
      getFactory: () => factory,
      locks: createMemoryRecoveryLocks().locks,
    });
    expect(await codeOf(storage.beginSession())).toBe("unavailable");
  });

  it("lives in its own database: the project library is never upgraded or touched", async () => {
    const { factory, tab } = browser();
    const library = createIndexedDbProjectRepository({
      getFactory: () => factory,
    });
    await library.write(
      { metadata: project.metadata, text: serializeProject(project) },
      { kind: "new" },
    );
    const storage = tab(TAB_A);
    await storage.beginSession();
    await storage.write(await snapshot(1));
    await storage.remove([recoveryRecordId(TAB_A, 1)]);

    const databases = await factory.databases();
    expect(
      databases.map((database) => [database.name, database.version]).sort(),
    ).toEqual([
      ["layoutry-projects", 1],
      ["layoutry-recovery", 1],
    ]);
    expect(await library.list()).toMatchObject([
      { status: "ok", summary: { id: "project-1" } },
    ]);
  });
});
