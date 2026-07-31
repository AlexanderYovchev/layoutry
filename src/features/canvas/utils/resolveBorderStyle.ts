import { BORDER_SIDES, getBorderSettings, isValidBorderSideSettings } from "@/features/editor/types/border";
import { formatCssLength } from "@/features/editor/types/typography";
import type { BorderSide, BorderSideSettings } from "@/features/editor/types/border";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { CSSProperties } from "react";

/**
 * One side's contribution to the style object — written as an explicit
 * switch over literal property names (borderTopWidth, borderRightWidth,
 * ...) rather than a side -> CSSProperties-key lookup table indexed
 * generically, since TypeScript can't verify a value assigned through a
 * generic `keyof CSSProperties` index is the *specific* property's value
 * type (e.g. that a BorderStyleValue is valid for whichever key the
 * variable happens to hold) — only a literal property name lets it check
 * that directly.
 */
function applySideStyle(style: CSSProperties, side: BorderSide, settings: BorderSideSettings): void {
  const width = settings.width ? formatCssLength(settings.width) : undefined;

  switch (side) {
    case "top":
      if (width !== undefined) style.borderTopWidth = width;
      if (settings.style) style.borderTopStyle = settings.style;
      if (settings.color) style.borderTopColor = settings.color;
      break;
    case "right":
      if (width !== undefined) style.borderRightWidth = width;
      if (settings.style) style.borderRightStyle = settings.style;
      if (settings.color) style.borderRightColor = settings.color;
      break;
    case "bottom":
      if (width !== undefined) style.borderBottomWidth = width;
      if (settings.style) style.borderBottomStyle = settings.style;
      if (settings.color) style.borderBottomColor = settings.color;
      break;
    case "left":
      if (width !== undefined) style.borderLeftWidth = width;
      if (settings.style) style.borderLeftStyle = settings.style;
      if (settings.color) style.borderLeftColor = settings.color;
      break;
  }
}

/**
 * Pure Canvas resolver for a node's own border (Checkpoint 4.4) — same
 * shape as resolveTypographyStyle/resolveBackgroundStyle: emits CSS only
 * for fields actually present, and always as per-side longhand
 * (border-top-width/style/color, etc.) rather than the border-width/
 * border-style/border-color shorthand, even while every side happens to
 * hold identical settings ("All Sides" mode in the Inspector) — this
 * avoids ever needing two different emission paths for the same data,
 * and sidesteps any shorthand-vs-longhand CSS specificity surprises.
 *
 * Never throws on malformed loaded-document data (Checkpoint 4.4's #12) —
 * a side that fails isValidBorderSideSettings is skipped entirely rather
 * than having its valid fields partially rendered or its invalid ones
 * coerced into something renderable.
 */
export function resolveBorderStyle(node: EditorElementNode): CSSProperties {
  const border = getBorderSettings(node);
  const style: CSSProperties = {};

  for (const side of BORDER_SIDES) {
    const sideSettings = border[side];
    if (sideSettings === undefined || !isValidBorderSideSettings(sideSettings)) continue;
    applySideStyle(style, side, sideSettings);
  }

  return style;
}
