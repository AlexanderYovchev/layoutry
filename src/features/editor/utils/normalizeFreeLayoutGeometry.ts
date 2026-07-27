import { DEFAULT_RESIZE_CONSTRAINTS } from "@/features/editor/types/resize";
import type { ElementResizeConstraints, FreeLayoutGeometry } from "@/features/editor/types/layout";

/** The usable area a Free child's geometry must stay inside — a parent's content box, already net of border and padding. */
export interface FreeLayoutBounds {
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, Math.max(min, max)));
}

/**
 * The single centralized clamp for the Content Boundary Guarantee
 * (Checkpoint 3.4.4): for every direct child of a Free container,
 * 0 <= x, 0 <= y, x + width <= contentWidth, y + height <= contentHeight,
 * with width/height never below constraints' minimums. Every place a
 * Free child's geometry can change — insertion, movement, resize, paste,
 * duplicate, parent resize, undo/redo restoration, and layout-mode
 * conversion — normalizes through this one function rather than each
 * command re-deriving its own clamp.
 *
 * Width/height are clamped before x/y so a child that's currently wider/
 * taller than the (possibly shrunk) parent gets sized down first, and its
 * position is then clamped against that already-corrected size — matching
 * how a live resize/move session already reasons about "how much room is
 * left to move/grow into."
 */
export function normalizeFreeLayoutGeometry(
  geometry: FreeLayoutGeometry,
  parentBounds: FreeLayoutBounds,
  constraints: ElementResizeConstraints = DEFAULT_RESIZE_CONSTRAINTS,
): FreeLayoutGeometry {
  const width = clamp(geometry.width, constraints.minWidth, parentBounds.width);
  const height = clamp(geometry.height, constraints.minHeight, parentBounds.height);
  const x = clamp(geometry.x, 0, Math.max(0, parentBounds.width - width));
  const y = clamp(geometry.y, 0, Math.max(0, parentBounds.height - height));

  return { x, y, width, height };
}
