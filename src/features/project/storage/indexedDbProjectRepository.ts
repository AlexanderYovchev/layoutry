import { z } from "zod";
import { projectMetadataSchema } from "@/features/project/schemas/projectFileSchema";
import {
  ProjectStorageError,
  type ProjectLibraryEntry,
  type ProjectRepository,
  type StoredProject,
  type WriteExpectation,
} from "@/features/project/storage/projectRepository";
import type { ProjectMetadata } from "@/features/project/types/projectFile";

/**
 * The browser project library (PROJECT-1.2), in IndexedDB.
 *
 * Schema, version 1 — see docs/architecture/project-storage.md:
 * - `summaries` (keyPath "id"): { id, name, createdAt, updatedAt }. Listing
 *   reads only these, so it never loads whole projects into memory.
 * - `documents` (keyPath "id"): { id, text } — the canonical `.layoutry`
 *   text from serializeProject.
 * Every write and delete touches both stores in one transaction, so a
 * project is either fully written or not at all.
 */
export const PROJECT_DATABASE_NAME = "layoutry-projects";
export const PROJECT_DATABASE_VERSION = 1;
export const SUMMARIES_STORE = "summaries";
export const DOCUMENTS_STORE = "documents";

const documentRecordSchema = z.strictObject({
  id: z.string(),
  text: z.string(),
});

const UNAVAILABLE_MESSAGE =
  "This browser isn't letting Layoutry store projects. Private browsing or site-data settings can block it. You can still download your project as a .layoutry file.";

function storageErrorFrom(
  error: unknown,
  fallback: "unavailable" | "failed",
): ProjectStorageError {
  if (error instanceof ProjectStorageError) return error;
  const name = error instanceof DOMException ? error.name : "";
  if (name === "QuotaExceededError")
    return new ProjectStorageError(
      "quota-exceeded",
      "There isn't enough storage space to save this project. Delete projects you no longer need, or download this project as a .layoutry file.",
    );
  if (name === "VersionError")
    return new ProjectStorageError(
      "unavailable",
      "A newer version of Layoutry has upgraded the project library. Reload this page to continue.",
    );
  if (
    fallback === "unavailable" ||
    name === "SecurityError" ||
    name === "InvalidStateError"
  )
    return new ProjectStorageError("unavailable", UNAVAILABLE_MESSAGE);
  return new ProjectStorageError(
    "failed",
    "The project library couldn't complete the operation. Nothing was changed. Try again.",
  );
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(PROJECT_DATABASE_NAME, PROJECT_DATABASE_VERSION);
    } catch (error) {
      reject(storageErrorFrom(error, "unavailable"));
      return;
    }
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SUMMARIES_STORE))
        database.createObjectStore(SUMMARIES_STORE, { keyPath: "id" });
      if (!database.objectStoreNames.contains(DOCUMENTS_STORE))
        database.createObjectStore(DOCUMENTS_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => {
      // Opened after we already gave up on a blocked upgrade: don't leak it.
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      resolve(request.result);
    };
    request.onerror = () => {
      settled = true;
      reject(storageErrorFrom(request.error, "unavailable"));
    };
    request.onblocked = () => {
      settled = true;
      reject(
        new ProjectStorageError(
          "blocked",
          "Another Layoutry tab is using an older version of the project library. Close other Layoutry tabs and try again.",
        ),
      );
    };
  });
}

type Fail = (error: ProjectStorageError) => void;

/**
 * Runs one transaction over both stores and settles only when it has
 * completed (durable) or aborted — never on an individual request's
 * success. `run` queues requests and returns a reader for the result.
 */
function transact<T>(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  run: (
    stores: { summaries: IDBObjectStore; documents: IDBObjectStore },
    fail: Fail,
  ) => () => T,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction(
        [SUMMARIES_STORE, DOCUMENTS_STORE],
        mode,
      );
    } catch (error) {
      reject(storageErrorFrom(error, "failed"));
      return;
    }
    let failure: ProjectStorageError | null = null;
    const fail: Fail = (error) => {
      failure ??= error;
      try {
        transaction.abort();
      } catch {
        // Already finishing or aborted; onabort reports `failure`.
      }
    };
    let read: (() => T) | null = null;
    transaction.oncomplete = () => {
      try {
        if (!read) throw storageErrorFrom(null, "failed");
        resolve(read());
      } catch (error) {
        reject(storageErrorFrom(error, "failed"));
      }
    };
    transaction.onabort = () =>
      reject(failure ?? storageErrorFrom(transaction.error, "failed"));
    try {
      read = run(
        {
          summaries: transaction.objectStore(SUMMARIES_STORE),
          documents: transaction.objectStore(DOCUMENTS_STORE),
        },
        fail,
      );
    } catch (error) {
      fail(storageErrorFrom(error, "failed"));
    }
  });
}

