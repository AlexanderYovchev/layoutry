import { describe, expect, it } from "vitest";
import { resolveFreeMoveSnap, SNAP_THRESHOLD_PX } from "./resolveFreeMoveSnap";

const PARENT = { width: 500, height: 400 };

describe("resolveFreeMoveSnap", () => {
  describe("parent targets", () => {
    it("snaps the left edge to the parent's left edge", () => {
      const result = resolveFreeMoveSnap({ x: 3, y: 100, width: 100, height: 50 }, PARENT, []);
      expect(result.x).toBe(0);
      expect(result.verticalGuide).toBe(0);
    });

    it("snaps the horizontal center to the parent's horizontal center", () => {
      // parent center x = 250; a 100-wide box centered there has x = 200
      const result = resolveFreeMoveSnap({ x: 196, y: 100, width: 100, height: 50 }, PARENT, []);
      expect(result.x).toBe(200);
      expect(result.verticalGuide).toBe(250);
    });

    it("snaps the right edge to the parent's right edge", () => {
      // parent right = 500; a 100-wide box with its right edge there has x = 400
      const result = resolveFreeMoveSnap({ x: 397, y: 100, width: 100, height: 50 }, PARENT, []);
      expect(result.x).toBe(400);
      expect(result.verticalGuide).toBe(500);
    });

    it("snaps the top edge to the parent's top edge", () => {
      const result = resolveFreeMoveSnap({ x: 100, y: 4, width: 50, height: 100 }, PARENT, []);
      expect(result.y).toBe(0);
      expect(result.horizontalGuide).toBe(0);
    });

    it("snaps the vertical center to the parent's vertical center", () => {
      // parent center y = 200; a 100-tall box centered there has y = 150
      const result = resolveFreeMoveSnap({ x: 100, y: 154, width: 50, height: 100 }, PARENT, []);
      expect(result.y).toBe(150);
      expect(result.horizontalGuide).toBe(200);
    });

    it("snaps the bottom edge to the parent's bottom edge", () => {
      // parent bottom = 400; a 100-tall box with its bottom edge there has y = 300
      const result = resolveFreeMoveSnap({ x: 100, y: 296, width: 50, height: 100 }, PARENT, []);
      expect(result.y).toBe(300);
      expect(result.horizontalGuide).toBe(400);
    });

    it("resolves x and y independently in the same call", () => {
      // x snaps to parent center (200), y snaps to parent top (0), simultaneously.
      const result = resolveFreeMoveSnap({ x: 198, y: 2, width: 100, height: 50 }, PARENT, []);
      expect(result.x).toBe(200);
      expect(result.y).toBe(0);
      expect(result.verticalGuide).toBe(250);
      expect(result.horizontalGuide).toBe(0);
    });
  });

  describe("sibling targets", () => {
    const sibling = { x: 50, y: 60, width: 80, height: 40 };

    it("snaps its left edge to a sibling's left edge", () => {
      const result = resolveFreeMoveSnap({ x: 47, y: 200, width: 30, height: 30 }, PARENT, [sibling]);
      expect(result.x).toBe(50);
      expect(result.verticalGuide).toBe(50);
    });

    it("snaps its horizontal center to a sibling's horizontal center", () => {
      // sibling center x = 50+40 = 90; a 30-wide box centered there has x = 75
      const result = resolveFreeMoveSnap({ x: 72, y: 200, width: 30, height: 30 }, PARENT, [sibling]);
      expect(result.x).toBe(75);
      expect(result.verticalGuide).toBe(90);
    });

    it("snaps its right edge to a sibling's right edge", () => {
      // sibling right = 130; a 30-wide box with right edge there has x = 100
      const result = resolveFreeMoveSnap({ x: 103, y: 200, width: 30, height: 30 }, PARENT, [sibling]);
      expect(result.x).toBe(100);
      expect(result.verticalGuide).toBe(130);
    });

    it("snaps to a sibling's top/center/bottom the same way, vertically", () => {
      // sibling top=60, center=80, bottom=100
      expect(resolveFreeMoveSnap({ x: 200, y: 57, width: 20, height: 30 }, PARENT, [sibling]).y).toBe(60);
      expect(resolveFreeMoveSnap({ x: 200, y: 63, width: 20, height: 30 }, PARENT, [sibling]).y).toBe(65);
      expect(resolveFreeMoveSnap({ x: 200, y: 68, width: 20, height: 30 }, PARENT, [sibling]).y).toBe(70);
    });
  });

  describe("threshold", () => {
    it("does not snap when a target is farther away than the threshold", () => {
      const result = resolveFreeMoveSnap({ x: 20, y: 100, width: 100, height: 50 }, PARENT, [], 8);
      expect(result.x).toBe(20);
      expect(result.verticalGuide).toBeUndefined();
    });

    it("snaps exactly at the threshold boundary (inclusive)", () => {
      const result = resolveFreeMoveSnap({ x: 8, y: 100, width: 100, height: 50 }, PARENT, [], 8);
      expect(result.x).toBe(0);
    });

    it("does not snap one pixel beyond the threshold boundary", () => {
      const result = resolveFreeMoveSnap({ x: 9, y: 100, width: 100, height: 50 }, PARENT, [], 8);
      expect(result.x).toBe(9);
      expect(result.verticalGuide).toBeUndefined();
    });

    it("honors a custom threshold", () => {
      const result = resolveFreeMoveSnap({ x: 15, y: 100, width: 100, height: 50 }, PARENT, [], 20);
      expect(result.x).toBe(0);
    });

    it("exports the default threshold as a named constant rather than a magic number", () => {
      expect(SNAP_THRESHOLD_PX).toBeGreaterThan(0);
      expect(SNAP_THRESHOLD_PX).toBeLessThanOrEqual(10);
    });
  });

  describe("determinism / tie-breaking (section 13)", () => {
    it("prefers the closest target when a parent and a sibling target are both within threshold but at different distances", () => {
      // parent left = 0 (distance 5). sibling left = 3 (distance 2, closer).
      const result = resolveFreeMoveSnap({ x: 5, y: 200, width: 30, height: 30 }, PARENT, [{ x: 3, y: 0, width: 10, height: 10 }]);
      expect(result.x).toBe(3);
    });

    it("prefers a parent target over an equally-close sibling target", () => {
      // parent left = 0 (distance 4). sibling at x=8 (distance 4, exactly tied).
      const result = resolveFreeMoveSnap({ x: 4, y: 200, width: 0, height: 30 }, PARENT, [{ x: 8, y: 0, width: 0, height: 10 }]);
      expect(result.x).toBe(0);
      expect(result.verticalGuide).toBe(0);
    });

    it("prefers the earlier sibling (stable document order) when two siblings tie exactly on distance", () => {
      // Both 2px away from proposed.x=38, but at different positions (40 vs 36) so the
      // winning target value reveals which sibling the tie-break actually picked.
      const siblingB = { x: 40, y: 0, width: 0, height: 0 };
      const siblingA = { x: 36, y: 0, width: 0, height: 0 };
      const result = resolveFreeMoveSnap({ x: 38, y: 200, width: 0, height: 30 }, PARENT, [siblingB, siblingA]);
      // siblingB is passed first (siblingIndex 0) and must win the tie over siblingA (index 1).
      expect(result.x).toBe(40);
    });
  });

  describe("moving-element exclusion (section 14)", () => {
    it("never snaps against itself — the caller is responsible for omitting the moving node from siblings", () => {
      // If the moving node's own old geometry were mistakenly included as a "sibling" at
      // its current (unmoved) position, it would trivially snap to zero distance from itself.
      const ownOldGeometry = { x: 42, y: 42, width: 30, height: 30 };
      const result = resolveFreeMoveSnap({ x: 100, y: 100, width: 30, height: 30 }, PARENT, [ownOldGeometry]);
      // Far from every target (parent edges/centers, and the "sibling" at 42) - no snap.
      expect(result.x).toBe(100);
      expect(result.y).toBe(100);
    });
  });

  it("returns no guides at all when nothing snapped on either axis", () => {
    const result = resolveFreeMoveSnap({ x: 123, y: 234, width: 30, height: 30 }, PARENT, []);
    expect(result).toEqual({ x: 123, y: 234 });
  });
});
