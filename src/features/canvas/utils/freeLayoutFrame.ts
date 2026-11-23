import { measureFreeContainerBounds } from "@/features/canvas/utils/measureFreeContainerBounds";
import type { FreeLayoutBounds } from "@/features/editor/utils/normalizeFreeLayoutGeometry";
import type { FreeLayoutGeometry } from "@/features/editor/types/layout";

/**
 * BC-13.2 — the coordinate foundation for Free layout and snapping.
 *
 * Coordinate spaces (all CSS px unless stated otherwise):
 * - CLIENT: viewport coordinates (PointerEvent.clientX/Y,
 *   getBoundingClientRect). Screen px; equal to CSS px while the Canvas has
 *   no zoom.
 * - CANVAS VISUAL: client coordinates relative to the Canvas root element
 *   (what CanvasOverlay positions its chrome in). A pure translation of
 *   CLIENT.
 * - LOCAL FREE FRAME: a Free container's own frame. Its ORIGIN is the
 *   container's PADDING-BOX top-left (inside the border), because that is
 *   the containing block of its position:absolute children: a child with
 *   freeLayout x=0 renders exactly at the inner border edge (verified by
 *   the BC-13.1 probe). freeLayout x/y, guides and snap targets all live in
 *   this frame.
 * - BORDER BOX: an element's visible box including its border, excluding
 *   margins (what getBoundingClientRect measures, transforms included as an
 *   axis-aligned bounding box). Snapping aligns rendered border boxes (D25).
 * - PADDING BOX: the container's inner box (clientWidth × clientHeight),
 *   origin at the local origin. The parent's snapping boundaries and centre.
 * - CONTENT BOX: the padding box minus padding. Its SIZE is the existing
 *   Free containment rule (measureFreeContainerBounds): a child's stored
 *   geometry stays within [0, contentWidth] × [0, contentHeight] from the
 *   local origin. That rule is kept exactly as it is (BC-13.2 preserves
 *   containment); it is not re-anchored at the content box.
 *
 * A Free child's RENDERED border box in the local frame is its stored
 * freeLayout shifted by its own margin-left/top (freeChildStyle composes
 * spacing.margin into margin-left/top). Snapping works on rendered boxes;
 * the caller converts the result back to stored geometry (renderedToStored).
 *
 * Root cause of the pre-BC-13.2 mismatch: the guide overlay placed the
 * local origin at border + PADDING, and the parent targets used the
 * CONTENT box, while children actually render from the PADDING edge. With
 * zero padding and border every definition coincides, which is why the
 * default Free container was never affected.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A Free container's frame, measured once per gesture. */
export interface FreeContainerFrame {
  /** Client x/y of the local origin (the padding-box top-left, scrolled content accounted for). */
  originClientX: number;
  originClientY: number;
  /** The padding box in the local frame: the parent's snapping boundaries (origin 0,0). */
  paddingBox: FreeLayoutBounds;
  /** The existing containment region from the local origin (content-box size; unchanged rule). */
  containment: FreeLayoutBounds;
  /** Screen px per local CSS px. 1 until the Canvas has zoom (BC-13.1 Q1: a seam only). */
  scale: number;
}

/**
 * Where the local origin sits inside an element's border box, in CSS px:
 * the border (clientLeft/clientTop) minus the element's own scroll offset
 * (absolutely positioned children scroll with the container's content).
 */
export function localOriginInset(container: HTMLElement): { left: number; top: number } {
  return { left: container.clientLeft - container.scrollLeft, top: container.clientTop - container.scrollTop };
}

export function measureFreeContainerFrame(container: HTMLElement, scale = 1): FreeContainerFrame {
  const rect = container.getBoundingClientRect();
  const inset = localOriginInset(container);
  return {
    originClientX: rect.left + inset.left * scale,
    originClientY: rect.top + inset.top * scale,
    paddingBox: { width: container.clientWidth, height: container.clientHeight },
    containment: measureFreeContainerBounds(container),
    scale,
  };
}

/** A client-space rect (e.g. a target's getBoundingClientRect, a transformed AABB) in the local frame. */
export function clientRectToLocal(rect: { left: number; top: number; width: number; height: number }, frame: FreeContainerFrame): Rect {
  return {
    x: (rect.left - frame.originClientX) / frame.scale,
    y: (rect.top - frame.originClientY) / frame.scale,
    width: rect.width / frame.scale,
    height: rect.height / frame.scale,
  };
}

/** A local-frame coordinate back in client space (e.g. to draw a guide). */
export function localToClientX(x: number, frame: FreeContainerFrame): number {
  return frame.originClientX + x * frame.scale;
}

export function localToClientY(y: number, frame: FreeContainerFrame): number {
  return frame.originClientY + y * frame.scale;
}

/** A distance in screen px (e.g. the 6px snap threshold) in local CSS px. */
export function screenDistanceToLocal(screenPx: number, scale = 1): number {
  return screenPx / scale;
}

/** A Free child's rendered border box in the local frame: stored geometry shifted by its own margin-left/top. */
export function freeChildRenderedRect(geometry: FreeLayoutGeometry, margin: { left?: number; top?: number }): Rect {
  return { x: geometry.x + (margin.left ?? 0), y: geometry.y + (margin.top ?? 0), width: geometry.width, height: geometry.height };
}

/** The stored freeLayout position for a rendered (snapped) position. */
export function renderedToStoredPosition(rendered: { x: number; y: number }, margin: { left?: number; top?: number }): { x: number; y: number } {
  return { x: rendered.x - (margin.left ?? 0), y: rendered.y - (margin.top ?? 0) };
}
