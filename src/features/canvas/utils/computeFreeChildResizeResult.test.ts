import { describe, expect, it } from "vitest";
import { computeFreeChildResizeResult, type FreeChildResizeSession } from "./computeFreeChildResizeResult";

const constraints = { minWidth: 20, minHeight: 20 };
const parentBounds = { width: 400, height: 300 };

function baseSession(overrides: Partial<FreeChildResizeSession> = {}): FreeChildResizeSession {
  return {
    direction: "e",
    startX: 50,
    startY: 40,
    startWidth: 100,
    startHeight: 80,
    startPointerX: 300,
    startPointerY: 300,
    parentBounds,
    aspectRatioLocked: false,
    ...overrides,
  };
}

describe("computeFreeChildResizeResult — side handles", () => {
  it("east: grows width in place, x/y and height unchanged", () => {
    const result = computeFreeChildResizeResult(baseSession({ direction: "e" }), 330, 300, constraints);
    expect(result).toEqual({ x: 50, y: 40, width: 130, height: 80 });
  });

  it("west: moves x left and grows width, keeping the right edge fixed", () => {
    const result = computeFreeChildResizeResult(baseSession({ direction: "w" }), 270, 300, constraints);
    expect(result.width).toBe(130);
    expect(result.x).toBe(20);
    // right edge (x + width) must stay exactly where it started
    expect(result.x + result.width).toBe(50 + 100);
  });

  it("south: grows height in place, x/y and width unchanged", () => {
    const result = computeFreeChildResizeResult(baseSession({ direction: "s" }), 300, 330, constraints);
    expect(result).toEqual({ x: 50, y: 40, width: 100, height: 110 });
  });

  it("north: moves y up and grows height, keeping the bottom edge fixed", () => {
    const result = computeFreeChildResizeResult(baseSession({ direction: "n" }), 300, 270, constraints);
    expect(result.height).toBe(110);
    expect(result.y).toBe(10);
    expect(result.y + result.height).toBe(40 + 80);
  });

  it("clamps east growth at the parent's right edge", () => {
    const result = computeFreeChildResizeResult(baseSession({ direction: "e" }), 10000, 300, constraints);
    expect(result.x + result.width).toBeLessThanOrEqual(parentBounds.width);
  });

  it("clamps west growth so x never goes negative", () => {
    const result = computeFreeChildResizeResult(baseSession({ direction: "w" }), -10000, 300, constraints);
    expect(result.x).toBeGreaterThanOrEqual(0);
  });

  it("clamps to the minimum size instead of shrinking past it", () => {
    const result = computeFreeChildResizeResult(baseSession({ direction: "e" }), 0, 300, constraints);
    expect(result.width).toBe(constraints.minWidth);
  });

  it("never applies the aspect lock to a side handle, even when aspectRatioLocked is true", () => {
    const result = computeFreeChildResizeResult(
      baseSession({ direction: "e", aspectRatioLocked: true }),
      330,
      300,
      constraints,
    );
    expect(result).toEqual({ x: 50, y: 40, width: 130, height: 80 });
  });
});

describe("computeFreeChildResizeResult — corner handles", () => {
  it("south-east: grows both axes independently, top-left anchor fixed", () => {
    const result = computeFreeChildResizeResult(baseSession({ direction: "se" }), 330, 320, constraints);
    expect(result).toEqual({ x: 50, y: 40, width: 130, height: 100 });
  });

  it("north-west: moves both x and y, bottom-right anchor fixed", () => {
    const result = computeFreeChildResizeResult(baseSession({ direction: "nw" }), 270, 260, constraints);
    expect(result.x + result.width).toBe(50 + 100);
    expect(result.y + result.height).toBe(40 + 80);
  });

  it("preserves the starting aspect ratio on a corner drag when aspectRatioLocked", () => {
    const session = baseSession({ direction: "se", aspectRatioLocked: true });
    const result = computeFreeChildResizeResult(session, 350, 300, constraints);
    const startRatio = session.startWidth / session.startHeight;
    expect(result.width / result.height).toBeCloseTo(startRatio, 5);
  });

  it("re-derives width from height when the aspect-locked height gets clamped by the parent bound", () => {
    // Height bound is tight (parent only 300 tall, startY 40 -> heightBound 260);
    // dragging far right would want a much taller box than fits, so height clamps
    // and width must be re-derived to keep the exact ratio.
    const session = baseSession({
      direction: "se",
      startX: 10,
      startY: 40,
      startWidth: 100,
      startHeight: 50,
      aspectRatioLocked: true,
    });
    const result = computeFreeChildResizeResult(session, 10000, 300, constraints);
    const startRatio = session.startWidth / session.startHeight;
    expect(result.height).toBeLessThanOrEqual(parentBounds.height - session.startY);
    expect(result.width / result.height).toBeCloseTo(startRatio, 5);
  });

  it("keeps the ratio locked even when shrinking to the minimum on a corner drag", () => {
    const session = baseSession({ direction: "se", aspectRatioLocked: true });
    const result = computeFreeChildResizeResult(session, -10000, -10000, constraints);
    const startRatio = session.startWidth / session.startHeight;
    expect(result.width / result.height).toBeCloseTo(startRatio, 5);
    expect(result.width).toBeGreaterThanOrEqual(constraints.minWidth);
    expect(result.height).toBeGreaterThanOrEqual(constraints.minHeight);
  });
});
