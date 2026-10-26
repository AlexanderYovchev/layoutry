import type { ProjectMetadata } from "@/features/project/types/projectFile";

/**
 * The storage boundary of the project feature (PROJECT-1.2). Commands and
 * UI talk only to this interface; the browser library implements it with
 * IndexedDB, and PROJECT-1.3 can add a desktop filesystem implementation
 * without touching the editor or the commands.
 *
 * A repository stores already-serialized `.layoutry` text. It never
 * parses or validates documents — that stays in parseProjectFile.
 */
export interface ProjectRepository {
  /** Every project in the library, most recently updated first. */
  list(): Promise<ProjectLibraryEntry[]>;
  /** Summary of one project, or null when it isn't in the library. */
  find(id: string): Promise<ProjectMetadata | null>;
  /** The stored record. Rejects with `not-found` or `corrupted`. */
  read(id: string): Promise<StoredProject>;
  /**
   * Writes a whole project atomically. Resolves only once the write is
   * durable (the IndexedDB transaction has completed).
   */
  write(project: StoredProject, expectation: WriteExpectation): Promise<void>;
  /** Permanently removes a project. Removing a missing id succeeds. */
  remove(id: string): Promise<void>;
}

export interface StoredProject {
  /** Must equal the metadata inside `text`. */
  metadata: ProjectMetadata;
  /** Canonical `.layoutry` text produced by serializeProject. */
  text: string;
}

/**
 * Optimistic concurrency for writes, checked inside the same transaction
 * as the write so two tabs can never interleave a check and a write.
 */
export type WriteExpectation =
  /** A brand-new record: fails with `conflict` if the id already exists. */
  | { kind: "new" }
  /**
   * Updating the record this session last read or wrote: fails with
   * `conflict` if another tab or window has saved it since. A record
   * deleted in the meantime is simply recreated.
   */
  | { kind: "revision"; updatedAt: string }
  /** Replace whatever is stored. Only for an explicit user choice. */
  | { kind: "overwrite" };

export type ProjectLibraryEntry =
  | { status: "ok"; summary: ProjectMetadata }
  /** A record whose summary can't be read. It can still be deleted. */
  | { status: "unreadable"; id: string };

export type ProjectStorageErrorCode =
  /** No IndexedDB, or the browser refuses it (some private modes, policy). */
  | "unavailable"
  /** An older Layoutry tab is holding the database open during an upgrade. */
  | "blocked"
  | "quota-exceeded"
  | "not-found"
  | "conflict"
  | "corrupted"
  | "failed";

export class ProjectStorageError extends Error {
  constructor(
    readonly code: ProjectStorageErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProjectStorageError";
  }
}
