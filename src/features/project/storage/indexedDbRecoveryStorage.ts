import { z } from "zod";
import {
  DEFAULT_RECOVERY_LIMITS,
  selectRecordsToEvict,
  type RecoveryLimits,
} from "@/features/project/rules/recoveryPolicy";
import {
  storedRecoverySummarySchema,
  type StoredRecoverySummary,
} from "@/features/project/schemas/recoveryRecordSchema";
import {
  SESSION_LOCK_PREFIX,
  webRecoveryLocks,
  type RecoveryLocks,
} from "@/features/project/storage/recoveryLocks";
import {
  RecoveryStorageError,
  type RecoveryReadResult,
  type RecoveryStorage,
} from "@/features/project/storage/recoveryStorage";
import {
  CURRENT_RECOVERY_RECORD_VERSION,
  RECOVERY_RECORD_FORMAT,
  RECOVERY_RECORD_ID_PATTERN,
  recoveryRecordId,
  type RecoveryListEntry,
  type RecoveryRecordSummary,
} from "@/features/project/types/recoveryRecord";

/**
 * Browser recovery snapshots (PROJECT-1.4), in their own IndexedDB
 * database — never in the project library's (`layoutry-projects` is not
 * upgraded or touched at all). Schema, version 1:
 * - `summaries` (keyPath "recordId"): the record without its text, so the
 *   startup scan never loads whole projects;
 * - `texts` (keyPath "recordId"): { recordId, text }.
 * A snapshot and its retention pass are one transaction: it is committed
 * whole or not at all, and an older one can never replace a newer one.
 */
export const RECOVERY_DATABASE_NAME = "layoutry-recovery";
export const RECOVERY_DATABASE_VERSION = 1;
const SUMMARIES = "summaries";
const TEXTS = "texts";

const textRecordSchema = z.strictObject({
  recordId: z.string(),
  text: z.string(),
});

const UNAVAILABLE_MESSAGE =
  "This browser isn't letting Layoutry keep recovery copies. Save your work to keep it.";

function errorFrom(error: unknown): RecoveryStorageError {
  if (error instanceof RecoveryStorageError) return error;
  const name = error instanceof DOMException ? error.name : "";
  if (name === "QuotaExceededError")
    return new RecoveryStorageError(
      "quota-exceeded",
      "There isn't enough browser storage for a recovery copy. Save your work, and free up space.",
    );
  if (
    name === "SecurityError" ||
    name === "InvalidStateError" ||
    name === "VersionError"
  )
    return new RecoveryStorageError("unavailable", UNAVAILABLE_MESSAGE);
  return new RecoveryStorageError(
    "failed",
    "Layoutry couldn't update its recovery copy. Save your work to keep it.",
  );
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(RECOVERY_DATABASE_NAME, RECOVERY_DATABASE_VERSION);
    } catch {
      reject(new RecoveryStorageError("unavailable", UNAVAILABLE_MESSAGE));
      return;
    }
    request.onupgradeneeded = () => {
      // Future versions add their own steps here, keeping existing records.
      const database = request.result;
      if (!database.objectStoreNames.contains(SUMMARIES))
        database.createObjectStore(SUMMARIES, { keyPath: "recordId" });
      if (!database.objectStoreNames.contains(TEXTS))
        database.createObjectStore(TEXTS, { keyPath: "recordId" });
    };
    request.onsuccess = () => {
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      resolve(request.result);
    };
    request.onerror = () => {
      settled = true;
      reject(new RecoveryStorageError("unavailable", UNAVAILABLE_MESSAGE));
    };
    request.onblocked = () => {
      settled = true;
      reject(
        new RecoveryStorageError(
          "blocked",
          "Another Layoutry tab is using an older version of recovery storage. Close other Layoutry tabs.",
        ),
      );
    };
  });
}

type Fail = (error: RecoveryStorageError) => void;

/** One transaction over both stores, settled only on complete or abort. */
function transact<T>(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  run: (
    stores: { summaries: IDBObjectStore; texts: IDBObjectStore },
    fail: Fail,
  ) => () => T,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction([SUMMARIES, TEXTS], mode);
    } catch (error) {
      reject(errorFrom(error));
      return;
    }
    let failure: RecoveryStorageError | null = null;
    const fail: Fail = (error) => {
      failure ??= error;
      try {
        transaction.abort();
      } catch {
        // Already finishing; onabort reports `failure`.
      }
    };
    let read: (() => T) | null = null;
    transaction.oncomplete = () => {
      try {
        if (!read) throw errorFrom(null);
        resolve(read());
      } catch (error) {
        reject(errorFrom(error));
      }
    };
    transaction.onabort = () => reject(failure ?? errorFrom(transaction.error));
    try {
      read = run(
        {
          summaries: transaction.objectStore(SUMMARIES),
          texts: transaction.objectStore(TEXTS),
        },
        fail,
      );
    } catch (error) {
      fail(errorFrom(error));
    }
  });
}

function parseSummary(value: unknown): StoredRecoverySummary | null {
  const result = storedRecoverySummarySchema.safeParse(value);
  return result.success ? result.data : null;
}

