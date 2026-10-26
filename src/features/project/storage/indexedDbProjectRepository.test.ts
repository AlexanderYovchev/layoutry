import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createIndexedDbProjectRepository,
  DOCUMENTS_STORE,
  PROJECT_DATABASE_NAME,
  SUMMARIES_STORE,
} from "@/features/project/storage/indexedDbProjectRepository";
import {
  ProjectStorageError,
  type ProjectRepository,
  type StoredProject,
} from "@/features/project/storage/projectRepository";
import type { ProjectMetadata } from "@/features/project/types/projectFile";

/**
 * The real adapter against fake-indexeddb, a spec-compliant in-memory
 * IndexedDB (transactions, aborts and atomicity behave as in browsers).
 * The browser e2e suite covers the same adapter on Chromium's own IndexedDB.
 */

function metadata(
  id: string,
  updatedAt: string,
  name = `Project ${id}`,
): ProjectMetadata {
  return { id, name, createdAt: "2026-10-01T00:00:00.000Z", updatedAt };
}

function stored(id: string, updatedAt: string, name?: string): StoredProject {
  const meta = metadata(id, updatedAt, name);
  return { metadata: meta, text: `{"project":"${id}","at":"${updatedAt}"}` };
}

function setup() {
  const factory = new IDBFactory();
  const repository = createIndexedDbProjectRepository({
    getFactory: () => factory,
  });
  return { factory, repository };
}

/** Writes raw values behind the adapter's back, e.g. corrupted records. */
async function rawPut(
  factory: IDBFactory,
  storeName: string,
  value: unknown,
): Promise<void> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(PROJECT_DATABASE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(value);
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
  });
  database.close();
}

async function storageError(
  promise: Promise<unknown>,
): Promise<ProjectStorageError> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  if (!(error instanceof ProjectStorageError))
    throw new Error(`expected a ProjectStorageError, got ${String(error)}`);
  return error;
}

