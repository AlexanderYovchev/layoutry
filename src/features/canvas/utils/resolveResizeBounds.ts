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
 * would overflow, not push that ancestor wider), while height is the main
 * axis, sized to content by default — an ancestor with no explicit height
 * of its own isn't a ceiling at all, it grows to match whatever its
 * children need. Clamping vertical growth against such an ancestor's
 * *current* height (a snapshot that goes stale the instant the very
 * child being resized starts growing, since that's what the ancestor's
 * height is derived from) would incorrectly block a resize that has every
 * right to succeed — this is what made south/north resizing appear
 * completely broken on section-2 and the Image inside it, both of which
 * exactly fit their auto-height parent with zero pre-existing slack.
 *
 * So only the vertical axis walks: past every ancestor whose height is
 * still auto, to the nearest one that has been explicitly given a fixed
 * height (via its own prior resize — detected by an inline `style.height`,
 * which only ever comes from elementDimensionsStyle) — that ancestor
 * really is a ceiling, the same way width already is. If no ancestor is
 * explicitly sized, vertical growth is genuinely unbounded (subject only
 * to the minimum constraint), since nothing between here and the page
 * sheet imposes a real height ceiling in this layout.
 */
function resolveVerticalBound(
  canvasRoot: HTMLElement,
  startEl: HTMLElement,
): { start: number; end: number } {
  let current: HTMLElement | null = startEl;

  while (current) {
    if (current.style.height !== "") {
      return contentBoxRange(current, canvasRoot, "vertical");
    }
    if (current === canvasRoot) break;
    current = current.parentElement?.closest<HTMLElement>("[data-node-id]") ?? null;
  }

  return { start: -Infinity, end: Infinity };
}

/**
 * Measures the resized node's bounds — the rect a resize may not cross —
 * in the same canvas-root-relative coordinate space useMeasuredNodeRect
 * already uses. Horizontal is always the immediate containing block's
 * content box (its nearest DOM ancestor carrying data-node-id): a real,
 * already-resolved ceiling in a flex-column layout, whether that ancestor
 * was explicitly resized or is simply stretched to fill its own parent.
 * Vertical is resolved separately (see resolveVerticalBound) since it
 * isn't symmetric with horizontal in this layout.
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
  const vertical = resolveVerticalBound(canvasRoot, containingEl);

  return {
    left: horizontal.start,
    right: horizontal.end,
    top: vertical.start,
    bottom: vertical.end,
  };
}
