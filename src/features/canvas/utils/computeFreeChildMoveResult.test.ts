import { describe, expect, it } from "vitest";
import { computeFreeChildMoveResult, type FreeChildMoveStart } from "./computeFreeChildMoveResult";

const baseStart: FreeChildMoveStart = {
  startX: 50,
  startY: 40,
  width: 100,
  height: 80,
  startPointerX: 300,
  startPointerY: 300,
  parentBounds: { width: 400, height: 300 },
};

describe("computeFreeChildMoveResult", () => {
  it("translates x/y by the pointer delta, leaving width/height untouched", () => {
    const result = computeFreeChildMoveResult(baseStart, 320, 330);
    expect(result).toEqual({ x: 70, y: 70, width: 100, height: 80 });
  });

  it("clamps x/y so the child never leaves the parent's left/top edge", () => {
    const result = computeFreeChildMoveResult(baseStart, 0, 0);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it("clamps x/y so the child never crosses the parent's right/bottom edge", () => {
    const result = computeFreeChildMoveResult(baseStart, 10000, 10000);
    expect(result.x + result.width).toBeLessThanOrEqual(baseStart.parentBounds.width);
    expect(result.y + result.height).toBeLessThanOrEqual(baseStart.parentBounds.height);
  });

  it("computes purely from the session-start snapshot, never compounding across repeated calls", () => {
    const first = computeFreeChildMoveResult(baseStart, 310, 310);
    const second = computeFreeChildMoveResult(baseStart, 310, 310);
    expect(first).toEqual(second);
  });
});
