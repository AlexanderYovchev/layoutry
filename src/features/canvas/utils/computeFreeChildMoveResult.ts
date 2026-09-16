import type { FreeMoveSnapBox } from "@/features/canvas/utils/resolveFreeMoveSnap";
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
  /** The Free container's own id, or null if it couldn't be resolved at pointer-down — Snap (Checkpoint 1.15.6.1.1) needs this to tag its live guide state; a plain move without Snap never reads it. */
  containerId?: string | null;
  /** Every OTHER direct child's current geometry (never the moving node itself — see resolveFreeMoveSnap's own "moving-element exclusion" doc comment), captured once at pointer-down from the document (not re-measured mid-drag, matching every other Free session's "one measurement at drag-start" convention). Empty when Snap has nothing to offer (e.g. the only child, or Snap disabled) — harmless either way since resolveFreeMoveSnap tolerates an empty siblings array. */
  siblings?: FreeMoveSnapBox[];
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
