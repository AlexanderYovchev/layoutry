/**
 * Desktop recovery snapshots (PROJECT-1.4): the on-disk record format and
 * the retention policy. Main process only — see
 * docs/architecture/project-recovery.md.
 *
 * A record is one file, `<recordId>.layoutry-recovery`, in the app-owned
 * `Recovery` folder under the user-data directory:
 *
 *   line 1: the header, as one line of JSON (no project text)
 *   rest:   the canonical `.layoutry` project text, byte for byte
 *
 * Listing reads only the header line. The header's `textBytes` and
 * `sha256` let every read prove the text is complete and unchanged.
 *
 * The record version (`recoveryVersion`) versions this envelope only. The
 * project text inside carries its own `formatVersion` and is loaded by the
 * normal project loader, migrations included.
 */

export const RECOVERY_RECORD_FORMAT = "layoutry-recovery";
export const RECOVERY_RECORD_VERSION = 1;
export const RECOVERY_FILE_EXTENSION = ".layoutry-recovery";
export const RECOVERY_TEMP_EXTENSION = ".recovery-tmp";

export const SESSION_ID_PATTERN = /^[0-9a-f]{32}$/;
/** `<sessionId>-<generation>`: never a path, safe as a file name. */
export const RECORD_ID_PATTERN = /^([0-9a-f]{32})-([1-9][0-9]{0,8})$/;
export const SHA256_PATTERN = /^[0-9a-f]{64}$/;
/** Project ids, as in the renderer's projectMetadataSchema. */
export const PROJECT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
export const MAX_GENERATION = 999_999_999;
/** Room for the longest Windows path in `association`. */
export const MAX_HEADER_BYTES = 128 * 1024;

export interface RecoveryLimits {
  /** Newest snapshots kept for one project in one session. */
  snapshotsPerProject: number;
  /** All records together, in bytes on disk. */
  maxTotalBytes: number;
  maxRecords: number;
}

/**
 * 5 versions per project. 256 MiB in total holds five snapshots of even a
 * 48 MiB project (the largest file Layoutry opens); real projects are
 * kilobytes to a few megabytes. 100 records bounds the startup scan.
 */
export const DEFAULT_RECOVERY_LIMITS: RecoveryLimits = {
  snapshotsPerProject: 5,
  maxTotalBytes: 256 * 1024 * 1024,
  maxRecords: 100,
};

/** Where the work came from. Display data only — never a capability. */
export type RecoverySource =
  | { kind: "unsaved" }
  | { kind: "library"; revision: string }
  | { kind: "file"; fileName: string };

/**
 * The native file the session was editing and the version of it the
 * session last read or wrote. Main-process only: never sent to the
 * renderer, and never trusted as a capability by itself (see
 * recoveryService.ts).
 */
export interface RecoveryAssociation {
  path: string;
  size: number;
  sha256: string;
}

export interface RecoveryHeader {
  format: typeof RECOVERY_RECORD_FORMAT;
  recoveryVersion: typeof RECOVERY_RECORD_VERSION;
  recordId: string;
  sessionId: string;
  generation: number;
  projectId: string;
  projectName: string;
  /** ISO 8601 UTC, when the main process committed the snapshot. */
  savedAt: string;
  source: RecoverySource;
  textBytes: number;
  sha256: string;
  association: RecoveryAssociation | null;
}

export function recordIdOf(sessionId: string, generation: number): string {
  return `${sessionId}-${generation}`;
}

export function recordFileName(recordId: string): string {
  return `${recordId}${RECOVERY_FILE_EXTENSION}`;
}

/** The session id a well-formed record id or record file name belongs to. */
export function sessionIdOf(recordId: string): string | null {
  return RECORD_ID_PATTERN.exec(recordId)?.[1] ?? null;
}

export function encodeRecord(header: RecoveryHeader, text: string): Buffer {
  return Buffer.concat([
    Buffer.from(`${JSON.stringify(header)}\n`, "utf8"),
    Buffer.from(text, "utf8"),
  ]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value: unknown, max: number): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= max
  );
}

function parseSource(value: unknown): RecoverySource | null {
  if (!isRecord(value)) return null;
  if (value.kind === "unsaved") return { kind: "unsaved" };
  if (value.kind === "library" && typeof value.revision === "string")
    return { kind: "library", revision: value.revision };
  if (value.kind === "file" && typeof value.fileName === "string")
    return { kind: "file", fileName: value.fileName };
  return null;
}

function parseAssociation(value: unknown): RecoveryAssociation | null | false {
  if (value === null) return null;
  if (
    !isRecord(value) ||
    typeof value.path !== "string" ||
    !isCount(value.size, Number.MAX_SAFE_INTEGER) ||
    typeof value.sha256 !== "string" ||
    !SHA256_PATTERN.test(value.sha256)
  )
    return false;
  return { path: value.path, size: value.size, sha256: value.sha256 };
}

