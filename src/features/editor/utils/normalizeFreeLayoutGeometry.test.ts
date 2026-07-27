import { describe, expect, it } from "vitest";
import { normalizeFreeLayoutGeometry } from "@/features/editor/utils/normalizeFreeLayoutGeometry";

describe("normalizeFreeLayoutGeometry", () => {
  it("passes through geometry that already satisfies the content boundary guarantee", () => {
    const result = normalizeFreeLayoutGeometry(
      { x: 20, y: 30, width: 100, height: 80 },
      { width: 400, height: 300 },
    );
    expect(result).toEqual({ x: 20, y: 30, width: 100, height: 80 });
  });

  it("clamps a negative position to the parent's top/left edge", () => {
    const result = normalizeFreeLayoutGeometry(
      { x: -50, y: -20, width: 100, height: 80 },
      { width: 400, height: 300 },
    );
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it("clamps so the child never crosses the parent's right/bottom edge", () => {
    const result = normalizeFreeLayoutGeometry(
      { x: 350, y: 280, width: 100, height: 80 },
      { width: 400, height: 300 },
    );
    expect(result.x + result.width).toBeLessThanOrEqual(400);
    expect(result.y + result.height).toBeLessThanOrEqual(300);
  });

  it("shrinks width/height to fit a parent smaller than the geometry, before clamping position", () => {
    const result = normalizeFreeLayoutGeometry(
      { x: 350, y: 280, width: 500, height: 500 },
      { width: 400, height: 300 },
      { minWidth: 10, minHeight: 10 },
    );
    expect(result.width).toBe(400);
    expect(result.height).toBe(300);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it("honors the given minimums when the parent is big enough to allow it", () => {
    const result = normalizeFreeLayoutGeometry(
      { x: 0, y: 0, width: 50, height: 50 },
      { width: 400, height: 300 },
      { minWidth: 160, minHeight: 120 },
    );
    expect(result.width).toBe(160);
    expect(result.height).toBe(120);
  });

  it("containment always wins over the minimum: shrinks below the stated minimum rather than ever escaping a parent too small to hold it", () => {
    // A nested container (own minimum 160x120) placed inside a parent
    // whose usable content area is only 30x20 — exactly the scenario a
    // deeply-nested Free container can hit. The child must never render
    // wider/taller than its parent, even though that means going below
    // its own "ideal" minimum.
    const result = normalizeFreeLayoutGeometry(
      { x: 0, y: 0, width: 50, height: 50 },
      { width: 30, height: 20 },
      { minWidth: 160, minHeight: 120 },
    );
    expect(result.width).toBe(30);
    expect(result.height).toBe(20);
    expect(result.x + result.width).toBeLessThanOrEqual(30);
    expect(result.y + result.height).toBeLessThanOrEqual(20);
  });
});
