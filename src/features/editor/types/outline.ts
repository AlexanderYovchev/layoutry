import {
  BORDER_STYLE_VALUES,
  type BorderStyleValue,
} from "@/features/editor/types/border";
import type { CssLengthValue } from "@/features/editor/types/typography";

/**
 * BC-17.2 — the outline group (BC-17.1.3 Report 1 §4.6; delivered with
 * states in BC-17.5). Outline styles are the border styles plus "auto"
 * (CSS has no "hidden" for outlines, and BorderStyleValue has none).
 * Not rendered in this checkpoint: existing focus appearance is unchanged.
 */
export type OutlineStyleValue = BorderStyleValue | "auto";
export const OUTLINE_STYLE_VALUES: readonly OutlineStyleValue[] = [
  ...BORDER_STYLE_VALUES,
  "auto",
];

export interface OutlineSettings {
  width?: CssLengthValue;
  style?: OutlineStyleValue;
  color?: string;
  offset?: CssLengthValue;
}
