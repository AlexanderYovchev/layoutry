/**
 * BC-13.5 (D20) — edge-triggered auto-scroll while a Free element is being
 * dragged or resized. Implementation constants, not settings:
 * - activation: the pointer within AUTO_SCROLL_EDGE_PX of a scroll
 *   container's VISIBLE edge (or past it);
 * - speed ramps from AUTO_SCROLL_MIN_SPEED to AUTO_SCROLL_MAX_SPEED (px per
 *   second, quadratic in how deep into the band the pointer is; past the
 *   edge = maximum), time-based so it is frame-rate independent; one frame's
 *   step is capped by AUTO_SCROLL_MAX_FRAME_MS;
 * - per axis only ONE container scrolls: the innermost one that can still
 *   scroll that way (an ancestor takes over when it can't);
 * - only while it reveals more of the area the dragged element can move in
 *   (`reach`: its Free container): scrolling stops once that container's far
 *   edge is in view, so the element never gets left behind at its clamp.
 * The planner is pure; measuring and scrolling the DOM is separate.
 */

export const AUTO_SCROLL_EDGE_PX = 40;
export const AUTO_SCROLL_MIN_SPEED = 80;
export const AUTO_SCROLL_MAX_SPEED = 1200;
export const AUTO_SCROLL_MAX_FRAME_MS = 32;

export interface ScrollerState {
  /** The visible part of the scroll container's padding box, in client px. */
  visible: { left: number; top: number; right: number; bottom: number };
  /** How far it can still scroll in each direction (px). */
  room: { left: number; right: number; up: number; down: number };
}

export interface AutoScrollStep {
  /** Index into the scroller list (innermost first), or -1 for none. */
  x: { index: number; delta: number };
  y: { index: number; delta: number };
}

/** px per second for a pointer `distance` px inside the edge (≤ 0 = at or past it). */
export function autoScrollSpeed(distance: number): number {
  if (distance >= AUTO_SCROLL_EDGE_PX) return 0;
  const depth = distance <= 0 ? 1 : 1 - distance / AUTO_SCROLL_EDGE_PX;
  return AUTO_SCROLL_MIN_SPEED + (AUTO_SCROLL_MAX_SPEED - AUTO_SCROLL_MIN_SPEED) * depth * depth;
}

