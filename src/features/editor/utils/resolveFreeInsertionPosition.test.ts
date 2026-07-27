import { describe, expect, it } from "vitest";
import { resolveFreeInsertionPosition } from "@/features/editor/utils/resolveFreeInsertionPosition";

describe("resolveFreeInsertionPosition", () => {
  it("places the first element at the 16px padding offset", () => {
    const position = resolveFreeInsertionPosition([], { width: 100, height: 80 }, { width: 400, height: 300 });
    expect(position).toEqual({ x: 16, y: 16 });
  });

  it("cascades along the row to the first non-overlapping slot to the right of an existing sibling", () => {
    const position = resolveFreeInsertionPosition(
      [{ x: 16, y: 16, width: 100, height: 80 }],
      { width: 100, height: 80 },
      { width: 400, height: 300 },
    );
    // The existing sibling occupies x:16..116, so the first 16px grid column
    // clear of it (fully to its right) is x=128.
    expect(position).toEqual({ x: 128, y: 16 });
  });

  it("never returns the exact same position as an existing sibling", () => {
    const existing = [{ x: 16, y: 16, width: 100, height: 80 }];
    const position = resolveFreeInsertionPosition(existing, { width: 100, height: 80 }, { width: 400, height: 300 });
    expect(position).not.toEqual({ x: 16, y: 16 });
  });

  it("wraps to the next row once the current row runs out of horizontal space", () => {
    const parentBounds = { width: 48, height: 300 };
    // Only one 16px column (x=16) fits at all before x=32 overflows the
    // 48px-wide parent (32 + 24 = 56 > 48) — so every row's sole column is
    // occupied by the existing sibling until a row clears it vertically.
    const existing = [{ x: 16, y: 16, width: 24, height: 20 }];
    const position = resolveFreeInsertionPosition(existing, { width: 24, height: 20 }, parentBounds);
    // row y=16 collides (identical rect); row y=32 still overlaps the
    // existing sibling's y:16..36 range; row y=48 is finally clear of it.
    expect(position).toEqual({ x: 16, y: 48 });
  });

  it("is deterministic: the same inputs always produce the same output", () => {
    const existing = [
      { x: 16, y: 16, width: 100, height: 80 },
      { x: 132, y: 16, width: 100, height: 80 },
    ];
    const first = resolveFreeInsertionPosition(existing, { width: 100, height: 80 }, { width: 400, height: 300 });
    const second = resolveFreeInsertionPosition(existing, { width: 100, height: 80 }, { width: 400, height: 300 });
    expect(first).toEqual(second);
  });

  it("falls back to a boundary-normalized position instead of failing when the parent has no free grid slot", () => {
    const parentBounds = { width: 50, height: 50 };
    const position = resolveFreeInsertionPosition([], { width: 200, height: 200 }, parentBounds);
    // width/height get floored at the generic default minimum (64x64) by the normalizer, then clamped into the tiny parent.
    expect(position.x).toBeGreaterThanOrEqual(0);
    expect(position.y).toBeGreaterThanOrEqual(0);
  });

  it("cascades the fallback per existing sibling instead of stacking every overflow insertion at the same point", () => {
    // A container too short for a 150-tall element to ever clear a large
    // existing sibling vertically — the grid scan can never find a slot,
    // so every insertion falls through to the fallback branch.
    const parentBounds = { width: 400, height: 200 };
    const bigSibling = { x: 0, y: 0, width: 400, height: 200 };

    const first = resolveFreeInsertionPosition([bigSibling], { width: 200, height: 150 }, parentBounds);
    const second = resolveFreeInsertionPosition([bigSibling, bigSibling], { width: 200, height: 150 }, parentBounds);
    const third = resolveFreeInsertionPosition(
      [bigSibling, bigSibling, bigSibling],
      { width: 200, height: 150 },
      parentBounds,
    );

    expect(first).not.toEqual(second);
    expect(second).not.toEqual(third);
  });
});
