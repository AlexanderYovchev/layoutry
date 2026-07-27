import type { FreeLayoutBounds } from "@/features/editor/utils/normalizeFreeLayoutGeometry";

function pixels(value: string): number {
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * A Free container's usable content box — clientWidth/clientHeight still
 * include padding, so this subtracts it explicitly (border is already
 * excluded from client*). This is the coordinate space every direct
 * child's FreeLayoutGeometry is relative to: insertion placement, the
 * free move/resize sessions' pointer-down bounds, container-resize child
 * scaling, and Flow→Free conversion's measurement step all measure
 * through this one function rather than each re-deriving the inset math.
 */
export function measureFreeContainerBounds(container: HTMLElement): FreeLayoutBounds {
  const style = getComputedStyle(container);
  const paddingX = pixels(style.paddingLeft) + pixels(style.paddingRight);
  const paddingY = pixels(style.paddingTop) + pixels(style.paddingBottom);

  return {
    width: Math.max(0, container.clientWidth - paddingX),
    height: Math.max(0, container.clientHeight - paddingY),
  };
}
