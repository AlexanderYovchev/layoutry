import { getFilterSettings, isValidFilterFieldValue, type FilterSettings } from "@/features/editor/types/filters";
import { formatCssLength, type CssLengthValue } from "@/features/editor/types/typography";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { CSSProperties } from "react";

/**
 * Every `filter:` function this checkpoint supports, in one fixed
 * canonical order (alphabetical by CSS function name — the same order
 * the brief's own example output uses) — always emitted in this order
 * regardless of which fields happen to be set, so two nodes with the
 * identical set of filters always produce byte-identical `filter` CSS
 * text (Checkpoint 4.7's #7 "stable ordering"). Deliberately excludes
 * `opacity` — see formatOpacityStyle below for why.
 */
const FILTER_FUNCTION_ORDER: readonly (keyof Omit<FilterSettings, "opacity">)[] = [
  "blur",
  "brightness",
  "contrast",
  "grayscale",
  "hueRotate",
  "invert",
  "saturate",
  "sepia",
];

/** Explicit switch over literal property names (matching resolveBorderRadiusStyle's applyCornerStyle) — a generic lookup table can't be checked by TypeScript against each field's own value type (a CssLengthValue for blur, a plain number for everything else). */
function formatFilterFunctionCss(field: (typeof FILTER_FUNCTION_ORDER)[number], value: number | CssLengthValue): string {
  switch (field) {
    case "blur":
      return `blur(${formatCssLength(value as CssLengthValue)})`;
    case "hueRotate":
      return `hue-rotate(${value}deg)`;
    case "brightness":
      return `brightness(${value}%)`;
    case "contrast":
      return `contrast(${value}%)`;
    case "grayscale":
      return `grayscale(${value}%)`;
    case "invert":
      return `invert(${value}%)`;
    case "saturate":
      return `saturate(${value}%)`;
    case "sepia":
      return `sepia(${value}%)`;
  }
}

/**
 * Pure Canvas resolver for a node's own visual effects (Checkpoint 4.7) —
 * same shape as resolveBorderStyle/resolveBorderRadiusStyle: emits CSS
 * only for fields actually present and structurally valid, never a
 * guessed default, never throws on malformed loaded-document data (a
 * field that fails isValidFilterFieldValue is skipped on its own,
 * without preventing every other valid field in the same settings object
 * from still rendering — Checkpoint 4.7's #8).
 *
 * Opacity is rendered via the standalone CSS `opacity` property, NOT the
 * `filter: opacity()` function — real authors overwhelmingly write plain
 * `opacity: 0.5` rather than the equivalent-but-more-obscure filter
 * function, and the brief's own example `filter:` output already omits
 * opacity from the function list entirely. Keeping it a separate
 * property also means Opacity keeps working correctly even for an
 * element whose `filter` ends up empty (no blur/brightness/etc. set) —
 * there is no dependency between the two.
 */
export function resolveFilterStyle(node: EditorElementNode): CSSProperties {
  const filters = getFilterSettings(node);
  const style: CSSProperties = {};

  if (filters.opacity !== undefined && isValidFilterFieldValue("opacity", filters.opacity)) {
    style.opacity = filters.opacity / 100;
  }

  const functions: string[] = [];
  for (const field of FILTER_FUNCTION_ORDER) {
    const value = filters[field];
    if (value === undefined || !isValidFilterFieldValue(field, value)) continue;
    functions.push(formatFilterFunctionCss(field, value));
  }
  if (functions.length > 0) style.filter = functions.join(" ");

  return style;
}
