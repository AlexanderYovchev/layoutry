/**
 * CSS color text-entry validation — originally written inside
 * types/typography.ts for Text Color (Checkpoint 4.2), moved here
 * (Checkpoint 4.3) once Background Color needed the exact same rule: the
 * logic was already generic CSS-color syntax, not anything
 * typography-specific, so it belongs in a shared editor utility rather
 * than being duplicated per property. typography.ts re-exports
 * `isValidCssColor` from here so its existing import site is unaffected.
 */

const HEX_COLOR_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
// rgb()/rgba() and hsl()/hsla() functional syntax — the two forms explicitly named by
// Checkpoint 4.2's spec ("hexadecimal text entry, rgb()/rgba() parsing"). Deliberately
// does not attempt the full CSS Color 4 grammar (color-mix, lab(), oklch(), etc.) or the
// 147 named colors — out of scope for a text-entry validator, not a picker.
const RGB_FUNCTION_PATTERN = /^rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*(,\s*[\d.]+%?\s*)?\)$/i;
const HSL_FUNCTION_PATTERN = /^hsla?\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*[\d.]+%\s*(,\s*[\d.]+%?\s*)?\)$/i;
const KEYWORD_COLORS = new Set(["transparent", "currentcolor", "inherit"]);

/** Validates a color text entry — hex (#rgb/#rgba/#rrggbb/#rrggbbaa), rgb()/rgba()/hsl()/hsla() function syntax, and the transparent/currentColor/inherit keywords. Rejects everything else (including CSS named colors like "red") rather than silently letting an unrecognized string through. */
export function isValidCssColor(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return false;
  if (KEYWORD_COLORS.has(trimmed.toLowerCase())) return true;
  return HEX_COLOR_PATTERN.test(trimmed) || RGB_FUNCTION_PATTERN.test(trimmed) || HSL_FUNCTION_PATTERN.test(trimmed);
}
