import type { CSSProperties } from "react";
import { getElementSpacing } from "@/features/editor/types/spacing";
import type { ElementDimensions, EditorElementNode } from "@/features/editor/types/document";
import type { ContainerLayoutMode, FreeLayoutGeometry } from "@/features/editor/types/layout";

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
 * user watching the box's edges would expect it.
 *
 * extraMarginLeft/Top (Checkpoint 3.5) is the node's own spacing.margin,
 * composed additively with the offsetX/Y anchor shift rather than one
 * overwriting the other in the final CSS — see elementPositionStyle,
 * the only caller, which is also the only place both values are known.
 * Margin is omitted entirely when the composed total is 0 on that axis,
 * rather than emitting a redundant `margin: 0px`.
 *
 * maxWidth/maxHeight ownership moved to resolveSizeConstraintsStyle in
 * Checkpoint 5.7 — this function no longer sets either property itself.
 * A resized Flow node still gets the exact same "clamp to the parent's
 * current content box" containment it always has (Checkpoint 3.4.3's
 * `max-width/height: 100%`), it's just resolved (and, since 5.7,
 * composed with any user-authored CSS max-width/height via `min()`)
 * by that dedicated resolver instead of here — see its own doc comment
 * for the full reasoning behind the split. Every other caller of this
 * function is unaffected: width/height/flexShrink/margin/overflow are
 * still resolved exactly as before.
 *
 * clipOverflowY hides content that no longer fits once an explicit height
 * shrinks a text-bearing element below its natural content height (see
 * HeadingElement/ParagraphElement/ButtonElement) — the text itself is
 * never removed from the document model, only visually clipped.
 */
export function elementDimensionsStyle(
  dimensions: ElementDimensions | undefined,
  options?: { clipOverflowY?: boolean; extraMarginLeft?: number; extraMarginTop?: number },
): CSSProperties | undefined {
  const marginLeft = (dimensions?.offsetX ?? 0) + (options?.extraMarginLeft ?? 0);
  const marginTop = (dimensions?.offsetY ?? 0) + (options?.extraMarginTop ?? 0);

  if (!dimensions) {
    if (marginLeft === 0 && marginTop === 0) return undefined;
    const style: CSSProperties = {};
    if (marginLeft !== 0) style.marginLeft = marginLeft;
    if (marginTop !== 0) style.marginTop = marginTop;
    return style;
  }

  const style: CSSProperties = {
    width: dimensions.preferredWidth,
    height: dimensions.preferredHeight,
    flexShrink: 0,
  };

  if (marginLeft !== 0) style.marginLeft = marginLeft;
  if (marginTop !== 0) style.marginTop = marginTop;
  if (options?.clipOverflowY) style.overflow = "hidden";

  return style;
}

/**
 * The one place every element component decides which geometry source
 * actually applies to it: freeChildStyle(node.freeLayout) when its
 * parent is a Free-mode container, else elementDimensionsStyle(node.dimensions)
 * for ordinary Flow rendering — plus, since Checkpoint 3.5, the node's
 * own spacing (margin + padding), merged in regardless of whether it has
 * been resized/positioned at all. Every DocumentElementComponent calls
 * this instead of composing geometry and spacing itself.
 */
export function elementPositionStyle(
  node: EditorElementNode,
  parentLayoutMode: ContainerLayoutMode,
  options?: { clipOverflowY?: boolean },
): CSSProperties | undefined {
  const spacing = getElementSpacing(node);

  const geometryStyle =
    parentLayoutMode === "free"
      ? freeChildStyle(node.freeLayout, {
          clipOverflowY: options?.clipOverflowY,
          extraMarginLeft: spacing.margin.left,
          extraMarginTop: spacing.margin.top,
        })
      : elementDimensionsStyle(node.dimensions, {
          clipOverflowY: options?.clipOverflowY,
          extraMarginLeft: spacing.margin.left,
          extraMarginTop: spacing.margin.top,
        });

  const hasRightBottomMargin = spacing.margin.right !== 0 || spacing.margin.bottom !== 0;
  const hasPadding =
    spacing.padding.top !== 0 || spacing.padding.right !== 0 || spacing.padding.bottom !== 0 || spacing.padding.left !== 0;

  if (!geometryStyle && !hasRightBottomMargin && !hasPadding) return undefined;

  const style: CSSProperties = { ...geometryStyle };
  if (spacing.margin.right !== 0) style.marginRight = spacing.margin.right;
  if (spacing.margin.bottom !== 0) style.marginBottom = spacing.margin.bottom;
  if (spacing.padding.top !== 0) style.paddingTop = spacing.padding.top;
  if (spacing.padding.right !== 0) style.paddingRight = spacing.padding.right;
  if (spacing.padding.bottom !== 0) style.paddingBottom = spacing.padding.bottom;
  if (spacing.padding.left !== 0) style.paddingLeft = spacing.padding.left;

  return style;
}

/**
 * A Free-mode child's geometry as inline style — position: absolute with
 * left/top/width/height, all relative to the nearest positioned ancestor
 * (its Free-mode parent — see ContainerElement's own position: relative
 * when it hosts Free children). Unlike elementDimensionsStyle's
 * offsetX/Y margin trick, a Free child has a genuinely independent x/y —
 * no flow participation, so no maxWidth/maxHeight clamp is needed or
 * wanted here. extraMarginLeft/Top (Checkpoint 3.5, see
 * elementPositionStyle) still applies even to a Free child: margin is a
 * spacing concern independent of Free's own x/y positioning model — an
 * absolutely-positioned box with a left margin shifts visually by that
 * margin without changing its stored x/y (matches ordinary CSS: margin
 * still applies to absolutely-positioned boxes).
 */
export function freeChildStyle(
  geometry: FreeLayoutGeometry | undefined,
  options?: { clipOverflowY?: boolean; extraMarginLeft?: number; extraMarginTop?: number },
): CSSProperties | undefined {
  const marginLeft = options?.extraMarginLeft ?? 0;
  const marginTop = options?.extraMarginTop ?? 0;

  if (!geometry) {
    if (marginLeft === 0 && marginTop === 0) return undefined;
    const style: CSSProperties = {};
    if (marginLeft !== 0) style.marginLeft = marginLeft;
    if (marginTop !== 0) style.marginTop = marginTop;
    return style;
  }

  const style: CSSProperties = {
    position: "absolute",
    left: geometry.x,
    top: geometry.y,
    width: geometry.width,
    height: geometry.height,
  };

  if (marginLeft !== 0) style.marginLeft = marginLeft;
  if (marginTop !== 0) style.marginTop = marginTop;
  if (options?.clipOverflowY) style.overflow = "hidden";

  return style;
}
