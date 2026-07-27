import { DEFAULT_RESIZE_CONSTRAINTS } from "@/features/editor/types/resize";
import type { ElementResizeConstraints, FreeLayoutGeometry } from "@/features/editor/types/layout";

/** The usable area a Free child's geometry must stay inside — a parent's content box, already net of border and padding. */
export interface FreeLayoutBounds {
  width: number;
  height: number;
}

/**
 * Containment always wins over the aesthetic minimum when the two
 * conflict (max < min — a parent too small to fit even the child's own
 * stated minimum, e.g. a Container nested inside another Container
 * already at its own floor). A child is never allowed to render outside
 * its parent's bounds for any reason, including "it wouldn't be
 * readable that small" — being smaller than ideal is a lesser problem
 * than escaping the container entirely. min is only honored when there
 * is actually enough room to honor it.
 */
function clamp(value: number, min: number, max: number): number {
  const safeMax = Math.max(0, max);
  if (safeMax < min) return safeMax;
  return Math.max(min, Math.min(value, safeMax));
}

/**
 * The single centralized clamp for the Content Boundary Guarantee
 * (Checkpoint 3.4.4): for every direct child of a Free container,
 * 0 <= x, 0 <= y, x + width <= contentWidth, y + height <= contentHeight —
 * an absolute invariant, never relaxed for any content type (text,
 * image, button, svg, or any future element), and never relaxed even
 * when it means shrinking below constraints' minimums (see clamp
 * above). Every place a Free child's geometry can change — insertion,
 * movement, resize, paste, duplicate, parent resize, undo/redo
 * restoration, and layout-mode conversion — normalizes through this one
 * function rather than each command re-deriving its own clamp.
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