export type HeaderParseResult =
  | { ok: true; header: RecoveryHeader }
  | { ok: false; reason: "unreadable" | "unsupported-version" };

/** Validates a header line read from disk. Never throws. */
export function parseHeader(line: string): HeaderParseResult {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return { ok: false, reason: "unreadable" };
  }
  if (!isRecord(value) || value.format !== RECOVERY_RECORD_FORMAT)
    return { ok: false, reason: "unreadable" };
  if (
    typeof value.recoveryVersion === "number" &&
    Number.isInteger(value.recoveryVersion) &&
    value.recoveryVersion > RECOVERY_RECORD_VERSION
  )
    return { ok: false, reason: "unsupported-version" };
  const source = parseSource(value.source);
  const association = parseAssociation(value.association);
  if (
    value.recoveryVersion !== RECOVERY_RECORD_VERSION ||
    typeof value.recordId !== "string" ||
    typeof value.sessionId !== "string" ||
    !SESSION_ID_PATTERN.test(value.sessionId) ||
    !isCount(value.generation, MAX_GENERATION) ||
    value.recordId !== recordIdOf(value.sessionId, value.generation) ||
    typeof value.projectId !== "string" ||
    !PROJECT_ID_PATTERN.test(value.projectId) ||
    typeof value.projectName !== "string" ||
    typeof value.savedAt !== "string" ||
    Number.isNaN(Date.parse(value.savedAt)) ||
    !source ||
    !isCount(value.textBytes, Number.MAX_SAFE_INTEGER) ||
    typeof value.sha256 !== "string" ||
    !SHA256_PATTERN.test(value.sha256) ||
    association === false
  )
    return { ok: false, reason: "unreadable" };
  return {
    ok: true,
    header: {
      format: RECOVERY_RECORD_FORMAT,
      recoveryVersion: RECOVERY_RECORD_VERSION,
      recordId: value.recordId,
      sessionId: value.sessionId,
      generation: value.generation,
      projectId: value.projectId,
      projectName: value.projectName,
      savedAt: value.savedAt,
      source,
      textBytes: value.textBytes,
      sha256: value.sha256,
      association,
    },
  };
}

export interface RetentionEntry {
  recordId: string;
  sessionId: string;
  projectId: string;
  generation: number;
  /** Milliseconds since the epoch. */
  savedAt: number;
  bytes: number;
}

/**
 * Which records to delete after `keep` was committed. Pure.
 *
 * 1. The writing session keeps its newest `snapshotsPerProject` snapshots
 *    of each project.
 * 2. Over the global budget, older snapshots go, oldest first: first
 *    those that are neither the newest nor the second newest of their
 *    project, then second-newest ones. The newest snapshot of every
 *    project is never deleted, nor is `keep`, nor anything belonging to
 *    another session that is still running.
 *
 * The browser applies the same policy (src/features/project/rules/recoveryRetention.ts).
 */
export function selectRecordsToEvict(
  records: readonly RetentionEntry[],
  context: {
    ownSessionId: string;
    liveSessionIds: ReadonlySet<string>;
    keep: string;
    limits: RecoveryLimits;
  },
): string[] {
  const { ownSessionId, liveSessionIds, keep, limits } = context;
  const evict = new Set<string>();
  const rank = new Map<string, number>();

  const groups = new Map<string, RetentionEntry[]>();
  for (const record of records) {
    const key = `${record.sessionId}/${record.projectId}`;
    const group = groups.get(key);
    if (group) group.push(record);
    else groups.set(key, [record]);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => b.generation - a.generation);
    group.forEach((record, index) => {
      rank.set(record.recordId, index);
      if (
        record.sessionId === ownSessionId &&
        index >= limits.snapshotsPerProject &&
        record.recordId !== keep
      )
        evict.add(record.recordId);
    });
  }

  const remaining = records.filter((record) => !evict.has(record.recordId));
  let totalBytes = remaining.reduce((sum, record) => sum + record.bytes, 0);
  let count = remaining.length;
  const overBudget = () =>
    totalBytes > limits.maxTotalBytes || count > limits.maxRecords;
  if (!overBudget()) return [...evict];

  const tier = (record: RetentionEntry) =>
    (rank.get(record.recordId) ?? 0) >= 2 ? 0 : 1;
  const candidates = remaining
    .filter(
      (record) =>
        record.recordId !== keep &&
        (rank.get(record.recordId) ?? 0) >= 1 &&
        (record.sessionId === ownSessionId ||
          !liveSessionIds.has(record.sessionId)),
    )
    .sort((a, b) => tier(a) - tier(b) || a.savedAt - b.savedAt);
  for (const record of candidates) {
    if (!overBudget()) break;
    evict.add(record.recordId);
    totalBytes -= record.bytes;
    count -= 1;
  }
  return [...evict];
}