async function names(repository: ProjectRepository): Promise<string[]> {
  return (await repository.list()).map((entry) =>
    entry.status === "ok" ? entry.summary.name : `unreadable:${entry.id}`,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("IndexedDB project repository", () => {
  it("starts empty", async () => {
    const { repository } = setup();
    expect(await repository.list()).toEqual([]);
  });

  it("writes, reads and finds a project", async () => {
    const { repository } = setup();
    const project = stored("a", "2026-10-02T00:00:00.000Z");
    await repository.write(project, { kind: "new" });

    expect(await repository.read("a")).toEqual(project);
    expect(await repository.find("a")).toEqual(project.metadata);
    expect(await repository.find("missing")).toBeNull();
  });

  it("lists projects most recently updated first", async () => {
    const { repository } = setup();
    await repository.write(stored("old", "2026-10-02T00:00:00.000Z", "Old"), {
      kind: "new",
    });
    await repository.write(stored("new", "2026-10-05T00:00:00Z", "Newest"), {
      kind: "new",
    });
    await repository.write(
      stored("mid", "2026-10-03T12:00:00.000Z", "Middle"),
      { kind: "new" },
    );

    expect(await names(repository)).toEqual(["Newest", "Middle", "Old"]);
  });

  it("updates a project in place without duplicating its id", async () => {
    const { repository } = setup();
    await repository.write(stored("a", "2026-10-02T00:00:00.000Z", "First"), {
      kind: "new",
    });
    await repository.write(stored("a", "2026-10-03T00:00:00.000Z", "Second"), {
      kind: "revision",
      updatedAt: "2026-10-02T00:00:00.000Z",
    });

    expect(await names(repository)).toEqual(["Second"]);
    expect((await repository.read("a")).text).toContain("2026-10-03");
  });

  describe("optimistic concurrency", () => {
    it("refuses a 'new' write over an existing id", async () => {
      const { repository } = setup();
      await repository.write(
        stored("a", "2026-10-02T00:00:00.000Z", "Original"),
        { kind: "new" },
      );

      const error = await storageError(
        repository.write(stored("a", "2026-10-09T00:00:00.000Z", "Intruder"), {
          kind: "new",
        }),
      );
      expect(error.code).toBe("conflict");
      expect(await names(repository)).toEqual(["Original"]);
    });

    it("refuses to overwrite a newer save made from another tab", async () => {
      const { repository } = setup();
      await repository.write(stored("a", "2026-10-02T00:00:00.000Z"), {
        kind: "new",
      });
      // Another tab saves first…
      await repository.write(
        stored("a", "2026-10-03T00:00:00.000Z", "Other tab"),
        {
          kind: "revision",
          updatedAt: "2026-10-02T00:00:00.000Z",
        },
      );
      // …so this tab's save, still based on the old revision, is refused.
      const error = await storageError(
        repository.write(stored("a", "2026-10-04T00:00:00.000Z", "This tab"), {
          kind: "revision",
          updatedAt: "2026-10-02T00:00:00.000Z",
        }),
      );
      expect(error.code).toBe("conflict");
      expect(await names(repository)).toEqual(["Other tab"]);
    });

    it("recreates a record deleted elsewhere instead of losing the save", async () => {
      const { repository } = setup();
      await repository.write(stored("a", "2026-10-02T00:00:00.000Z"), {
        kind: "new",
      });
      await repository.remove("a");
      await repository.write(stored("a", "2026-10-03T00:00:00.000Z", "Back"), {
        kind: "revision",
        updatedAt: "2026-10-02T00:00:00.000Z",
      });
      expect(await names(repository)).toEqual(["Back"]);
    });

    it("overwrites unconditionally only when asked to", async () => {
      const { repository } = setup();
      await repository.write(
        stored("a", "2026-10-05T00:00:00.000Z", "Library"),
        { kind: "new" },
      );
      await repository.write(
        stored("a", "2026-10-01T00:00:00.000Z", "Imported"),
        { kind: "overwrite" },
      );
      expect(await names(repository)).toEqual(["Imported"]);
    });

    it("serializes concurrent writes: both complete and the last one wins", async () => {
      const { repository } = setup();
      await Promise.all([
        repository.write(stored("a", "2026-10-02T00:00:00.000Z", "One"), {
          kind: "overwrite",
        }),
        repository.write(stored("a", "2026-10-03T00:00:00.000Z", "Two"), {
          kind: "overwrite",
        }),
      ]);
      expect(await names(repository)).toEqual(["Two"]);
    });
  });

  it("deletes a project permanently, leaving the others", async () => {
    const { repository } = setup();
    await repository.write(stored("a", "2026-10-02T00:00:00.000Z", "Keep"), {
      kind: "new",
    });
    await repository.write(stored("b", "2026-10-03T00:00:00.000Z", "Delete"), {
      kind: "new",
    });

    await repository.remove("b");

    expect(await names(repository)).toEqual(["Keep"]);
    expect((await storageError(repository.read("b"))).code).toBe("not-found");
    // Deleting something already gone is not an error.
    await expect(repository.remove("b")).resolves.toBeUndefined();
  });

  it("reports a missing project as not-found", async () => {
    const { repository } = setup();
    const error = await storageError(repository.read("nope"));
    expect(error.code).toBe("not-found");
  });

  describe("corrupted records", () => {
    it("lists an unreadable summary separately so it can still be deleted", async () => {
      const { factory, repository } = setup();
      await repository.write(
        stored("good", "2026-10-02T00:00:00.000Z", "Good"),
        { kind: "new" },
      );
      await rawPut(factory, SUMMARIES_STORE, { id: "bad", name: 42 });

      expect(await names(repository)).toEqual(["Good", "unreadable:bad"]);
      expect((await storageError(repository.read("bad"))).code).toBe(
        "corrupted",
      );

      await repository.remove("bad");
      expect(await names(repository)).toEqual(["Good"]);
    });

    it("treats a summary without its document as corrupted", async () => {
      const { factory, repository } = setup();
      await repository.list();
      await rawPut(
        factory,
        SUMMARIES_STORE,
        metadata("orphan", "2026-10-02T00:00:00.000Z"),
      );
      expect((await storageError(repository.read("orphan"))).code).toBe(
        "corrupted",
      );
    });

    it("treats a malformed document record as corrupted", async () => {
      const { factory, repository } = setup();
      await repository.write(stored("a", "2026-10-02T00:00:00.000Z"), {
        kind: "new",
      });
      await rawPut(factory, DOCUMENTS_STORE, {
        id: "a",
        text: { not: "text" },
      });
      expect((await storageError(repository.read("a"))).code).toBe("corrupted");
    });
  });

  describe("storage failures", () => {
    it("reports missing IndexedDB as unavailable", async () => {
      const repository = createIndexedDbProjectRepository({
        getFactory: () => undefined,
      });
      const error = await storageError(repository.list());
      expect(error.code).toBe("unavailable");
      expect(error.message).toMatch(/download your project/);
    });

    it("reports a browser that throws on access (privacy settings) as unavailable", async () => {
      const repository = createIndexedDbProjectRepository({
        getFactory: () => {
          throw new DOMException("denied", "SecurityError");
        },
      });
      expect((await storageError(repository.list())).code).toBe("unavailable");
    });

    it("reports a refused open as unavailable and retries on the next call", async () => {
      const factory = new IDBFactory();
      const open = vi.spyOn(factory, "open").mockImplementationOnce(() => {
        throw new DOMException("private mode", "InvalidStateError");
      });
      const repository = createIndexedDbProjectRepository({
        getFactory: () => factory,
      });

      expect((await storageError(repository.list())).code).toBe("unavailable");
      await expect(repository.list()).resolves.toEqual([]);
      expect(open).toHaveBeenCalledTimes(2);
    });

    it("maps a full disk to quota-exceeded and writes nothing", async () => {
      const { repository } = setup();
      await repository.write(
        stored("a", "2026-10-02T00:00:00.000Z", "Before"),
        { kind: "new" },
      );
      vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(() => {
        throw new DOMException("full", "QuotaExceededError");
      });

      const error = await storageError(
        repository.write(stored("a", "2026-10-03T00:00:00.000Z", "After"), {
          kind: "revision",
          updatedAt: "2026-10-02T00:00:00.000Z",
        }),
      );
      expect(error.code).toBe("quota-exceeded");
      vi.restoreAllMocks();
      expect(await names(repository)).toEqual(["Before"]);
    });

    it("is atomic: a failure after the summary was written rolls the whole project back", async () => {
      const { repository } = setup();
      await repository.write(
        stored("a", "2026-10-02T00:00:00.000Z", "Before"),
        { kind: "new" },
      );
      const realPut = IDBObjectStore.prototype.put;
      vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
        this: IDBObjectStore,
        value,
        key,
      ) {
        if (this.name === DOCUMENTS_STORE)
          throw new DOMException("disk error", "UnknownError");
        return realPut.call(this, value, key);
      });

      const error = await storageError(
        repository.write(
          stored("a", "2026-10-03T00:00:00.000Z", "Half written"),
          {
            kind: "revision",
            updatedAt: "2026-10-02T00:00:00.000Z",
          },
        ),
      );
      expect(error.code).toBe("failed");
      vi.restoreAllMocks();
      expect(await names(repository)).toEqual(["Before"]);
      expect((await repository.read("a")).text).toContain("2026-10-02");
    });

    it("reconnects after the database was closed by a newer tab's upgrade", async () => {
      const { factory, repository } = setup();
      await repository.write(stored("a", "2026-10-02T00:00:00.000Z", "Kept"), {
        kind: "new",
      });

      // A newer Layoutry tab upgrades the schema; this connection steps aside.
      await new Promise<void>((resolve, reject) => {
        const request = factory.open(PROJECT_DATABASE_NAME, 2);
        request.onsuccess = () => {
          request.result.close();
          resolve();
        };
        request.onerror = () => reject(request.error);
        request.onblocked = () =>
          reject(new Error("the old connection did not close"));
      });

      // The old adapter's version (1) is now too old to open: reported, not thrown raw.
      const error = await storageError(repository.list());
      expect(error.code).toBe("unavailable");
      expect(error.message).toMatch(/newer version of Layoutry/);
    });
  });
});
