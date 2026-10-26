/**
 * Project name rules, shared by the file schema (untrusted input) and the
 * Rename / Save dialogs (user input), so a name the UI accepts is always
 * one the loader accepts and vice versa.
 */
export const MAX_PROJECT_NAME_LENGTH = 256;

/** C0 controls (incl. tab and line breaks), DEL, and C1 controls. */
export function containsControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return true;
  }
  return false;
}

export type ProjectNameResult =
  { ok: true; name: string } | { ok: false; message: string };

/**
 * Validates a name typed by the user: trims both ends and collapses runs of
 * spaces, then rejects empty, over-long and control-character names. The
 * returned `name` is what gets stored.
 */
export function normalizeProjectName(input: string): ProjectNameResult {
  if (containsControlCharacters(input))
    return {
      ok: false,
      message: "Project names can't contain line breaks or control characters.",
    };
  const name = input.trim().replace(/ {2,}/g, " ");
  if (name.length === 0) return { ok: false, message: "Enter a project name." };
  if (name.length > MAX_PROJECT_NAME_LENGTH)
    return {
      ok: false,
      message: `Project names can be at most ${MAX_PROJECT_NAME_LENGTH} characters.`,
    };
  return { ok: true, name };
}
