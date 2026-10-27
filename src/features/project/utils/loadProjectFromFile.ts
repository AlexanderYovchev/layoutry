import {
  DEFAULT_PROJECT_LIMITS,
  type ProjectLimits,
} from "@/features/project/rules/projectLimits";
import type { ProjectLoadResult } from "@/features/project/types/projectFile";
import { parseProjectFile } from "@/features/project/utils/parseProjectFile";

/**
 * Most UTF-8 bytes one UTF-16 code unit can take (a surrogate pair is 4
 * bytes for 2 units), so a file larger than this many bytes per allowed
 * character can't fit the character limit and is refused unread.
 */
const MAX_UTF8_BYTES_PER_CHARACTER = 3;

/**
 * Reads a user-chosen `.layoutry` file (browser File API) and validates
 * it with parseProjectFile. Never evaluates content and never touches
 * editor state; resolves to a result, never rejects.
 *
 * Decoding is strict UTF-8, like the desktop app's (PROJECT-1.5): a byte
 * order mark is skipped, but bytes that aren't UTF-8 are refused rather
 * than silently replaced with U+FFFD — loading those would change the
 * text the moment the project is saved again.
 */
export async function loadProjectFromFile(
  file: Blob,
  limits: ProjectLimits = DEFAULT_PROJECT_LIMITS,
): Promise<ProjectLoadResult> {
  if (file.size > limits.maxFileCharacters * MAX_UTF8_BYTES_PER_CHARACTER)
    return {
      ok: false,
      error: {
        code: "too-large",
        message: "This file is too large to be a Layoutry project.",
      },
    };
  let bytes: ArrayBuffer;
  try {
    bytes = await file.arrayBuffer();
  } catch {
    return {
      ok: false,
      error: {
        code: "unreadable",
        message:
          "The file couldn't be read. It may have been moved or deleted.",
      },
    };
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return {
      ok: false,
      error: {
        code: "invalid-encoding",
        message:
          "The file isn't a Layoutry project: it isn't UTF-8 text. It may be damaged or be another kind of file.",
      },
    };
  }
  return parseProjectFile(text, limits);
}