export interface ScrollReach {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function axisStep(
  pointer: number,
  scrollers: readonly ScrollerState[],
  elapsedSeconds: number,
  axis: "x" | "y",
  reach: ScrollReach | null,
): { index: number; delta: number } {
  for (let index = 0; index < scrollers.length; index++) {
    const { visible, room } = scrollers[index];
    const start = axis === "x" ? visible.left : visible.top;
    const end = axis === "x" ? visible.right : visible.bottom;
    if (end - start <= 0) continue;
    // How much more of the reachable area lies beyond each visible edge.
    const hiddenAfter = reach ? Math.max(0, (axis === "x" ? reach.right : reach.bottom) - end) : Infinity;
    const hiddenBefore = reach ? Math.max(0, start - (axis === "x" ? reach.left : reach.top)) : Infinity;
    const roomAfter = Math.min(axis === "x" ? room.right : room.down, hiddenAfter);
    const roomBefore = Math.min(axis === "x" ? room.left : room.up, hiddenBefore);
    const towardsStart = autoScrollSpeed(pointer - start);
    const towardsEnd = autoScrollSpeed(end - pointer);
    // Near both edges of a tiny container: the closer edge wins.
    if (towardsEnd > 0 && towardsEnd >= towardsStart && roomAfter >= 0.5) {
      return { index, delta: Math.min(roomAfter, Math.max(1, towardsEnd * elapsedSeconds)) };
    }
    if (towardsStart > 0 && roomBefore >= 0.5) {
      return { index, delta: -Math.min(roomBefore, Math.max(1, towardsStart * elapsedSeconds)) };
    }
  }
  return { index: -1, delta: 0 };
}

/** The scroll to apply this frame for a pointer at (x, y); `reach` (client px) limits it to revealing that area. */
export function planAutoScroll(
  pointer: { x: number; y: number },
  scrollers: readonly ScrollerState[],
  elapsedMs: number,
  reach: ScrollReach | null = null,
): AutoScrollStep {
  const seconds = Math.min(Math.max(elapsedMs, 0), AUTO_SCROLL_MAX_FRAME_MS) / 1000;
  return { x: axisStep(pointer.x, scrollers, seconds, "x", reach), y: axisStep(pointer.y, scrollers, seconds, "y", reach) };
}

function scrollsOn(style: CSSStyleDeclaration, axis: "x" | "y"): boolean {
  const value = axis === "x" ? style.overflowX : style.overflowY;
  return value === "auto" || value === "scroll" || value === "overlay";
}

/**
 * The scroll containers above (and including) `from`, innermost first: any
 * element whose authored/computed overflow lets it scroll on an axis. Their
 * CSS is never changed; whether they can actually scroll is read per frame.
 */
export function collectScrollContainers(from: HTMLElement | null): HTMLElement[] {
  const list: HTMLElement[] = [];
  for (let el = from; el; el = el.parentElement) {
    const style = getComputedStyle(el);
    if (scrollsOn(style, "x") || scrollsOn(style, "y")) list.push(el);
  }
  const root = document.scrollingElement;
  if (root instanceof HTMLElement && !list.includes(root)) list.push(root);
  return list;
}

/** Each container's visible padding box (clipped by the outer ones and the window) and remaining scroll room. */
export function measureScrollers(scrollers: readonly HTMLElement[]): ScrollerState[] {
  const states: ScrollerState[] = new Array(scrollers.length);
  let clip = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
  for (let i = scrollers.length - 1; i >= 0; i--) {
    const el = scrollers[i];
    const style = getComputedStyle(el);
    const isRoot = el === document.scrollingElement;
    const rect = isRoot ? { left: 0, top: 0 } : el.getBoundingClientRect();
    const left = isRoot ? 0 : rect.left + el.clientLeft;
    const top = isRoot ? 0 : rect.top + el.clientTop;
    const box = isRoot
      ? { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight }
      : { left, top, right: left + el.clientWidth, bottom: top + el.clientHeight };
    const visible = {
      left: Math.max(box.left, clip.left),
      top: Math.max(box.top, clip.top),
      right: Math.min(box.right, clip.right),
      bottom: Math.min(box.bottom, clip.bottom),
    };
    const canX = isRoot || scrollsOn(style, "x");
    const canY = isRoot || scrollsOn(style, "y");
    const maxX = el.scrollWidth - el.clientWidth;
    const maxY = el.scrollHeight - el.clientHeight;
    states[i] = {
      visible,
      room: {
        left: canX ? Math.max(0, el.scrollLeft) : 0,
        right: canX ? Math.max(0, maxX - el.scrollLeft) : 0,
        up: canY ? Math.max(0, el.scrollTop) : 0,
        down: canY ? Math.max(0, maxY - el.scrollTop) : 0,
      },
    };
    clip = visible;
  }
  return states;
}

/** Applies one planned step; returns whether anything actually scrolled. */
export function applyAutoScroll(scrollers: readonly HTMLElement[], step: AutoScrollStep): boolean {
  let scrolled = false;
  const apply = (index: number, axis: "x" | "y", delta: number) => {
    const el = scrollers[index];
    if (!el || !el.isConnected || delta === 0) return;
    const before = axis === "x" ? el.scrollLeft : el.scrollTop;
    if (axis === "x") el.scrollLeft = before + delta;
    else el.scrollTop = before + delta;
    if ((axis === "x" ? el.scrollLeft : el.scrollTop) !== before) scrolled = true;
  };
  if (step.x.index >= 0) apply(step.x.index, "x", step.x.delta);
  if (step.y.index >= 0) apply(step.y.index, "y", step.y.delta);
  return scrolled;
}
