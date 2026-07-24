import type {
  ResizeConstraints,
  ResizeResult,
  ResizeSession,
} from "@/features/editor/types/resize";

function clamp(value: number, min: number, max: number): number {
  // max can end up smaller than min against a tiny containing block; min
  // always wins so the element never renders below its own minimum size.
  return Math.max(min, Math.min(value, Math.max(min, max)));
}

/**
 * Pure resize geometry: given the session a drag started from and the
 * pointer's current position, returns the new width/height/offsetX/
 * offsetY. Kept free of any DOM/React dependency — same reasoning as
 * resolveDropZone in 3.4.1 — so the direction math, anchor-offset math,
 * and boundary clamping are directly unit-testable without simulating a
 * real pointer drag in jsdom.
 *
 * Each axis is independent: a handle's direction string only contributes
 * to width when it contains "e"/"w" and to height when it contains "n"/
 * "s", so a corner handle (e.g. "se") naturally drives both axes at once
 * with no separate diagonal-case branch. North/west handles subtract the
 * pointer delta rather than add it, since moving the pointer away from
 * the element (up/left) should grow that dimension, not shrink it.
 *
 * offsetX/offsetY exist because normal document flow has no independently
 * settable "left edge" — a box's position is wherever flow puts it, only
 * its size is under direct control. Growing width from a west handle can
 * only look like "the right edge stayed put and the left edge moved" if
 * the box is also shifted left by exactly the amount it grew (see
 * ElementDimensions in document.ts for the full reasoning); shrinking is
 * the same shift in reverse. East/south-only resizes never touch offset,
 * since their anchor (the left/top edge) is already flow's natural
 * anchor and needs no compensation. The offset composes onto whatever the
 * node's offset already was at drag start (session.startOffsetX/Y) rather
 * than assuming a west/north resize starts from zero, so repeated
 * resizes from different edges accumulate correctly instead of each one
 * discarding the last.
 *
 * Boundary clamping uses session.bounds — the resized node's containing
 * block, resolved once at pointer-down (see resolveResizeBounds) — so an
 * edge can grow right up to that boundary and no further, in either
 * direction, without ever needing to re-measure the DOM mid-drag.
 */
export function computeResizeResult(
  session: ResizeSession,
  pointerX: number,
  pointerY: number,
  constraints: ResizeConstraints,
): ResizeResult {
  const deltaX = pointerX - session.startPointerX;
  const deltaY = pointerY - session.startPointerY;
  const { direction, startWidth, startHeight, startLeft, startTop, startOffsetX, startOffsetY, bounds } =
    session;

  let width = startWidth;
  let height = startHeight;

  if (direction.includes("e")) {
    width = clamp(startWidth + deltaX, constraints.minWidth, bounds.right - startLeft);
  }
  if (direction.includes("w")) {
    width = clamp(startWidth - deltaX, constraints.minWidth, startLeft + startWidth - bounds.left);
  }
  if (direction.includes("s")) {
    height = clamp(startHeight + deltaY, constraints.minHeight, bounds.bottom - startTop);
  }
  if (direction.includes("n")) {
    height = clamp(startHeight - deltaY, constraints.minHeight, startTop + startHeight - bounds.top);
  }

  const offsetX = direction.includes("w") ? startOffsetX - (width - startWidth) : startOffsetX;
  const offsetY = direction.includes("n") ? startOffsetY - (height - startHeight) : startOffsetY;

  return { width, height, offsetX, offsetY };
}