function parseSummary(value: unknown): ProjectMetadata | null {
  const result = projectMetadataSchema.safeParse(value);
  return result.success ? result.data : null;
}

function idOf(value: unknown): string | null {
  if (typeof value !== "object" || value === null || !("id" in value))
    return null;
  return typeof value.id === "string" ? value.id : null;
}

function corrupted(): ProjectStorageError {
  return new ProjectStorageError(
    "corrupted",
    "This saved project is damaged and can't be opened. You can delete it from the library.",
  );
}

export interface IndexedDbProjectRepositoryOptions {
  /** Defaults to the global `indexedDB`; tests pass a fake. */
  getFactory?: () => IDBFactory | undefined;
}

export function createIndexedDbProjectRepository(
  options: IndexedDbProjectRepositoryOptions = {},
): ProjectRepository {
  const getFactory =
    options.getFactory ??
    (() => (typeof indexedDB === "undefined" ? undefined : indexedDB));
  let connection: Promise<IDBDatabase> | null = null;

  function database(): Promise<IDBDatabase> {
    if (!connection) {
      let factory: IDBFactory | undefined;
      try {
        factory = getFactory();
      } catch (error) {
        // Some browsers throw SecurityError just for touching `indexedDB`.
        return Promise.reject(storageErrorFrom(error, "unavailable"));
      }
      if (!factory)
        return Promise.reject(
          new ProjectStorageError("unavailable", UNAVAILABLE_MESSAGE),
        );
      const opening = openDatabase(factory).then((opened) => {
        // Let a newer Layoutry tab upgrade the schema; reconnect next time.
        opened.onversionchange = () => {
          opened.close();
          if (connection === opening) connection = null;
        };
        opened.onclose = () => {
          if (connection === opening) connection = null;
        };
        return opened;
      });
      // A failed open is retried on the next call rather than cached.
      opening.catch(() => {
        if (connection === opening) connection = null;
      });
      connection = opening;
    }
    return connection;
  }

  return {
    async list() {
      const db = await database();
      return transact(db, "readonly", ({ summaries }) => {
        const request = summaries.getAll();
        return () => {
          const ok: ProjectMetadata[] = [];
          const unreadable: ProjectLibraryEntry[] = [];
          const values: unknown[] = request.result;
          for (const value of values) {
            const summary = parseSummary(value);
            if (summary) ok.push(summary);
            else {
              const id = idOf(value);
              if (id !== null) unreadable.push({ status: "unreadable", id });
            }
          }
          ok.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
          return [
            ...ok.map((summary): ProjectLibraryEntry => ({
              status: "ok",
              summary,
            })),
            ...unreadable,
          ];
        };
      });
    },

    async find(id) {
      const db = await database();
      return transact(db, "readonly", ({ summaries }) => {
        const request = summaries.get(id);
        return () =>
          request.result === undefined ? null : parseSummary(request.result);
      });
    },

    async read(id) {
      const db = await database();
      return transact(db, "readonly", ({ summaries, documents }) => {
        const summaryRequest = summaries.get(id);
        const documentRequest = documents.get(id);
        return () => {
          if (summaryRequest.result === undefined)
            throw new ProjectStorageError(
              "not-found",
              "This project is no longer in the library. It may have been deleted in another tab or window.",
            );
          const summary = parseSummary(summaryRequest.result);
          const record = documentRecordSchema.safeParse(documentRequest.result);
          if (!summary || !record.success || record.data.id !== id)
            throw corrupted();
          return {
            metadata: summary,
            text: record.data.text,
          } satisfies StoredProject;
        };
      });
    },

    async write(project, expectation: WriteExpectation) {
      const db = await database();
      const { metadata, text } = project;
      return transact(db, "readwrite", ({ summaries, documents }, fail) => {
        const existing = summaries.get(metadata.id);
        existing.onsuccess = () => {
          const current: unknown = existing.result;
          const currentUpdatedAt = parseSummary(current)?.updatedAt;
          if (expectation.kind === "new" && current !== undefined) {
            fail(
              new ProjectStorageError(
                "conflict",
                "A project with the same id is already in the library.",
              ),
            );
            return;
          }
          if (
            expectation.kind === "revision" &&
            currentUpdatedAt !== undefined &&
            currentUpdatedAt !== expectation.updatedAt
          ) {
            fail(
              new ProjectStorageError(
                "conflict",
                "This project was saved from another tab or window since you opened it. Use Save As to keep your version as a separate project.",
              ),
            );
            return;
          }
          try {
            summaries.put({ ...metadata });
            documents.put({ id: metadata.id, text });
          } catch (error) {
            fail(storageErrorFrom(error, "failed"));
          }
        };
        return () => undefined;
      });
    },

    async remove(id) {
      const db = await database();
      return transact(db, "readwrite", ({ summaries, documents }) => {
        summaries.delete(id);
        documents.delete(id);
        return () => undefined;
      });
    },
  };
}
