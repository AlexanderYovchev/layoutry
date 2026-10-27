/**
 * Recovery snapshots (PROJECT-1.4): automatic copies of unsaved work,
 * stored apart from saved projects — see
 * docs/architecture/project-recovery.md.
 *
 * A snapshot is never a Save: it never replaces a library record or a
 * `.layoutry` file, never clears unsaved changes and never changes where
 * the project is saved. Its project text is the canonical `.layoutry`
 * text from serializeProject; `recoveryVersion` versions only the record
 * around it.
 */

export const RECOVERY_RECORD_FORMAT = "layoutry-recovery";
export const CURRENT_RECOVERY_RECORD_VERSION = 1;

export const RECOVERY_SESSION_ID_PATTERN = /^[0-9a-f]{32}$/;
/** `<sessionId>-<generation>` — the same ids in the browser and on desktop. */
export const RECOVERY_RECORD_ID_PATTERN = /^([0-9a-f]{32})-([1-9][0-9]{0,8})$/;

export function recoveryRecordId(
  sessionId: string,
  generation: number,
): string {
  return `${sessionId}-${generation}`;
}

/** Where the work came from: display data and the conflict baseline. */
export type RecoverySource =
  | { kind: "unsaved" }
  /** `revision`: the library `updatedAt` the session last read or wrote. */
  | { kind: "library"; revision: string }
  | { kind: "file"; fileName: string };

/** The saved copy now, compared with the version the session last saw. */
export type OriginalState =
  "unchanged" | "modified" | "missing" | "unavailable";

export interface RecoveryRecordSummary {
  recordId: string;
  /** One editor session: a browser tab's or desktop window's page load. */
  sessionId: string;
  /** Increases with every snapshot of the session. */
  generation: number;
  projectId: string;
  projectName: string;
  /** ISO 8601 UTC. */
  savedAt: string;
  source: RecoverySource;
  /** Length of the project text (characters in the browser, bytes on desktop). */
  size: number;
  /** SHA-256 of the project text's UTF-8 bytes, hex. */
  sha256: string;
  /** Desktop native files only; null elsewhere. */
  original: OriginalState | null;
}

export type RecoveryListEntry =
  | { status: "ok"; summary: RecoveryRecordSummary }
  | {
      status: "damaged";
      recordId: string;
      sessionId: string;
      reason: "unreadable" | "unsupported-version";
    };

export interface RecoveryVersion {
  recordId: string;
  generation: number;
  savedAt: string;
  /** Known to be unrestorable (failed its integrity checks). */
  damaged: boolean;
}

/**
 * Recovered work of one project from one ended session — what the
 * recovery dialog offers. Versions are newest first.
 */
export interface RecoveryGroup {
  key: string;
  sessionId: string;
  projectId: string;
  projectName: string;
  source: RecoverySource;
  original: OriginalState | null;
  versions: RecoveryVersion[];
  /** False when no version passed validation: it can only be discarded. */
  restorable: boolean;
}
