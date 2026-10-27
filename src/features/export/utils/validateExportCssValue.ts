import type { ExportDiagnosticCode } from "@/features/export/types/exportDiagnostic";

/**
 * Safety and validity checks for one CSS value before it is written into a
 * stylesheet (EXPORT-1.2). On the Canvas, React hands every value to the
 * CSSOM one property at a time, so no value can ever escape its own
 * declaration. A text stylesheet has no such protection: `red; } body { …`
 * or `</style><script>` in a free-text field would inject CSS or markup.
 * The project schema stores colors and font families as plain strings, so
 * every value is checked here.
 */

const NAMED_COLORS: ReadonlySet<string> = new Set(
  (
    "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood " +
    "cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray " +
    "darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen " +
    "darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue " +
    "firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew " +
    "hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan " +
    "lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray " +
    "lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue " +
    "mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred " +
    "midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid " +
    "palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple " +
    "rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue " +
    "slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow " +
    "yellowgreen transparent currentcolor inherit initial unset revert"
  ).split(" "),
);

const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
// Functional color notations, with arguments limited to the characters
// those notations use (numbers, units, keywords, separators, nested calls).
const FUNCTIONAL_COLOR = /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\([a-z0-9\s.,%/+#()-]*\)$/i;

/** True for any color syntax a browser accepts that is also inert as text: hex, functional notations, named colors and keywords. */
export function isExportableColor(value: string): boolean {
  const trimmed = value.trim();
  if (NAMED_COLORS.has(trimmed.toLowerCase()) || HEX_COLOR.test(trimmed)) return true;
  return FUNCTIONAL_COLOR.test(trimmed) && hasBalancedParentheses(trimmed);
}

const QUOTED_FAMILY = /^(?:"[^"\\\n\r]*"|'[^'\\\n\r]*')$/;
const UNQUOTED_FAMILY = /^-?[a-z_][a-z0-9_-]*(?: +-?[a-z_][a-z0-9_-]*)*$/i;

/** A comma-separated list of quoted family names or identifier sequences, e.g. `"Fira Sans", Arial, sans-serif`. */
export function isExportableFontFamily(value: string): boolean {
  const families = value.split(",").map((family) => family.trim());
  return families.length > 0 && families.every((family) => QUOTED_FAMILY.test(family) || UNQUOTED_FAMILY.test(family));
}

function hasBalancedParentheses(value: string): boolean {
  let depth = 0;
  for (const char of value) {
    if (char === "(") depth++;
    if (char === ")" && --depth < 0) return false;
  }
  return depth === 0;
}

function hasBalancedQuotes(value: string): boolean {
  let quote: string | null = null;
  for (const char of value) {
    if (quote === null && (char === '"' || char === "'")) quote = char;
    else if (char === quote) quote = null;
  }
  return quote === null;
}

/**
 * Characters that could end the declaration, the rule or the <style>
 * element, start a comment or at-rule, add `!important`, or escape out of
 * a token. No value any resolver produces needs them (url() strings are
 * re-serialized separately with escapeCssString).
 */
const STRUCTURALLY_UNSAFE = /[;{}<>\\!@\u0000-\u001f\u007f]|\/\*|\*\//;

/** Structural injection check every printed value must pass. */
export function isStructurallySafeCssValue(value: string): boolean {
  return !STRUCTURALLY_UNSAFE.test(value) && hasBalancedParentheses(value) && hasBalancedQuotes(value);
}

const COLOR_PROPERTIES: ReadonlySet<string> = new Set([
  "color",
  "background-color",
  "border-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "outline-color",
  "text-decoration-color",
]);

export type CssValueCheck = { ok: true } | { ok: false; code: ExportDiagnosticCode; message: string };

/**
 * Validates one declaration (url() values excluded — see
 * buildExportDocument's background-image handling). A value that fails is
 * dropped by the caller, which is also what the browser does on the Canvas
 * with a value it cannot parse — so dropping it costs no fidelity.
 */
export function validateCssDeclarationValue(property: string, value: string): CssValueCheck {
  if (!isStructurallySafeCssValue(value)) {
    return { ok: false, code: "invalid-css-value", message: `The ${property} value contains characters that could break out of the stylesheet, so it was not exported.` };
  }
  if (COLOR_PROPERTIES.has(property) && !isExportableColor(value)) {
    return { ok: false, code: "invalid-color", message: `"${value}" is not a valid CSS color, so ${property} was not exported.` };
  }
  if (property === "font-family" && !isExportableFontFamily(value)) {
    return { ok: false, code: "invalid-font-family", message: `"${value}" is not a valid font-family list, so it was not exported.` };
  }
  return { ok: true };
}
