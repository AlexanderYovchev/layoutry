/**
 * Where a drop would land relative to the hovered target: as a new
 * sibling immediately before/after it, or appended inside it (only
 * meaningful when the target accepts children). The one canonical zone
 * type shared by document commands, move validation, and the Canvas's
 * live drop indicator — never redefined per-consumer.
 */
export type DropZone = "before" | "after" | "inside";

interface RectLike {
  top: number;
  height: number;
}

/** The vertical center of a rect — what "where is the dragged item, roughly" collapses to for this purpose. */
export function computeDraggedCenterY(rect: RectLike): number {
  return rect.top + rect.height / 2;
}

/**
 * Splits a target's rect into insertion zones: two (before/after) for
 * leaf targets, three (before/inside/after, at 25/50/25%) for targets
 * that accept children — the outer bands stay reorder-sized regardless
 * of the target's height so a very tall container doesn't make "before"
 * or "after" impractically hard to reach.
 */
export function resolveDropZone(
  targetRect: RectLike,
  draggedCenterY: number,
  targetAcceptsChildren: boolean,
): DropZone {
  const relativeY = (draggedCenterY - targetRect.top) / targetRect.height;

  if (!targetAcceptsChildren) {
    return relativeY < 0.5 ? "before" : "after";
  }

  if (relativeY < 0.25) return "before";
  if (relativeY > 0.75) return "after";
  return "inside";
}
