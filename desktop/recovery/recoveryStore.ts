import { promises as nodeFs } from "node:fs";
import path from "node:path";
import {
  errnoOf,
  fingerprintOf,
  MAX_PROJECT_FILE_BYTES,
  nodeProjectFileOps,
  ProjectFileError,
  replaceFileAtomically,
  type ProjectFileOps,
  type WriteHooks,
} from "../files/projectFileSystem";
import {
  DEFAULT_RECOVERY_LIMITS,
  encodeRecord,
  MAX_HEADER_BYTES,
  parseHeader,
  RECORD_ID_PATTERN,
  recordFileName,
  RECOVERY_FILE_EXTENSION,
  RECOVERY_TEMP_EXTENSION,
  selectRecordsToEvict,
  sessionIdOf,
  type RecoveryHeader,
  type RecoveryLimits,
} from "./recoveryRecord";

/**
 * The desktop recovery folder (PROJECT-1.4): one app-owned directory under
 * the user-data folder, holding only `<recordId>.layoutry-recovery` files.
 * Main process only. Record ids are validated before they become file
 * names, the folder itself must be a real directory (not a junction or
 * symbolic link), and links inside it are never followed. Writes reuse
 * the atomic replace of project files. Anything else in the folder is
 * left alone.
 */

export type RecoveryStoreErrorCode =
  | "unavailable"
  | "not-found"
  | "damaged"
  | "unsupported-version"
  | "disk-full"
  | "permission-denied"
  | "failed";

export class RecoveryStoreError extends Error {
  constructor(readonly code: RecoveryStoreErrorCode) {
    super(`Recovery storage: ${code}`);
    this.name = "RecoveryStoreError";
  }
}

export type StoredRecoveryEntry =
  | { status: "ok"; header: RecoveryHeader; bytes: number }
  | {
      status: "damaged";
      recordId: string;
      sessionId: string;
      reason: "unreadable" | "unsupported-version";
    };

export interface RecoveryStoreOptions {
  directory: string;
  limits?: RecoveryLimits;
  ops?: ProjectFileOps;
  writeHooks?: WriteHooks;
}

const MAX_RECORD_BYTES = MAX_HEADER_BYTES + MAX_PROJECT_FILE_BYTES;
const TEMP_FILE_PATTERN = new RegExp(
  `^\\.[0-9a-f]{32}-[0-9]{1,9}\\.[0-9a-f]+${RECOVERY_TEMP_EXTENSION.replace(".", "\\.")}$`,
);

function storeErrorFrom(error: unknown): RecoveryStoreError {
  if (error instanceof RecoveryStoreError) return error;
  if (error instanceof ProjectFileError) {
    if (error.code === "disk-full") return new RecoveryStoreError("disk-full");
    if (error.code === "permission-denied" || error.code === "locked")
      return new RecoveryStoreError("permission-denied");
    return new RecoveryStoreError("failed");
  }
  switch (errnoOf(error)) {
    case "ENOSPC":
    case "EDQUOT":
      return new RecoveryStoreError("disk-full");
    case "EACCES":
    case "EPERM":
    case "EROFS":
      return new RecoveryStoreError("permission-denied");
    default:
      return new RecoveryStoreError("failed");
  }
}

/** Reads the header line without loading the project text. */
async function readHeaderLine(
  filePath: string,
): Promise<{ line: string; size: number } | null> {
  const handle = await nodeFs.open(filePath, "r");
  try {
    const { size } = await handle.stat();
    const length = Math.min(size, MAX_HEADER_BYTES);
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, 0);
    const newline = buffer.subarray(0, bytesRead).indexOf(0x0a);
    if (newline < 0) return null;
    return { line: buffer.subarray(0, newline).toString("utf8"), size };
  } finally {
    await handle.close();
  }
}

