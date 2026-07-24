import type { CSSProperties } from "react";
import type { ElementDimensions } from "@/features/editor/types/document";

/**
 * Converts a resized node's explicit pixel dimensions into inline style,
 * or undefined when the element hasn't been resized and should keep
 * sizing itself naturally from its own Tailwind classes. flexShrink: 0
 * keeps an explicit size honest inside the flex-column parents every
 * resizable element currently renders in — without it, a resized box
 * could still get silently squashed short of its set height if its
 * siblings didn't leave enough room.
 *
 * marginLeft/marginTop (not transform) is what makes a west/north resize
 * visually anchor from the opposite edge (see ElementDimensions in
 * document.ts). transform was tried first and is wrong here: it only
 * shifts where a box *paints*, never how much space it *reserves* in
 * flow, so a flex-column parent still positions the next sibling using
 * the resized box's raw (untransformed) height — the sibling doesn't
 * know the box was ever visually shifted. Across a shrink-then-regrow
 * sequence this produces a real, growing mismatch: the resized box's
 * anchored edge stays visually put, but its sibling drifts to wherever
 * flow-only math places it, so the two disagree and later content (the
 * next section, an image inside it) ends up rendered somewhere other
 * than where it visually looks like it should be — exactly reproduced by
 * the "can't click the image after resizing" report this was fixed for.
 * A negative margin doesn't have this gap: margin genuinely participates
 * in flow, so growing north by shrinking marginTop simultaneously shifts
 * this box up *and* correctly reduces the flow space between it and
 * whatever precedes it, keeping every sibling's position exactly where a
 * user watching the box's edges would expect it. Omitted entirely when
 * both are 0 (every element resized only from its east/south edges)
 * rather than emitting redundant `margin: 0px 0px`.
 */
export function elementDimensionsStyle(
  dimensions: ElementDimensions | undefined,
): CSSProperties | undefined {
  if (!dimensions) return undefined;

  const style: CSSProperties = {
    width: dimensions.width,
    height: dimensions.height,
    flexShrink: 0,
  };

  if (dimensions.offsetX !== 0) style.marginLeft = dimensions.offsetX;
  if (dimensions.offsetY !== 0) style.marginTop = dimensions.offsetY;

  return style;
}
