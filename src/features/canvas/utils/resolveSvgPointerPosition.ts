import { roundSvgCoordinate } from "@/features/editor/utils/svgObjectGeometry";

/**
 * DOM pointer position -> SVG viewBox coordinates (Checkpoint 1.15.6,
 * sections 14/15 of its own brief). All vector geometry is authored in
 * viewBox units, never browser pixels, so a click at the visual center
 * of a rendered SVG must map to the SAME coordinate regardless of the
 * SVG's own rendered CSS size (200x200 vs 800x400) or viewBox scale.
 *
 * Split into a pure math core (computeSvgPointFromClient — fully unit-
 * testable, no DOM) and a thin DOM-reading wrapper
 * (resolveSvgPointerPosition). The wrapper prefers the native
 * `getScreenCTM()`/`matrixTransform()` path the brief itself recommends
 * (correct even under CSS transforms or non-uniform scaling that a
 * manual calculation could get wrong), falling back to the pure
 * calculation only when the browser doesn't return a CTM — notably
 * jsdom, which does not implement `getScreenCTM()` at all, and a
 * detached/zero-size SVG that briefly has no live layout yet.
 */

export interface SvgPointerBasis {
  /** The SVG element's own rendered box, in client (viewport) coordinates — i.e. getBoundingClientRect(). */
  rect: { left: number; top: number; width: number; height: number };
  /** The SVG's current viewBox, in its own units. */
  viewBox: { minX: number; minY: number; width: number; height: number };
}

/** The pure fallback calculation — a straight linear map from the rendered box to the viewBox, honoring the SVG's own current pan/zoom (minX/minY) and scale (viewBox size / rendered size) on each axis independently, exactly matching how `preserveAspectRatio`'s default (`xMidYMid meet`) still linearly maps within the box once any letterboxing offset is already baked into `rect`. */
export function computeSvgPointFromClient(clientX: number, clientY: number, basis: SvgPointerBasis): { x: number; y: number } {
  const { rect, viewBox } = basis;
  if (rect.width <= 0 || rect.height <= 0) {
    return { x: roundSvgCoordinate(viewBox.minX), y: roundSvgCoordinate(viewBox.minY) };
  }
  const scaleX = viewBox.width / rect.width;
  const scaleY = viewBox.height / rect.height;
  return {
    x: roundSvgCoordinate(viewBox.minX + (clientX - rect.left) * scaleX),
    y: roundSvgCoordinate(viewBox.minY + (clientY - rect.top) * scaleY),
  };
}

/**
 * The real-browser entry point every pointer handler in the Drawing Tool
 * calls. `svg.viewBox.baseVal` reflects the CURRENT live `viewBox`
 * attribute (including a default one the browser fills in even when the
 * attribute is literally "0 0 100 100" from resolveSvgViewBox), so this
 * always agrees with what's actually rendered.
 */
export function resolveSvgPointerPosition(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const ctm = typeof svg.getScreenCTM === "function" ? svg.getScreenCTM() : null;
  if (ctm) {
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const transformed = point.matrixTransform(ctm.inverse());
    return { x: roundSvgCoordinate(transformed.x), y: roundSvgCoordinate(transformed.y) };
  }

  const rect = svg.getBoundingClientRect();
  const baseVal = svg.viewBox?.baseVal;
  const viewBox = baseVal && baseVal.width > 0 && baseVal.height > 0
    ? { minX: baseVal.x, minY: baseVal.y, width: baseVal.width, height: baseVal.height }
    : { minX: 0, minY: 0, width: 100, height: 100 };
  return computeSvgPointFromClient(clientX, clientY, { rect, viewBox });
}
