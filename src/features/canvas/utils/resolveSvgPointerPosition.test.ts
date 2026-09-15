import { describe, expect, it } from "vitest";
import { computeSvgPointFromClient } from "./resolveSvgPointerPosition";

describe("computeSvgPointFromClient (Checkpoint 1.15.6)", () => {
  it("maps the visual center of the rendered box to the visual center of the viewBox, regardless of rendered size", () => {
    const viewBox = { minX: 0, minY: 0, width: 100, height: 100 };

    const small = computeSvgPointFromClient(100, 100, { rect: { left: 0, top: 0, width: 200, height: 200 }, viewBox });
    expect(small).toEqual({ x: 50, y: 50 });

    const large = computeSvgPointFromClient(400, 200, { rect: { left: 0, top: 0, width: 800, height: 400 }, viewBox });
    expect(large).toEqual({ x: 50, y: 50 });
  });

  it("honors a non-zero viewBox minX/minY (panned viewBox)", () => {
    const basis = { rect: { left: 0, top: 0, width: 100, height: 100 }, viewBox: { minX: -10, minY: -10, width: 100, height: 100 } };
    expect(computeSvgPointFromClient(0, 0, basis)).toEqual({ x: -10, y: -10 });
    expect(computeSvgPointFromClient(100, 100, basis)).toEqual({ x: 90, y: 90 });
  });

  it("honors the rendered box's own client offset (not anchored at the viewport origin)", () => {
    const basis = { rect: { left: 200, top: 100, width: 100, height: 100 }, viewBox: { minX: 0, minY: 0, width: 100, height: 100 } };
    expect(computeSvgPointFromClient(250, 150, basis)).toEqual({ x: 50, y: 50 });
  });

  it("handles independent X/Y scale factors correctly (a non-square rendered box)", () => {
    const basis = { rect: { left: 0, top: 0, width: 200, height: 100 }, viewBox: { minX: 0, minY: 0, width: 100, height: 100 } };
    // Half the rendered width maps to half the viewBox width; a quarter of the rendered height maps to a quarter of the viewBox height.
    expect(computeSvgPointFromClient(100, 25, basis)).toEqual({ x: 50, y: 25 });
  });

  it("falls back to the viewBox origin for a zero-size rendered box rather than dividing by zero", () => {
    const basis = { rect: { left: 0, top: 0, width: 0, height: 0 }, viewBox: { minX: 5, minY: 5, width: 100, height: 100 } };
    expect(computeSvgPointFromClient(999, 999, basis)).toEqual({ x: 5, y: 5 });
  });

  it("rounds the result to 2 decimal places", () => {
    const basis = { rect: { left: 0, top: 0, width: 300, height: 300 }, viewBox: { minX: 0, minY: 0, width: 100, height: 100 } };
    const result = computeSvgPointFromClient(37, 37, basis);
    expect(Number.isInteger(result.x * 100)).toBe(true);
    expect(Number.isInteger(result.y * 100)).toBe(true);
  });
});
