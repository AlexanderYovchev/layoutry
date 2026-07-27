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
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, Math.max(min, max)));
}

/**
 * Pure drag-to-reposition geometry for a Free child: translates x/y by
 * the pointer delta from a session-start snapshot (never accumulating
 * frame-to-frame, same reasoning as computeResizeResult), clamped so the
 * child's box never leaves the parent's content bounds. Width/height are
 * never touched by a move — only computeFreeChildResizeResult changes
 * those.
 */
export function computeFreeChildMoveResult(
  start: FreeChildMoveStart,
  pointerX: number,
  pointerY: number,
): FreeLayoutGeometry {
  const deltaX = pointerX - start.startPointerX;
  const deltaY = pointerY - start.startPointerY;

  const x = clamp(start.startX + deltaX, 0, Math.max(0, start.parentBounds.width - start.width));
  const y = clamp(start.startY + deltaY, 0, Math.max(0, start.parentBounds.height - start.height));

  return { x, y, width: start.width, height: start.height };
}
