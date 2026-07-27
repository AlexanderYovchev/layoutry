import type { FreeLayoutBounds } from "@/features/editor/utils/normalizeFreeLayoutGeometry";
import type { ElementResizeConstraints, FreeLayoutGeometry } from "@/features/editor/types/layout";
import type { ResizeDirection } from "@/features/editor/types/resize";

export interface FreeChildResizeSession {
  direction: ResizeDirection;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  startPointerX: number;
  startPointerY: number;
  /** The immediate parent's content bounds, measured once at pointer-down (see measureFreeContainerBounds) — never re-measured mid-drag. */
  parentBounds: FreeLayoutBounds;
  /** Corner handles preserve the starting width:height ratio when true (the default for Image — see getElementCapabilities' supportsIntrinsicAspectRatio). Side handles never lock, regardless of this flag. */
  aspectRatioLocked: boolean;
}

// Containment always wins over the aesthetic minimum when they conflict
// (max < min) — see normalizeFreeLayoutGeometry's identical clamp for
// the full reasoning. A Free child must never render outside its
// parent's bounds, even at the cost of shrinking below its own minimum.
function clamp(value: number, min: number, max: number): number {
  const safeMax = Math.max(0, max);
  if (safeMax < min) return safeMax;
  return Math.max(min, Math.min(value, safeMax));
}

/**
 * Pure resize geometry for a Free container's direct child (Checkpoint
 * 3.4.4) — the Free-mode counterpart to computeResizeResult. Simpler than
 * the Flow version: a Free child's x/y/width/height are already relative
 * to its parent's content box (0..parentBounds), so there's no ancestor
 * containing-block walk or margin-offset composition, only the direct
 * "west/north move the anchor, east/south grow in place" rule against a
 * fixed opposite edge (fixedRight = startX + startWidth, fixedBottom =
 * startY + startHeight — the edge that direction never touches).
 *
 * Aspect-ratio lock only applies to corner handles (two-character
 * directions): it derives height from the resized width using the
 * starting ratio, re-clamps that height to its own bound, and — only if
 * the clamp actually changed it — re-derives width from the clamped
 * height so the final box is never off-ratio, at the cost of not
 * necessarily reaching the exact bound on both axes simultaneously (an
 * acceptable trade-off: never distorting the image beats maximizing
 * size). Side handles (one-character directions) never lock, even when
 * aspectRatioLocked is true — per the checkpoint spec, only corner
 * resize preserves ratio by default.
 */
export function computeFreeChildResizeResult(
  session: FreeChildResizeSession,
  pointerX: number,
  pointerY: number,
  constraints: ElementResizeConstraints,
): FreeLayoutGeometry {
  const deltaX = pointerX - session.startPointerX;
  const deltaY = pointerY - session.startPointerY;
  const { direction, startX, startY, startWidth, startHeight, parentBounds } = session;

  const fixedRight = startX + startWidth;
  const fixedBottom = startY + startHeight;

  let width = startWidth;
  let height = startHeight;

  if (direction.includes("e")) {
    width = clamp(startWidth + deltaX, constraints.minWidth, parentBounds.width - startX);
  }
  if (direction.includes("w")) {
    width = clamp(startWidth - deltaX, constraints.minWidth, fixedRight);
  }
  if (direction.includes("s")) {
    height = clamp(startHeight + deltaY, constraints.minHeight, parentBounds.height - startY);
  }
  if (direction.includes("n")) {
    height = clamp(startHeight - deltaY, constraints.minHeight, fixedBottom);
  }

  const isCorner = direction.length === 2;
  if (isCorner && session.aspectRatioLocked && startWidth > 0 && startHeight > 0) {
    const ratio = startWidth / startHeight;
    const widthBound = direction.includes("w") ? fixedRight : parentBounds.width - startX;
    const heightBound = direction.includes("n") ? fixedBottom : parentBounds.height - startY;

    let lockedHeight = clamp(width / ratio, constraints.minHeight, heightBound);
    let lockedWidth = lockedHeight * ratio;
    if (lockedWidth > widthBound || lockedWidth < constraints.minWidth) {
      lockedWidth = clamp(lockedWidth, constraints.minWidth, widthBound);
      lockedHeight = lockedWidth / ratio;
    }
    width = lockedWidth;
    height = lockedHeight;
  }

  const x = direction.includes("w") ? fixedRight - width : startX;
  const y = direction.includes("n") ? fixedBottom - height : startY;

  return { x, y, width, height };
}
