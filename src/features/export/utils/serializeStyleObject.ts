import type { CSSProperties } from "react";
import type { CssDeclaration } from "@/features/canvas";

/**
 * React's own list of style properties whose numeric values are written
 * without a unit (react-dom's `unitlessNumbers`, verbatim). Every other
 * non-zero number gets "px" appended, exactly as React does when it sets
 * the same style object as an inline style on the Canvas.
 */
const UNITLESS_PROPERTIES: ReadonlySet<string> = new Set(
  (
    "animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup " +
    "boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow " +
    "gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp " +
    "lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity " +
    "strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth"
  ).split(" "),
);

/** React's hyphenateStyleName: `marginTop` → `margin-top`, `msTransform` → `-ms-transform`. */
export function hyphenateStyleName(name: string): string {
  if (name.startsWith("--")) return name;
  return name
    .replace(/([A-Z])/g, "-$1")
    .toLowerCase()
    .replace(/^ms-/, "-ms-");
}

/**
 * Converts a style object into ordered CSS declarations with React's own
 * value rules (EXPORT-1.2): null/undefined/boolean/empty values are
 * skipped, numbers get "px" unless zero or unitless, strings are trimmed.
 * Key order is preserved — React sets inline styles in that order, so a
 * later shorthand overriding an earlier longhand (or vice versa) resolves
 * identically when the declarations are printed in this order. No value
 * is rounded: a number is stringified exactly as React stringifies it.
 */
export function serializeStyleObject(style: CSSProperties): CssDeclaration[] {
  const declarations: CssDeclaration[] = [];
  for (const [name, raw] of Object.entries(style)) {
    if (raw === null || raw === undefined || typeof raw === "boolean" || raw === "") continue;
    let value: string;
    if (typeof raw === "number") {
      value = raw === 0 || UNITLESS_PROPERTIES.has(name) || name.startsWith("--") ? String(raw) : `${raw}px`;
    } else {
      value = String(raw).trim();
    }
    declarations.push([hyphenateStyleName(name), value]);
  }
  return declarations;
}
