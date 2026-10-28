// Public API of the project feature: the versioned `.layoutry` format and
// its pure serialization (PROJECT-1.1), and project management on top of a
// storage interface — the browser library in IndexedDB (PROJECT-1.2).
export {
  CURRENT_PROJECT_FORMAT_VERSION,
  DEFAULT_PROJECT_NAME,
  PROJECT_FILE_EXTENSION,
  PROJECT_FILE_FORMAT,
  PROJECT_FILE_MEDIA_TYPE,
  type LayoutryProject,
  type ProjectFile,
  type ProjectLoadError,
  type ProjectLoadErrorCode,
  type ProjectLoadResult,
  type ProjectMetadata,
} from "@/features/project/types/projectFile";
export {
  DEFAULT_PROJECT_LIMITS,
  type ProjectLimits,
} from "@/features/project/rules/projectLimits";
export { parseProjectFile } from "@/features/project/utils/parseProjectFile";
export {
  createProjectMetadata,
  ProjectSerializationError,
  serializeProject,
  touchProjectMetadata,
} from "@/features/project/utils/serializeProject";

// PROJECT-1.2: browser project library and project management.
export { ProjectWorkspace } from "@/features/project/components/ProjectWorkspace";
export {
  createProjectCommands,
  type ImportMode,
  type ProjectCommandError,
  type ProjectCommandResult,
  type ProjectCommands,
} from "@/features/project/commands/projectCommands";
export {
  ProjectStorageError,
  type ProjectLibraryEntry,
  type ProjectRepository,
  type ProjectStorageErrorCode,
  type StoredProject,
  type WriteExpectation,
} from "@/features/project/storage/projectRepository";
export { createIndexedDbProjectRepository } from "@/features/project/storage/indexedDbProjectRepository";
export { loadProjectFromFile } from "@/features/project/utils/loadProjectFromFile";
export {
  normalizeProjectName,
  MAX_PROJECT_NAME_LENGTH,
} from "@/features/project/rules/projectName";
export type { CodeExportIntegration } from "@/features/project/components/ProjectWorkspace";
