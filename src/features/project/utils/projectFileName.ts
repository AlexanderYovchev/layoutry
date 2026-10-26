import {
  DEFAULT_PROJECT_NAME,
  PROJECT_FILE_EXTENSION,
} from "@/features/project/types/projectFile";

const MAX_BASE_NAME_LENGTH = 100;
// Characters Windows, macOS or Linux refuse (or treat specially) in a file name.
const UNSAFE_CHARACTERS = /[<>:"/\\|?*]/g;
// Windows device names are invalid as a base name with any extension.
const RESERVED_WINDOWS_NAMES = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;

function withoutControlCharacters(value: string): string {
  let result = "";
  for (const character of value) {
    const code = character.charCodeAt(0);
    result += code <= 0x1f || (code >= 0x7f && code <= 0x9f) ? " " : character;
  }
  return result;
}

/**
 * A download file name for a project, safe on every desktop OS:
 * `My Project.layoutry`. The project name itself is never changed.
 */
export function projectFileName(projectName: string): string {
  let base = withoutControlCharacters(projectName)
    .replace(UNSAFE_CHARACTERS, "-")
    .replace(/\s+/g, " ")
    .trim()
    // Windows drops trailing dots and spaces; leading dots hide files on Unix.
    .replace(/^[.\s]+|[.\s]+$/g, "");
  if (base.length > MAX_BASE_NAME_LENGTH)
    base = Array.from(base).slice(0, MAX_BASE_NAME_LENGTH).join("").trim();
  if (base.length === 0) base = DEFAULT_PROJECT_NAME;
  if (RESERVED_WINDOWS_NAMES.test(base)) base = `${base}-project`;
  return `${base}${PROJECT_FILE_EXTENSION}`;
}
