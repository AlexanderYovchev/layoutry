import { describe, expect, it } from "vitest";
import {
  clientRectToLocal,
  freeChildRenderedRect,
  localOriginInset,
  localToClientX,
  localToClientY,
  measureFreeContainerFrame,
  renderedToStoredPosition,
  screenDistanceToLocal,
} from "./freeLayoutFrame";

/** BC-13.2 — the local Free frame: origin at the padding-box corner, containment unchanged, scale seam. */

function container(options: { rect: { left: number; top: number; width: number; height: number }; border: [number, number]; padding: [number, number, number, number]; scroll?: [number, number] }) {
  const el = document.createElement("div");
  const [left, top, right, bottom] = options.padding;
  el.style.paddingLeft = `${left}px`;
  el.style.paddingTop = `${top}px`;
  el.style.paddingRight = `${right}px`;
  el.style.paddingBottom = `${bottom}px`;
  const [borderX, borderY] = options.border;
  const clientWidth = options.rect.width - 2 * borderX;
  const clientHeight = options.rect.height - 2 * borderY;
  Object.defineProperty(el, "clientLeft", { value: borderX });
  Object.defineProperty(el, "clientTop", { value: borderY });
  Object.defineProperty(el, "clientWidth", { value: clientWidth });
  Object.defineProperty(el, "clientHeight", { value: clientHeight });
  Object.defineProperty(el, "scrollLeft", { value: options.scroll?.[0] ?? 0 });
  Object.defineProperty(el, "scrollTop", { value: options.scroll?.[1] ?? 0 });
  el.getBoundingClientRect = () => ({ ...options.rect, x: options.rect.left, y: options.rect.top, right: options.rect.left + options.rect.width, bottom: options.rect.top + options.rect.height, toJSON: () => options.rect });
  document.body.append(el);
  return el;
}

describe("measureFreeContainerFrame", () => {
  it("zero padding and border: every definition coincides (the default Free container is unchanged)", () => {
    const el = container({ rect: { left: 100, top: 50, width: 400, height: 300 }, border: [0, 0], padding: [0, 0, 0, 0] });
    const frame = measureFreeContainerFrame(el);
    expect(frame).toMatchObject({ originClientX: 100, originClientY: 50, paddingBox: { width: 400, height: 300 }, containment: { width: 400, height: 300 }, scale: 1 });
  });

  it("symmetric padding: the origin stays at the padding edge; containment keeps the content-box size; snapping bounds are the padding box", () => {
    const el = container({ rect: { left: 100, top: 50, width: 400, height: 300 }, border: [0, 0], padding: [20, 20, 20, 20] });
    const frame = measureFreeContainerFrame(el);
    expect(frame.originClientX).toBe(100); // not 120: absolute children render from the padding edge
    expect(frame.paddingBox).toEqual({ width: 400, height: 300 });
    expect(frame.containment).toEqual({ width: 360, height: 260 });
  });

  it("asymmetric padding with borders: origin = outer edge + border; containment = padding box − padding on each side", () => {
    const el = container({ rect: { left: 330, top: 10, width: 412, height: 312 }, border: [6, 6], padding: [20, 10, 4, 30] });
    const frame = measureFreeContainerFrame(el);
    expect({ x: frame.originClientX, y: frame.originClientY }).toEqual({ x: 336, y: 16 });
    expect(frame.paddingBox).toEqual({ width: 400, height: 300 });
    expect(frame.containment).toEqual({ width: 400 - 20 - 4, height: 300 - 10 - 30 });
  });

  it("a scrolled container moves its origin with its content", () => {
    const el = container({ rect: { left: 0, top: 0, width: 200, height: 200 }, border: [2, 2], padding: [0, 0, 0, 0], scroll: [30, 40] });
    expect(localOriginInset(el)).toEqual({ left: -28, top: -38 });
    expect(measureFreeContainerFrame(el)).toMatchObject({ originClientX: -28, originClientY: -38 });
  });
});

describe("conversions", () => {
  const frame = { originClientX: 336, originClientY: 16, paddingBox: { width: 400, height: 300 }, containment: { width: 376, height: 260 }, scale: 1 };

  it("client rect ↔ local frame round-trips without drift", () => {
    const local = clientRectToLocal({ left: 386.25, top: 66.5, width: 80, height: 30 }, frame);
    expect(local).toEqual({ x: 50.25, y: 50.5, width: 80, height: 30 });
    expect(localToClientX(local.x, frame)).toBe(386.25);
    expect(localToClientY(local.y, frame)).toBe(66.5);
  });

  it("is scale-aware (the future zoom seam): screen distances and rects divide by the scale", () => {
    const zoomed = { ...frame, scale: 2 };
    expect(clientRectToLocal({ left: 436, top: 116, width: 160, height: 60 }, zoomed)).toEqual({ x: 50, y: 50, width: 80, height: 30 });
    expect(localToClientX(50, zoomed)).toBe(436);
    expect(screenDistanceToLocal(6, 2)).toBe(3);
    expect(screenDistanceToLocal(6)).toBe(6);
  });

  it("a nested descendant's (possibly transformed) bounding box lands in the ancestor's local frame by translation", () => {
    // The BC-13.1 probe: a nested, rotated + scaled element measured 158.74 px from the outer edge of a 6px-bordered container.
    expect(clientRectToLocal({ left: 330 + 158.74, top: 100, width: 102.05, height: 40 }, frame).x).toBeCloseTo(152.74, 6);
  });

  it("rendered border box = stored geometry + own margin, and back", () => {
    expect(freeChildRenderedRect({ x: 10, y: 20, width: 100, height: 50 }, { left: 8, top: 4 })).toEqual({ x: 18, y: 24, width: 100, height: 50 });
    expect(freeChildRenderedRect({ x: 10, y: 20, width: 100, height: 50 }, {})).toEqual({ x: 10, y: 20, width: 100, height: 50 });
    expect(renderedToStoredPosition({ x: 18, y: 24 }, { left: 8, top: 4 })).toEqual({ x: 10, y: 20 });
  });
});
