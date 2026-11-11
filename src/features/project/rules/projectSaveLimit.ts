import { MAX_PROJECT_NAME_LENGTH } from "@/features/project/rules/projectName";
import { DEFAULT_PROJECT_LIMITS, type ProjectLimits } from "@/features/project/rules/projectLimits";
import type { ProjectMetadata } from "@/features/project/types/projectFile";
import type { EditorElementNode } from "@/features/editor/types/document";
import { formatProjectFileText } from "@/features/project/utils/serializeProject";

const TIMESTAMP = "2000-01-01T00:00:00.000Z";

/**
 * The largest metadata a project can carry once written (BC-07.2): the
 * longest id the schema admits and the longest name, made only of lone
 * surrogates, which JSON writes as six-character `\uXXXX` escapes, the
 * worst any character can cost. Timestamps always have the same length.
 * Measuring with this metadata means a later rename can never push a
 * document that passed over the limit.
 */
const WORST_CASE_METADATA: ProjectMetadata = {
  id: "x".repeat(128),
  name: "\uD800".repeat(MAX_PROJECT_NAME_LENGTH),
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
};

/**
 * Whether `document` can still be saved (BC-07.2): the length of the exact
 * `.layoutry` text Save writes (formatProjectFileText, the same function
 * serializeProject uses) against the same `maxFileCharacters` limit
 * parseProjectFile enforces. That one limit covers every place a project is
 * written: the browser library and recovery store this text in IndexedDB,
 * and the desktop app's own write limit (MAX_PROJECT_TEXT_LENGTH) is the
 * same 16 Mi characters, so a document that fits here saves everywhere.
 *
 * Only the size is checked. The element-count and depth limits are not
 * affected by what an upload, paste or duplicate changes in a source.
 * A document that cannot be written at all (a non-finite number) is
 * reported as not fitting.
 *
 * Cost: one canonical copy and one JSON.stringify of the document, so
 * callers run it once per change being committed, never per render.
 */
export function documentFitsProjectFile(document: EditorElementNode, limits: ProjectLimits = DEFAULT_PROJECT_LIMITS): boolean {
  try {
    return formatProjectFileText({ metadata: WORST_CASE_METADATA, document }).length <= limits.maxFileCharacters;
  } catch {
    return false;
  }
}
