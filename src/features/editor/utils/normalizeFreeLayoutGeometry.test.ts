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

  it("never shrinks width/height below the given minimums even if the parent is smaller", () => {
    const result = normalizeFreeLayoutGeometry(
      { x: 0, y: 0, width: 50, height: 50 },
      { width: 30, height: 20 },
      { minWidth: 160, minHeight: 120 },
    );
    expect(result.width).toBe(160);
    expect(result.height).toBe(120);
  });
});