export function createRecoveryStore(options: RecoveryStoreOptions) {
  const { directory } = options;
  const limits = options.limits ?? DEFAULT_RECOVERY_LIMITS;
  const ops = options.ops ?? nodeProjectFileOps;

  function recordPath(recordId: string): string {
    if (!RECORD_ID_PATTERN.test(recordId))
      throw new RecoveryStoreError("not-found");
    return path.join(directory, recordFileName(recordId));
  }

  /** The folder must be a real directory: never a junction or link elsewhere. */
  async function checkDirectory(): Promise<void> {
    let stat;
    try {
      stat = await nodeFs.lstat(directory);
    } catch {
      throw new RecoveryStoreError("unavailable");
    }
    if (stat.isSymbolicLink() || !stat.isDirectory())
      throw new RecoveryStoreError("unavailable");
  }

  async function list(): Promise<StoredRecoveryEntry[]> {
    await checkDirectory();
    let names;
    try {
      names = await nodeFs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      throw storeErrorFrom(error);
    }
    const entries: StoredRecoveryEntry[] = [];
    for (const entry of names) {
      // Dirent.isFile() is false for links and junctions: never followed.
      if (!entry.isFile() || !entry.name.endsWith(RECOVERY_FILE_EXTENSION))
        continue;
      const recordId = entry.name.slice(0, -RECOVERY_FILE_EXTENSION.length);
      const sessionId = sessionIdOf(recordId);
      if (sessionId === null) continue;
      let head: { line: string; size: number } | null;
      try {
        head = await readHeaderLine(path.join(directory, entry.name));
      } catch {
        head = null;
      }
      const parsed = head ? parseHeader(head.line) : null;
      if (
        head &&
        parsed?.ok &&
        parsed.header.recordId === recordId &&
        // Truncated by an interrupted write or edited: not a whole record.
        Buffer.byteLength(head.line, "utf8") + 1 + parsed.header.textBytes ===
          head.size
      ) {
        entries.push({ status: "ok", header: parsed.header, bytes: head.size });
      } else {
        entries.push({
          status: "damaged",
          recordId,
          sessionId,
          reason:
            parsed && !parsed.ok && parsed.reason === "unsupported-version"
              ? "unsupported-version"
              : "unreadable",
        });
      }
    }
    return entries;
  }

  async function remove(recordIds: readonly string[]): Promise<void> {
    let failed = false;
    for (const recordId of recordIds) {
      if (!RECORD_ID_PATTERN.test(recordId)) continue;
      try {
        await ops.unlink(recordPath(recordId));
      } catch (error) {
        if (errnoOf(error) !== "ENOENT") failed = true;
      }
    }
    if (failed) throw new RecoveryStoreError("failed");
  }

  return {
    directory,

    /**
     * Creates the folder if needed and removes temporary files left by
     * writes that were interrupted (crash, power loss). Only one Layoutry
     * runs per profile (single-instance lock), so no write is in flight.
     */
    async prepare(): Promise<{ removedTempFiles: number }> {
      try {
        await nodeFs.mkdir(directory, { recursive: true });
      } catch {
        throw new RecoveryStoreError("unavailable");
      }
      await checkDirectory();
      let removedTempFiles = 0;
      const names = await nodeFs
        .readdir(directory, { withFileTypes: true })
        .catch(() => []);
      for (const entry of names) {
        if (!entry.isFile() || !TEMP_FILE_PATTERN.test(entry.name)) continue;
        try {
          await ops.unlink(path.join(directory, entry.name));
          removedTempFiles += 1;
        } catch {
          // Still held by antivirus: harmless, retried next start.
        }
      }
      return { removedTempFiles };
    },

    list,

    /** The whole record, verified complete and unchanged. */
    async read(
      recordId: string,
    ): Promise<{ header: RecoveryHeader; text: string }> {
      const filePath = recordPath(recordId);
      await checkDirectory();
      let stat;
      try {
        stat = await ops.lstat(filePath);
      } catch (error) {
        throw errnoOf(error) === "ENOENT"
          ? new RecoveryStoreError("not-found")
          : storeErrorFrom(error);
      }
      if (
        stat.isSymbolicLink() ||
        !stat.isFile() ||
        stat.size > MAX_RECORD_BYTES
      )
        throw new RecoveryStoreError("damaged");
      let bytes: Buffer;
      try {
        bytes = await ops.readFile(filePath);
      } catch (error) {
        throw errnoOf(error) === "ENOENT"
          ? new RecoveryStoreError("not-found")
          : storeErrorFrom(error);
      }
      const newline = bytes.indexOf(0x0a);
      if (newline < 0 || newline > MAX_HEADER_BYTES)
        throw new RecoveryStoreError("damaged");
      const parsed = parseHeader(bytes.subarray(0, newline).toString("utf8"));
      if (!parsed.ok)
        throw new RecoveryStoreError(
          parsed.reason === "unsupported-version"
            ? "unsupported-version"
            : "damaged",
        );
      const textBytes = bytes.subarray(newline + 1);
      if (
        parsed.header.recordId !== recordId ||
        textBytes.length !== parsed.header.textBytes ||
        fingerprintOf(textBytes).sha256 !== parsed.header.sha256
      )
        throw new RecoveryStoreError("damaged");
      return { header: parsed.header, text: textBytes.toString("utf8") };
    },

    /**
     * Commits one snapshot atomically, then applies the retention policy.
     * A failed retention pass never undoes the committed snapshot.
     */
    async write(
      header: RecoveryHeader,
      text: string,
      retention: { liveSessionIds: ReadonlySet<string> },
    ): Promise<void> {
      const filePath = recordPath(header.recordId);
      await checkDirectory();
      try {
        await replaceFileAtomically(
          filePath,
          encodeRecord(header, text),
          {
            tempExtension: RECOVERY_TEMP_EXTENSION,
            maxBytes: MAX_RECORD_BYTES,
          },
          ops,
          options.writeHooks,
        );
      } catch (error) {
        throw storeErrorFrom(error);
      }

      try {
        const entries = await list();
        const evict = selectRecordsToEvict(
          entries.flatMap((entry) =>
            entry.status === "ok"
              ? [
                  {
                    recordId: entry.header.recordId,
                    sessionId: entry.header.sessionId,
                    projectId: entry.header.projectId,
                    generation: entry.header.generation,
                    savedAt: Date.parse(entry.header.savedAt),
                    bytes: entry.bytes,
                  },
                ]
              : [],
          ),
          {
            ownSessionId: header.sessionId,
            liveSessionIds: retention.liveSessionIds,
            keep: header.recordId,
            limits,
          },
        );
        await remove(evict);
      } catch {
        // Retention is retried after the next snapshot.
      }
    },

    remove,
  };
}

export type RecoveryStore = ReturnType<typeof createRecoveryStore>;
