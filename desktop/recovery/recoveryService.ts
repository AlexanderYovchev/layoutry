import { randomBytes } from "node:crypto";
import path from "node:path";
import type { FileCapabilityRegistry } from "../files/fileCapabilities";
import {
  expectKeys,
  expectToken,
  InvalidPayloadError,
  MAX_PROJECT_TEXT_LENGTH,
} from "../files/projectFileService";
import {
  assertProjectFilePath,
  fingerprintOf,
  nodeProjectFileOps,
  ProjectFileError,
  readProjectFile,
  type ProjectFileOps,
} from "../files/projectFileSystem";
import {
  MAX_GENERATION,
  PROJECT_ID_PATTERN,
  RECORD_ID_PATTERN,
  recordIdOf,
  RECOVERY_RECORD_FORMAT,
  RECOVERY_RECORD_VERSION,
  SHA256_PATTERN,
  sessionIdOf,
  type RecoveryAssociation,
  type RecoveryHeader,
  type RecoverySource,
} from "./recoveryRecord";
import { RecoveryStoreError, type RecoveryStore } from "./recoveryStore";

/**
 * Desktop recovery snapshots behind IPC (PROJECT-1.4), free of Electron so
 * it can be unit-tested. Every renderer payload is `unknown` and validated
 * here, like the project-file service.
 *
 * Sessions: each page load of the editor starts a session whose id the
 * main process generates and binds to that window. A session ends when its
 * page reloads, crashes or its window closes; its snapshots then become
 * "orphaned" — what the next start offers to restore. Snapshots of a
 * running session are never listed, read for restore or deleted by
 * anyone else.
 *
 * Paths never reach the renderer. A snapshot of a native file records the
 * file's path and the version the session last read or wrote, taken from
 * the window's own capability token — never from the payload. Restoring
 * issues a fresh token whose expected version is that pre-crash version,
 * so a file changed meanwhile is a conflict on Save, never overwritten.
 */

const MAX_REVISION_LENGTH = 64;
const MAX_FILE_NAME_LENGTH = 260;
const MAX_DISCARD_IDS = 500;

export interface ServiceError {
  code: string;
  message: string;
}

export type OriginalFileState =
  "unchanged" | "modified" | "missing" | "unavailable";

export interface RecoverySummary {
  recordId: string;
  sessionId: string;
  generation: number;
  projectId: string;
  projectName: string;
  savedAt: string;
  source: RecoverySource;
  /** Bytes of project text. */
  size: number;
  sha256: string;
  /** Native-file snapshots: the original file now, compared with the version the session last saw. */
  original: OriginalFileState | null;
}

export type ListEntry =
  | { status: "ok"; summary: RecoverySummary }
  | {
      status: "damaged";
      recordId: string;
      sessionId: string;
      reason: "unreadable" | "unsupported-version";
    };

export type BeginSessionResult = { sessionId: string };
export type WriteSnapshotResult =
  | { status: "written"; recordId: string }
  | { status: "stale" }
  | { status: "error"; error: ServiceError };
export type ListResult =
  | { status: "ok"; entries: ListEntry[] }
  | { status: "error"; error: ServiceError };
export type ReadResult =
  | {
      status: "ok";
      summary: RecoverySummary;
      text: string;
      /** For a restore: the original file, re-authorized for this window. */
      file: { token: string; fileName: string } | null;
      /** The original file already holds this exact project content. */
      matchesOriginal: boolean;
    }
  | { status: "error"; error: ServiceError };
export type DiscardResult =
  { status: "ok"; removed: number } | { status: "error"; error: ServiceError };

export interface RecoveryServiceOptions {
  store: RecoveryStore;
  registry: FileCapabilityRegistry;
  now?: () => Date;
  createSessionId?: () => string;
  /** Reads the original native files (injectable for tests). */
  ops?: ProjectFileOps;
}

