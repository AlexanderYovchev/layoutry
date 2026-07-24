import type { ResizeBounds } from "@/features/editor/types/resize";

type Axis = "horizontal" | "vertical";

function pixels(value: string): number {
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function contentBoxRange(
  el: HTMLElement,
  canvasRoot: HTMLElement,
  axis: Axis,
): { start: number; end: number } {
  const rect = el.getBoundingClientRect();
  const rootRect = canvasRoot.getBoundingClientRect();
  const style = getComputedStyle(el);

  if (axis === "horizontal") {
    const insetStart = pixels(style.borderLeftWidth) + pixels(style.paddingLeft);
    const insetEnd = pixels(style.borderRightWidth) + pixels(style.paddingRight);
    return { start: rect.left + insetStart - rootRect.left, end: rect.right - insetEnd - rootRect.left };
  }

  const insetStart = pixels(style.borderTopWidth) + pixels(style.paddingTop);
  const insetEnd = pixels(style.borderBottomWidth) + pixels(style.paddingBottom);
  return { start: rect.top + insetStart - rootRect.top, end: rect.bottom - insetEnd - rootRect.top };
}

/**
 * Every container in this app is a flex column: width is the cross axis
 * (an ancestor that stretches to fill its own parent still resolves to a
 * real, already-settled number at any instant — growing a child past it
 * would overflow, not push that ancestor wider). Height is not symmetric
 * between its two edges, though: the *top* edge of a containing block is
 * always a real, already-resolved position (fixed by that ancestor's own
 * place in its parent's flow) regardless of whether the ancestor's own
 * height is fixed or auto — exactly like left/right already are. The
 * *bottom* edge is different: an auto-height ancestor's bottom is a
 * moving target that grows to match whatever its children need, so it
 * isn't a real ceiling at all (clamping south/east growth against it would
 * incorrectly block a resize that has every right to succeed — see
 * Checkpoint 3.4.2.3).
 *
 * Treating top the same walking way as bottom was itself a bug (found in
 * Checkpoint 3.4.2.4): an ancestor chain with no explicitly-sized member
 * anywhere resolved to top: -Infinity, letting a north/west-anchored
 * resize's negative margin push the box's edge past its own immediate
 * parent's top/left entirely, overlapping whatever came before that
 * parent in the document. Top must always come from the immediate
 * containing block, never from walking past it.
 */
function resolveBottomBound(canvasRoot: HTMLElement, startEl: HTMLElement): number {
  let current: HTMLElement | null = startEl;

  while (current) {
    if (current.style.height !== "") {
      return contentBoxRange(current, canvasRoot, "vertical").end;
    }
    if (current === canvasRoot) break;
    current = current.parentElement?.closest<HTMLElement>("[data-node-id]") ?? null;
  }

  return Infinity;
}

/**
 * Measures the resized node's bounds — the rect a resize may not cross —
 * in the same canvas-root-relative coordinate space useMeasuredNodeRect
 * already uses. Horizontal and the top edge are always the immediate
 * containing block's content box (its nearest DOM ancestor carrying
 * data-node-id): a real, already-resolved boundary in a flex-column
 * layout, whether that ancestor was explicitly resized or is simply
 * stretched to fill its own parent. The bottom edge is resolved
 * separately (see resolveBottomBound) since it isn't symmetric with the
 * other three in this layout.
 *
 * Falls back to the canvas root itself if no containing data-node-id
 * ancestor is found (shouldn't happen for any node this rule allows to be
 * resized, since even a top-level container's parent is the document
 * root, which always carries the attribute).
 */
export function resolveResizeBounds(
  canvasRoot: HTMLElement,
  targetEl: HTMLElement,
): ResizeBounds {
  const containingEl =
    targetEl.parentElement?.closest<HTMLElement>("[data-node-id]") ?? canvasRoot;

  const horizontal = contentBoxRange(containingEl, canvasRoot, "horizontal");
  const top = contentBoxRange(containingEl, canvasRoot, "vertical").start;
  const bottom = resolveBottomBound(canvasRoot, containingEl);

  return {
    left: horizontal.start,
    right: horizontal.end,
    top,
    bottom,
  };
}
