import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * The canonical, versioned Layoutry project file (PROJECT-1.1) — see
 * docs/architecture/project-format.md. One format for browser storage,
 * desktop `.layoutry` files and future cloud storage.
 */

export const PROJECT_FILE_FORMAT = "layoutry-project";
export const CURRENT_PROJECT_FORMAT_VERSION = 1;
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
  | "unreadable";

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
