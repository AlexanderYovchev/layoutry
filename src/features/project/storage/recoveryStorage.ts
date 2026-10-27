import type { ProjectMetadata } from "@/features/project/types/projectFile";
import type {
  RecoveryListEntry,
  RecoveryRecordSummary,
} from "@/features/project/types/recoveryRecord";

/**
 * Where recovery snapshots live (PROJECT-1.4): IndexedDB in a browser
 * (indexedDbRecoveryStorage.ts), the app-owned Recovery folder on desktop
 * (desktopRecoveryStorage.ts). The recovery coordinator talks only to this
 * interface. Never the project library, never a user's file.
 *
 * Sessions: each page load is one session. Snapshots of a running session
 * belong to it alone; when it ends (closed, crashed, killed) its snapshots
 * are "orphaned" and offered for restore by the next session.
 */
export interface RecoveryStorage {
  /** Starts this page's session; returns its id. */
  beginSession(): Promise<string>;
  /**
   * Commits one snapshot of this session, then applies retention. Rejects
   * with `stale` when the session already has this or a newer generation.
   */
  write(snapshot: RecoverySnapshotWrite): Promise<void>;
  /** Snapshots of sessions that are no longer running, without their text. */
  listOrphans(): Promise<RecoveryListEntry[]>;
  /**
   * One snapshot with its text. `forRestore` (desktop) also re-authorizes
   * the original native file for Save.
   */
  read(
    recordId: string,
    options: { forRestore: boolean },
  ): Promise<RecoveryReadResult>;
  /** Deletes this session's or ended sessions' snapshots. Missing ids are fine. */
  remove(recordIds: readonly string[]): Promise<void>;
  /**
   * Claims ended sessions while this page offers them, so two tabs never
   * offer — or restore — the same work. Returns the ids claimed.
   */
  claim(sessionIds: readonly string[]): Promise<string[]>;
  release(sessionIds: readonly string[]): void;
}

export interface RecoverySnapshotWrite {
  generation: number;
  metadata: ProjectMetadata;
  source:
    | { kind: "unsaved" }
    | { kind: "library"; revision: string }
    /** `token`: the desktop file capability; the main process records the file. */
    | { kind: "file"; fileName: string; token: string };
  /** ISO 8601 UTC. */
  savedAt: string;
  sha256: string;
  /** Canonical `.layoutry` text from serializeProject. */
  text: string;
}

export interface RecoveryReadResult {
  summary: RecoveryRecordSummary;
  text: string;
  /** Desktop restore: the original file, authorized again for this window. */
  file: { token: string; fileName: string } | null;
  /** Desktop: the original file already holds this exact work. */
  matchesOriginal: boolean;
}

export type RecoveryStorageErrorCode =
  | "unavailable"
  | "blocked"
  | "quota-exceeded"
  | "stale"
  | "not-found"
  | "damaged"
  | "unsupported-version"
  | "in-use"
  | "failed";

export class RecoveryStorageError extends Error {
  constructor(
    readonly code: RecoveryStorageErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RecoveryStorageError";
  }
}
