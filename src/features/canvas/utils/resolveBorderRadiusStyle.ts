import { BORDER_RADIUS_CORNERS, getBorderRadiusSettings, isValidBorderRadiusCornerValue } from "@/features/editor/types/borderRadius";
import { formatCssLength } from "@/features/editor/types/typography";
import type { BorderRadiusCorner } from "@/features/editor/types/borderRadius";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { CSSProperties } from "react";

/**
 * One corner's contribution to the style object — written as an explicit
 * switch over literal property names, same rationale as
 * resolveBorderStyle.ts's applySideStyle: a generic `keyof CSSProperties`
 * lookup table can't be verified by TypeScript against the specific
 * property's value type, only a literal property name can.
 */
function applyCornerStyle(style: CSSProperties, corner: BorderRadiusCorner, value: string): void {
  switch (corner) {
    case "topLeft":
      style.borderTopLeftRadius = value;
      break;
    case "topRight":
      style.borderTopRightRadius = value;
      break;
    case "bottomRight":
      style.borderBottomRightRadius = value;
      break;
    case "bottomLeft":
      style.borderBottomLeftRadius = value;
      break;
  }
}

/**
 * Pure Canvas resolver for a node's own border radius (Checkpoint 4.5) —
 * same shape as resolveBorderStyle/resolveBackgroundStyle: emits CSS
 * only for corners actually present, always as per-corner longhand
 * (border-top-left-radius, etc.) rather than the border-radius shorthand,
 * even while every corner happens to hold an identical value ("Unified"
 * mode in the Inspector) — avoids ever needing two emission paths for
 * the same data.
 *
 * Never throws on malformed loaded-document data — a corner that fails
 * isValidBorderRadiusCornerValue is skipped entirely rather than having
 * an invalid value coerced into something renderable.
 */
export function resolveBorderRadiusStyle(node: EditorElementNode): CSSProperties {
  const radius = getBorderRadiusSettings(node);
  const style: CSSProperties = {};

  for (const corner of BORDER_RADIUS_CORNERS) {
    const value = radius[corner];
    if (value === undefined || !isValidBorderRadiusCornerValue(value)) continue;
    applyCornerStyle(style, corner, formatCssLength(value));
  }

  return style;
}
