import type { BorderSideSettings } from "@/features/editor/types/border";
import type { OffsetValue } from "@/features/editor/types/position";
import type { CssLengthValue } from "@/features/editor/types/typography";

/**
 * BC-17.2 — physical + logical CSS property foundation (P-2; BC-17.1.3
 * Report 1 §4.10). Logical values are SEPARATE optional fields next to
 * their physical twins, with the twin's own value type, so the document
 * stores exactly what was authored: nothing is converted, normalized or
 * defaulted, and existing physical fields are untouched. Not rendered,
 * printed or offered in the Inspector yet (BC-17.3, 17.4, 17.7). Free-
 * layout children keep their physical geometry (the registry never offers
 * logical insets or sizes on them).
 */

export type LogicalSide =
  "blockStart" | "blockEnd" | "inlineStart" | "inlineEnd";
export const LOGICAL_SIDES: readonly LogicalSide[] = [
  "blockStart",
  "blockEnd",
  "inlineStart",
  "inlineEnd",
];

/** margin-block-start … padding-inline-end: px numbers, like EdgeValues. */
export type LogicalEdgeValues = Partial<Record<LogicalSide, number>>;
/** inset-block-start …: the same OffsetValue as top/right/bottom/left. */
export type LogicalOffsets = Partial<Record<LogicalSide, OffsetValue>>;
/** border-block-start …: a full side each, like the physical sides. */
export type LogicalBorderSides = Partial<
  Record<LogicalSide, BorderSideSettings>
>;

export type LogicalCorner = "startStart" | "startEnd" | "endStart" | "endEnd";
export const LOGICAL_CORNERS: readonly LogicalCorner[] = [
  "startStart",
  "startEnd",
  "endStart",
  "endEnd",
];
/** border-start-start-radius …: lengths, like the physical corners. */
export type LogicalRadii = Partial<Record<LogicalCorner, CssLengthValue>>;

/** inline-size, block-size and their min/max twins (CssUnit lengths). */
export interface LogicalSizeSettings {
  inlineSize?: CssLengthValue;
  blockSize?: CssLengthValue;
  minInlineSize?: CssLengthValue;
  maxInlineSize?: CssLengthValue;
  minBlockSize?: CssLengthValue;
  maxBlockSize?: CssLengthValue;
}

// --- Direction and writing mode ------------------------------------------

/** CSS `direction` (presentation only). */
export const CSS_DIRECTION_VALUES = ["ltr", "rtl"] as const;
export type CssDirection = (typeof CSS_DIRECTION_VALUES)[number];

export const UNICODE_BIDI_VALUES = [
  "normal",
  "embed",
  "isolate",
  "bidi-override",
  "isolate-override",
  "plaintext",
] as const;
export type UnicodeBidiValue = (typeof UNICODE_BIDI_VALUES)[number];

/** sideways-rl/-lr are added only if BC-17.7 confirms two engines (O15). */
export const WRITING_MODE_VALUES = [
  "horizontal-tb",
  "vertical-rl",
  "vertical-lr",
] as const;
export type WritingModeValue = (typeof WRITING_MODE_VALUES)[number];

export const TEXT_ORIENTATION_VALUES = [
  "mixed",
  "upright",
  "sideways",
] as const;
export type TextOrientationValue = (typeof TEXT_ORIENTATION_VALUES)[number];

/** The HTML dir attribute: content semantics, not a style group (Report 1 §4.10.2). */
export const HTML_DIR_VALUES = ["ltr", "rtl", "auto"] as const;
export type HtmlDirValue = (typeof HTML_DIR_VALUES)[number];
