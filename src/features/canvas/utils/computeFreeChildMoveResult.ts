import type { FreeLayoutBounds } from "@/features/editor/utils/normalizeFreeLayoutGeometry";
import type { FreeLayoutGeometry } from "@/features/editor/types/layout";

export interface FreeChildMoveStart {
  startX: number;
  startY: number;
  width: number;
  height: number;
  startPointerX: number;
  startPointerY: number;
  parentBounds: FreeLayoutBounds;
  /** The Free container's own id, or null if it couldn't be resolved at pointer-down. (BC-13.3: the snap targets and guides live in the move session's own snap context, not here.) */
  containerId?: string | null;
}

export function clampFreeChildAxis(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, Math.max(min, max)));
}

/** The child's raw proposed position from the pointer delta alone — BEFORE Snap and BEFORE the parent-containment clamp (see this checkpoint's own section 21: "proposed geometry -> snapping -> containment/clamp"). Exported separately so useFreeChildMoveSession can insert a Snap step between this and the clamp below without duplicating the delta math. */
export function computeRawFreeChildMovePosition(
  start: FreeChildMoveStart,
  pointerX: number,
  pointerY: number,
): { x: number; y: number } {
  return {
    x: start.startX + (pointerX - start.startPointerX),
    y: start.startY + (pointerY - start.startPointerY),
  };
}

/**
 * Pure drag-to-reposition geometry for a Free child: translates x/y by
 * the pointer delta from a session-start snapshot (never accumulating
 * frame-to-frame, same reasoning as computeResizeResult), clamped so the
 * child's box never leaves the parent's content bounds. Width/height are
 * never touched by a move — only computeFreeChildResizeResult changes
 * those. This is the plain (Snap-unaware) path — see
 * useFreeChildMoveSession for where Snap is inserted between the raw
 * position above and the clamp below when Snap is enabled.
 */
export function computeFreeChildMoveResult(
  start: FreeChildMoveStart,
  pointerX: number,
  pointerY: number,
): FreeLayoutGeometry {
  const raw = computeRawFreeChildMovePosition(start, pointerX, pointerY);

  const x = clampFreeChildAxis(raw.x, 0, Math.max(0, start.parentBounds.width - start.width));
  const y = clampFreeChildAxis(raw.y, 0, Math.max(0, start.parentBounds.height - start.height));

  return { x, y, width: start.width, height: start.height };
}
