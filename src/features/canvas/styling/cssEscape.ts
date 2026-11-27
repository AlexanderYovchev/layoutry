/**
 * CSS escaping shared by every stylesheet printer (moved from the export
 * feature in BC-17.3: the Design and Preview surfaces print text
 * stylesheets too).
 */

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
    else if (code < 0x20 || code === 0x7f || char === "<")
      escaped += `\\${code.toString(16)} `;
    else escaped += char;
  }
  return `"${escaped}"`;
}
