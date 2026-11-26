import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * The canonical, versioned Layoutry project file (PROJECT-1.1) — see
 * docs/architecture/project-format.md. One format for browser storage,
 * desktop `.layoutry` files and future cloud storage.
 */

export const PROJECT_FILE_FORMAT = "layoutry-project";
export const CURRENT_PROJECT_FORMAT_VERSION = 4;
/**
 * The schema revision within the current format version (BC-17.2; BC-17.1.3
 * Report 1 §12). Format 4 evolves through numbered revisions while BC-17 is
 * built (N9): every later schema change, even a purely additive optional
 * field, is one revision step (4, r) → (4, r + 1). The revision number is
 * the ONLY signal that a step has run — never the presence or absence of a
 * field — and a file with a newer revision is refused, never stripped.
 */
export const CURRENT_PROJECT_FORMAT_REVISION = 0;
/** The first format version that carries formatRevision. */
export const REVISIONED_FORMAT_VERSION = 4;
export const PROJECT_FILE_EXTENSION = ".layoutry";
export const PROJECT_FILE_MEDIA_TYPE = "application/vnd.layoutry.project+json";
export const DEFAULT_PROJECT_NAME = "Untitled Project";

/**
 * Identity of a project. No file paths, owners, accounts or storage
 * locations: those belong to whichever store holds the file.
 */
export interface ProjectMetadata {
  /** Stable for the project's whole life; never regenerated on save. */
  id: string;
  name: string;
  /** ISO 8601 UTC, e.g. "2026-10-26T09:30:00.000Z". */
  createdAt: string;
  /** ISO 8601 UTC. Changed only when a caller explicitly touches it. */
  updatedAt: string;
}

/** The exact JSON shape written to disk / storage, current version. */
export interface ProjectFile {
  format: typeof PROJECT_FILE_FORMAT;
  formatVersion: typeof CURRENT_PROJECT_FORMAT_VERSION;
  formatRevision: typeof CURRENT_PROJECT_FORMAT_REVISION;
  project: ProjectMetadata;
  /** The editor's authored document root (tag "page"), unchanged in shape. */
  document: EditorElementNode;
}

/** The in-memory project: what serialization consumes and loading returns. */
export interface LayoutryProject {
  metadata: ProjectMetadata;
  document: EditorElementNode;
}

export type ProjectLoadErrorCode =
  | "too-large"
  | "invalid-json"
  | "not-a-project"
  | "unsupported-version"
  | "too-complex"
  | "forbidden-key"
  | "invalid-structure"
  | "integrity"
  /** The file itself couldn't be read (PROJECT-1.2 browser import). */
  | "unreadable"
  /** The file isn't UTF-8 text, so it can't be a project (PROJECT-1.5). */
  | "invalid-encoding"
  /** An older format couldn't be upgraded to the current one (PROJECT-1.5). */
  | "migration-failed";

export interface ProjectLoadError {
  code: ProjectLoadErrorCode;
  /** Human-readable, safe to show to a user. */
  message: string;
  /** Location in the file, e.g. "document.children[2].tag", when known. */
  path?: string;
}

export type ProjectLoadResult =
  | { ok: true; project: LayoutryProject }
  | { ok: false; error: ProjectLoadError };