const MESSAGES: Record<string, string> = {
  unavailable:
    "Layoutry can't use its recovery folder right now. Your work is still in the editor; save it to keep it.",
  "disk-full":
    "There isn't enough disk space for a recovery copy. Free up space, and save your work.",
  "permission-denied":
    "Layoutry doesn't have permission to write its recovery copy. Save your work to keep it.",
  "not-found": "This recovered work is no longer available.",
  damaged: "This recovered work is damaged and can't be restored.",
  "unsupported-version":
    "This recovered work was made by a newer version of Layoutry. Update Layoutry to restore it.",
  "in-use":
    "This recovered work belongs to a Layoutry window that is still open.",
  "no-session": "Recovery isn't active for this window. Restart Layoutry.",
  "verification-failed":
    "The recovery copy didn't arrive intact, so it wasn't stored. Layoutry will try again.",
  failed:
    "Layoutry couldn't update its recovery copy. Save your work to keep it.",
};

function serviceError(code: string): ServiceError {
  return { code, message: MESSAGES[code] ?? MESSAGES.failed };
}

function errorOf(error: unknown): { status: "error"; error: ServiceError } {
  return {
    status: "error",
    error: serviceError(
      error instanceof RecoveryStoreError ? error.code : "failed",
    ),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type SourcePayload =
  | { kind: "unsaved" }
  | { kind: "library"; revision: string }
  | { kind: "file"; token: string; fileName: string };

function expectSource(value: unknown): SourcePayload {
  if (!isRecord(value))
    throw new InvalidPayloadError("source must be an object");
  switch (value.kind) {
    case "unsaved":
      expectKeys(value, ["kind"]);
      return { kind: "unsaved" };
    case "library": {
      expectKeys(value, ["kind", "revision"]);
      if (
        typeof value.revision !== "string" ||
        value.revision.length > MAX_REVISION_LENGTH
      )
        throw new InvalidPayloadError("malformed library revision");
      return { kind: "library", revision: value.revision };
    }
    case "file": {
      expectKeys(value, ["kind", "token", "fileName"]);
      if (
        typeof value.fileName !== "string" ||
        value.fileName.length > MAX_FILE_NAME_LENGTH
      )
        throw new InvalidPayloadError("malformed file name");
      return {
        kind: "file",
        token: expectToken(value.token),
        fileName: path.win32.basename(path.posix.basename(value.fileName)),
      };
    }
    default:
      throw new InvalidPayloadError("unknown source kind");
  }
}

/** The project's identity, read from the text itself — never trusted from the payload. */
function expectProjectSnapshot(value: unknown): {
  text: string;
  id: string;
  name: string;
} {
  if (typeof value !== "string")
    throw new InvalidPayloadError("text must be a string");
  if (value.length > MAX_PROJECT_TEXT_LENGTH)
    throw new InvalidPayloadError("project text too large");
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new InvalidPayloadError("project text is not JSON");
  }
  const project = isRecord(parsed) ? parsed.project : null;
  if (
    !isRecord(parsed) ||
    parsed.format !== "layoutry-project" ||
    typeof parsed.formatVersion !== "number" ||
    !Number.isInteger(parsed.formatVersion) ||
    !isRecord(project) ||
    typeof project.id !== "string" ||
    !PROJECT_ID_PATTERN.test(project.id) ||
    typeof project.name !== "string" ||
    project.name.length > 256
  )
    throw new InvalidPayloadError("text is not a Layoutry project");
  return { text: value, id: project.id, name: project.name };
}

function expectRecordId(value: unknown): string {
  if (typeof value !== "string" || !RECORD_ID_PATTERN.test(value))
    throw new InvalidPayloadError("malformed recovery record id");
  return value;
}

/** Same id, name and document: the file already holds this work. */
function sameProjectContent(a: string, b: string): boolean {
  try {
    const left: unknown = JSON.parse(a);
    const right: unknown = JSON.parse(b);
    if (!isRecord(left) || !isRecord(right)) return false;
    const leftProject = left.project;
    const rightProject = right.project;
    return (
      isRecord(leftProject) &&
      isRecord(rightProject) &&
      leftProject.id === rightProject.id &&
      leftProject.name === rightProject.name &&
      JSON.stringify(left.document) === JSON.stringify(right.document)
    );
  } catch {
    return false;
  }
}

export function createRecoveryService(options: RecoveryServiceOptions) {
  const { store, registry } = options;
  const now = options.now ?? (() => new Date());
  const createSessionId =
    options.createSessionId ?? (() => randomBytes(16).toString("hex"));
  const ops = options.ops ?? nodeProjectFileOps;
  /** Running sessions, by window (webContents id). */
  const sessions = new Map<number, { id: string; lastGeneration: number }>();
  let prepared: Promise<void> | null = null;

  /** Prepares the folder once; a failure is retried on the next call. */
  function ready(): Promise<void> {
    prepared ??= store.prepare().then(
      () => undefined,
      (error: unknown) => {
        prepared = null;
        throw error;
      },
    );
    return prepared;
  }

  function liveSessionIds(): Set<string> {
    return new Set([...sessions.values()].map((session) => session.id));
  }

  /** May `owner` read or delete records of `sessionId`? Its own, or an ended session's. */
  function accessible(owner: number, sessionId: string): boolean {
    const own = sessions.get(owner)?.id;
    return sessionId === own || !liveSessionIds().has(sessionId);
  }

  async function originalOf(
    association: RecoveryAssociation | null,
  ): Promise<{ state: OriginalFileState; text: string | null } | null> {
    if (!association) return null;
    try {
      const { text, fingerprint } = await readProjectFile(
        association.path,
        ops,
      );
      return {
        state:
          fingerprint.sha256 === association.sha256 ? "unchanged" : "modified",
        text,
      };
    } catch (error) {
      return {
        state:
          error instanceof ProjectFileError && error.code === "not-found"
            ? "missing"
            : "unavailable",
        text: null,
      };
    }
  }

  function summaryOf(
    header: RecoveryHeader,
    original: OriginalFileState | null,
  ): RecoverySummary {
    return {
      recordId: header.recordId,
      sessionId: header.sessionId,
      generation: header.generation,
      projectId: header.projectId,
      projectName: header.projectName,
      savedAt: header.savedAt,
      source: header.source,
      size: header.textBytes,
      sha256: header.sha256,
      original,
    };
  }

  return {
    ready,
    liveSessionIds,

    /** A page load of the editor: a new session replaces the window's previous one. */
    beginSession(owner: number, payload: unknown): BeginSessionResult {
      if (payload !== undefined)
        throw new InvalidPayloadError("unexpected payload");
      const id = createSessionId();
      sessions.set(owner, { id, lastGeneration: 0 });
      return { sessionId: id };
    },

    /** The window's page crashed or its window closed: its snapshots are now orphaned. */
    endSession(owner: number): void {
      sessions.delete(owner);
    },

    async write(owner: number, payload: unknown): Promise<WriteSnapshotResult> {
      const request = expectKeys(payload, [
        "generation",
        "source",
        "sha256",
        "text",
      ]);
      const generation = request.generation;
      if (
        typeof generation !== "number" ||
        !Number.isInteger(generation) ||
        generation < 1 ||
        generation > MAX_GENERATION
      )
        throw new InvalidPayloadError("malformed generation");
      const source = expectSource(request.source);
      if (
        typeof request.sha256 !== "string" ||
        !SHA256_PATTERN.test(request.sha256)
      )
        throw new InvalidPayloadError("malformed sha256");
      const project = expectProjectSnapshot(request.text);

      const session = sessions.get(owner);
      if (!session)
        return { status: "error", error: serviceError("no-session") };
      // An older snapshot never replaces a newer one, even out of order.
      if (generation <= session.lastGeneration) return { status: "stale" };
      session.lastGeneration = generation;

      const bytes = Buffer.from(project.text, "utf8");
      const fingerprint = fingerprintOf(bytes);
      if (fingerprint.sha256 !== request.sha256)
        return { status: "error", error: serviceError("verification-failed") };

      let storedSource: RecoverySource;
      let association: RecoveryAssociation | null = null;
      if (source.kind === "file") {
        const capability = registry.resolve(owner, source.token);
        if (capability?.fingerprint)
          association = {
            path: capability.filePath,
            size: capability.fingerprint.size,
            sha256: capability.fingerprint.sha256,
          };
        storedSource = {
          kind: "file",
          fileName: capability?.fileName ?? source.fileName,
        };
      } else {
        storedSource = source;
      }

      const recordId = recordIdOf(session.id, generation);
      try {
        await ready();
        await store.write(
          {
            format: RECOVERY_RECORD_FORMAT,
            recoveryVersion: RECOVERY_RECORD_VERSION,
            recordId,
            sessionId: session.id,
            generation,
            projectId: project.id,
            projectName: project.name,
            savedAt: now().toISOString(),
            source: storedSource,
            textBytes: fingerprint.size,
            sha256: fingerprint.sha256,
            association,
          },
          project.text,
          { liveSessionIds: liveSessionIds() },
        );
        return { status: "written", recordId };
      } catch (error) {
        return errorOf(error);
      }
    },

    /** Snapshots of sessions that are no longer running. */
    async list(_owner: number, payload: unknown): Promise<ListResult> {
      if (payload !== undefined)
        throw new InvalidPayloadError("unexpected payload");
      try {
        await ready();
        const live = liveSessionIds();
        const originals = new Map<string, OriginalFileState | null>();
        const entries: ListEntry[] = [];
        for (const entry of await store.list()) {
          if (entry.status === "damaged") {
            if (!live.has(entry.sessionId)) entries.push(entry);
            continue;
          }
          const { header } = entry;
          if (live.has(header.sessionId)) continue;
          let original: OriginalFileState | null = null;
          if (header.association) {
            const key = `${header.association.path}\n${header.association.sha256}`;
            if (!originals.has(key))
              originals.set(
                key,
                (await originalOf(header.association))?.state ?? null,
              );
            original = originals.get(key) ?? null;
          }
          entries.push({ status: "ok", summary: summaryOf(header, original) });
        }
        return { status: "ok", entries };
      } catch (error) {
        return errorOf(error);
      }
    },

    async read(owner: number, payload: unknown): Promise<ReadResult> {
      const request = expectKeys(payload, ["recordId", "forRestore"]);
      const recordId = expectRecordId(request.recordId);
      if (typeof request.forRestore !== "boolean")
        throw new InvalidPayloadError("forRestore must be a boolean");
      const sessionId = sessionIdOf(recordId);
      if (sessionId === null || !accessible(owner, sessionId))
        return { status: "error", error: serviceError("in-use") };
      try {
        await ready();
        const { header, text } = await store.read(recordId);
        const original = await originalOf(header.association);
        let file: { token: string; fileName: string } | null = null;
        if (request.forRestore && header.association) {
          try {
            assertProjectFilePath(header.association.path);
            file = {
              token: registry.issue(owner, header.association.path, {
                size: header.association.size,
                sha256: header.association.sha256,
              }),
              fileName: path.basename(header.association.path),
            };
          } catch {
            file = null;
          }
        }
        return {
          status: "ok",
          summary: summaryOf(header, original?.state ?? null),
          text,
          file,
          matchesOriginal:
            original !== null &&
            original.text !== null &&
            sameProjectContent(original.text, text),
        };
      } catch (error) {
        return errorOf(error);
      }
    },

    async discard(owner: number, payload: unknown): Promise<DiscardResult> {
      const request = expectKeys(payload, ["recordIds"]);
      if (
        !Array.isArray(request.recordIds) ||
        request.recordIds.length > MAX_DISCARD_IDS
      )
        throw new InvalidPayloadError("recordIds must be a short array");
      const recordIds = request.recordIds.map(expectRecordId);
      const allowed = recordIds.filter((recordId) => {
        const sessionId = sessionIdOf(recordId);
        return sessionId !== null && accessible(owner, sessionId);
      });
      try {
        await ready();
        await store.remove(allowed);
        return { status: "ok", removed: allowed.length };
      } catch (error) {
        return errorOf(error);
      }
    },
  };
}

export type RecoveryService = ReturnType<typeof createRecoveryService>;
