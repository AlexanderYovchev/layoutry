// Public API of the project feature (PROJECT-1.1): the versioned
// `.layoutry` format and its pure serialization. Storage (browser,
// desktop files, cloud) lives elsewhere and builds on these.
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
