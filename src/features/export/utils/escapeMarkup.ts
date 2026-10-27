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

/**
 * Serializes a value as a double-quoted CSS string (CSS Syntax §4.3.5
 * escapes). Backslash and quote are escaped; newlines and other control
 * characters become hex escapes; `<` becomes `\3c ` so a string can never
 * spell `</style` when the stylesheet is embedded in HTML.
 */
export function escapeCssString(value: string): string {
  let escaped = "";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (char === "\\" || char === '"') escaped += `\\${char}`;
    else if (code < 0x20 || code === 0x7f || char === "<") escaped += `\\${code.toString(16)} `;
    else escaped += char;
  }
  return `"${escaped}"`;
}

/** Removes U+0000, which HTML parsers drop or replace inconsistently. Returns whether anything was removed. */
export function stripNullCharacters(text: string): { text: string; changed: boolean } {
  const stripped = text.replace(/\u0000/g, "");
  return { text: stripped, changed: stripped.length !== text.length };
}