function summaryOf(stored: StoredRecoverySummary): RecoveryRecordSummary {
  return {
    recordId: stored.recordId,
    sessionId: stored.sessionId,
    generation: stored.generation,
    projectId: stored.projectId,
    projectName: stored.projectName,
    savedAt: stored.savedAt,
    source: stored.source,
    size: stored.size,
    sha256: stored.sha256,
    original: null,
  };
}

function rawField(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null
    ? Reflect.get(value, key)
    : undefined;
}

function damagedEntryOf(value: unknown): RecoveryListEntry | null {
  const recordId = rawField(value, "recordId");
  if (typeof recordId !== "string") return null;
  const match = RECOVERY_RECORD_ID_PATTERN.exec(recordId);
  if (!match) return null;
  const version = rawField(value, "recoveryVersion");
  return {
    status: "damaged",
    recordId,
    sessionId: match[1],
    reason:
      typeof version === "number" && version > CURRENT_RECOVERY_RECORD_VERSION
        ? "unsupported-version"
        : "unreadable",
  };
}

function randomSessionId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export interface IndexedDbRecoveryStorageOptions {
  /** Defaults to the global `indexedDB`; tests pass a fake. */
  getFactory?: () => IDBFactory | undefined;
  /** Defaults to navigator.locks; tests share in-memory locks between "tabs". */
  locks?: RecoveryLocks | null;
  createSessionId?: () => string;
  limits?: RecoveryLimits;
}

