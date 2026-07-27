import { normalizeFreeLayoutGeometry, type FreeLayoutBounds } from "@/features/editor/utils/normalizeFreeLayoutGeometry";
import type { FreeLayoutGeometry } from "@/features/editor/types/layout";

const INSERTION_STEP_PX = 16;
const MAX_ROWS = 50;
const MAX_COLUMNS = 50;

interface Size {
  width: number;
  height: number;
}

function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/**
 * Where a newly inserted Free-mode element should land: never stacked at
 * (0,0) on top of everything else, never random. Scans a 16px grid
 * row-major (cascading right, then wrapping to the next row down) for the
 * first position that both fits inside the parent's content bounds and
 * doesn't overlap an existing sibling's geometry. Falls back to a
 * cascading, boundary-normalized position — allowing overlap as a last
 * resort rather than refusing to place the element — if nothing on the
 * grid fits, e.g. a parent too small (or already too full of large
 * siblings) for even one more non-overlapping slot at this element's size.
 */
export function resolveFreeInsertionPosition(
  existingGeometries: FreeLayoutGeometry[],
  newSize: Size,
  parentBounds: FreeLayoutBounds,
): { x: number; y: number } {
  for (let row = 0; row < MAX_ROWS; row++) {
    const y = INSERTION_STEP_PX + row * INSERTION_STEP_PX;
    if (y + newSize.height > parentBounds.height) break;

    for (let col = 0; col < MAX_COLUMNS; col++) {
      const x = INSERTION_STEP_PX + col * INSERTION_STEP_PX;
      if (x + newSize.width > parentBounds.width) break;

      const candidate = { x, y, width: newSize.width, height: newSize.height };
      if (!existingGeometries.some((geometry) => overlaps(candidate, geometry))) {
        return { x, y };
      }
    }
  }

  // The grid scan found no free slot (e.g. the parent is already full of
  // large siblings) — cascade the fallback by the number of existing
  // siblings rather than always landing on the same fixed point, or every
  // insertion past this point would stack identically on top of the last.
  const cascadeIndex = existingGeometries.length;
  const fallback = normalizeFreeLayoutGeometry(
    {
      x: INSERTION_STEP_PX + cascadeIndex * INSERTION_STEP_PX,
      y: INSERTION_STEP_PX + cascadeIndex * INSERTION_STEP_PX,
      width: newSize.width,
      height: newSize.height,
    },
    parentBounds,
  );
  return { x: fallback.x, y: fallback.y };
}
