/**
 * Escapes text for an HTML text node (EXPORT-1.2). `&` and `<` are the
 * only characters that can start markup in text; `>` is escaped too so
 * the output never contains anything that looks like a tag boundary.
 * Also safe inside RCDATA (<textarea>, <title>): `</textarea` cannot
 * appear once `<` is escaped.
 */
export function escapeHtmlText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Escapes a value for a double-quoted HTML attribute. */
export function escapeHtmlAttribute(value: string): string {
  return escapeHtmlText(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Removes U+0000, which HTML parsers drop or replace inconsistently. Returns whether anything was removed. */
export function stripNullCharacters(text: string): { text: string; changed: boolean } {
  const stripped = text.replace(/\u0000/g, "");
  return { text: stripped, changed: stripped.length !== text.length };
}