export function createIndexedDbRecoveryStorage(
  options: IndexedDbRecoveryStorageOptions = {},
): RecoveryStorage {
  const getFactory =
    options.getFactory ??
    (() => (typeof indexedDB === "undefined" ? undefined : indexedDB));
  const locks =
    options.locks === undefined ? webRecoveryLocks() : options.locks;
  const createSessionId = options.createSessionId ?? randomSessionId;
  const limits = options.limits ?? DEFAULT_RECOVERY_LIMITS;
  let connection: Promise<IDBDatabase> | null = null;
  let sessionId: string | null = null;
  /** Ended sessions this tab has claimed, with their lock releases. */
  const claims = new Map<string, () => void>();

  function database(): Promise<IDBDatabase> {
    if (!connection) {
      let factory: IDBFactory | undefined;
      try {
        factory = getFactory();
      } catch {
        return Promise.reject(
          new RecoveryStorageError("unavailable", UNAVAILABLE_MESSAGE),
        );
      }
      if (!factory)
        return Promise.reject(
          new RecoveryStorageError("unavailable", UNAVAILABLE_MESSAGE),
        );
      const opening = openDatabase(factory).then((opened) => {
        opened.onversionchange = () => {
          opened.close();
          if (connection === opening) connection = null;
        };
        opened.onclose = () => {
          if (connection === opening) connection = null;
        };
        return opened;
      });
      opening.catch(() => {
        if (connection === opening) connection = null;
      });
      connection = opening;
    }
    return connection;
  }

  function requireLocks(): RecoveryLocks {
    if (!locks)
      throw new RecoveryStorageError("unavailable", UNAVAILABLE_MESSAGE);
    return locks;
  }

  /** Session ids whose tab is still running (or that another tab has claimed). */
  async function liveSessionIds(): Promise<Set<string>> {
    const names = await requireLocks().heldNames();
    const ids = new Set<string>();
    for (const name of names)
      if (name.startsWith(SESSION_LOCK_PREFIX))
        ids.add(name.slice(SESSION_LOCK_PREFIX.length));
    return ids;
  }

  /** This tab may read or delete its own and its claimed sessions' records. */
  function accessible(recordId: string, live: ReadonlySet<string>): boolean {
    const match = RECOVERY_RECORD_ID_PATTERN.exec(recordId);
    if (!match) return false;
    const owner = match[1];
    return owner === sessionId || claims.has(owner) || !live.has(owner);
  }

  return {
    async beginSession() {
      if (sessionId) return sessionId;
      const id = createSessionId();
      const release = await requireLocks().tryHold(
        `${SESSION_LOCK_PREFIX}${id}`,
      );
      if (!release)
        throw new RecoveryStorageError("unavailable", UNAVAILABLE_MESSAGE);
      // Surfaces an unusable database now rather than at the first snapshot.
      await database();
      sessionId = id;
      return id;
    },

    async write(snapshot) {
      const own = sessionId;
      if (!own)
        throw new RecoveryStorageError("unavailable", UNAVAILABLE_MESSAGE);
      const live = await liveSessionIds();
      const db = await database();
      const recordId = recoveryRecordId(own, snapshot.generation);
      const summary: StoredRecoverySummary = {
        format: RECOVERY_RECORD_FORMAT,
        recoveryVersion: CURRENT_RECOVERY_RECORD_VERSION,
        recordId,
        sessionId: own,
        generation: snapshot.generation,
        projectId: snapshot.metadata.id,
        projectName: snapshot.metadata.name,
        savedAt: snapshot.savedAt,
        source:
          snapshot.source.kind === "file"
            ? { kind: "file", fileName: snapshot.source.fileName }
            : snapshot.source,
        size: snapshot.text.length,
        sha256: snapshot.sha256,
      };
      return transact(db, "readwrite", ({ summaries, texts }, fail) => {
        const all = summaries.getAll();
        all.onsuccess = () => {
          const values: unknown[] = all.result;
          const existing = values.flatMap((value) => {
            const parsed = parseSummary(value);
            return parsed ? [parsed] : [];
          });
          if (
            existing.some(
              (record) =>
                record.sessionId === own &&
                record.generation >= snapshot.generation,
            )
          ) {
            fail(
              new RecoveryStorageError(
                "stale",
                "A newer recovery copy already exists.",
              ),
            );
            return;
          }
          try {
            summaries.put(summary);
            texts.put({ recordId, text: snapshot.text });
            const evict = selectRecordsToEvict(
              [...existing, summary].map((record) => ({
                recordId: record.recordId,
                sessionId: record.sessionId,
                projectId: record.projectId,
                generation: record.generation,
                savedAt: Date.parse(record.savedAt),
                size: record.size,
              })),
              {
                ownSessionId: own,
                liveSessionIds: live,
                keep: recordId,
                limits,
              },
            );
            for (const id of evict) {
              summaries.delete(id);
              texts.delete(id);
            }
          } catch (error) {
            fail(errorFrom(error));
          }
        };
        return () => undefined;
      });
    },

    async listOrphans() {
      const live = await liveSessionIds();
      const db = await database();
      const values = await transact(db, "readonly", ({ summaries }) => {
        const all = summaries.getAll();
        return (): unknown[] => all.result;
      });
      const entries: RecoveryListEntry[] = [];
      for (const value of values) {
        const summary = parseSummary(value);
        if (summary) {
          if (live.has(summary.sessionId)) continue;
          entries.push({ status: "ok", summary: summaryOf(summary) });
        } else {
          const damaged = damagedEntryOf(value);
          if (damaged?.status === "damaged" && !live.has(damaged.sessionId))
            entries.push(damaged);
        }
      }
      return entries;
    },

    async read(recordId): Promise<RecoveryReadResult> {
      const live = await liveSessionIds();
      if (!accessible(recordId, live))
        throw new RecoveryStorageError(
          "in-use",
          "This recovered work belongs to a Layoutry tab that is still open.",
        );
      const db = await database();
      return transact(db, "readonly", ({ summaries, texts }) => {
        const summaryRequest = summaries.get(recordId);
        const textRequest = texts.get(recordId);
        return () => {
          const raw: unknown = summaryRequest.result;
          if (raw === undefined)
            throw new RecoveryStorageError(
              "not-found",
              "This recovered work is no longer available.",
            );
          const summary = parseSummary(raw);
          const text = textRecordSchema.safeParse(textRequest.result);
          if (!summary) {
            const damaged = damagedEntryOf(raw);
            throw damaged?.status === "damaged" &&
              damaged.reason === "unsupported-version"
              ? new RecoveryStorageError(
                  "unsupported-version",
                  "This recovered work was made by a newer version of Layoutry.",
                )
              : new RecoveryStorageError(
                  "damaged",
                  "This recovered work is damaged and can't be restored.",
                );
          }
          if (!text.success || text.data.recordId !== recordId)
            throw new RecoveryStorageError(
              "damaged",
              "This recovered work is damaged and can't be restored.",
            );
          return {
            summary: summaryOf(summary),
            text: text.data.text,
            file: null,
            matchesOriginal: false,
          };
        };
      });
    },

    async remove(recordIds) {
      const live = await liveSessionIds();
      const allowed = recordIds.filter((id) => accessible(id, live));
      if (allowed.length === 0) return;
      const db = await database();
      await transact(db, "readwrite", ({ summaries, texts }) => {
        for (const id of allowed) {
          summaries.delete(id);
          texts.delete(id);
        }
        return () => undefined;
      });
    },

    async claim(sessionIds) {
      const claimed: string[] = [];
      for (const id of sessionIds) {
        if (claims.has(id) || id === sessionId) {
          claimed.push(id);
          continue;
        }
        const release = await requireLocks().tryHold(
          `${SESSION_LOCK_PREFIX}${id}`,
        );
        if (release) {
          claims.set(id, release);
          claimed.push(id);
        }
      }
      return claimed;
    },

    release(sessionIds) {
      for (const id of sessionIds) {
        claims.get(id)?.();
        claims.delete(id);
      }
    },
  };
}

/** The browser's recovery storage, or null where it can't work (no IndexedDB, Web Locks or Web Crypto). */
export function createBrowserRecoveryStorage(): RecoveryStorage | null {
  if (
    typeof indexedDB === "undefined" ||
    typeof navigator === "undefined" ||
    !("locks" in navigator) ||
    typeof crypto === "undefined" ||
    typeof crypto.subtle?.digest !== "function"
  )
    return null;
  return createIndexedDbRecoveryStorage();
}
