import { describe, expect, it } from "vitest";
import { DEFAULT_RESIZE_CONSTRAINTS } from "@/features/editor/types/resize";
import type { ResizeBounds, ResizeSession } from "@/features/editor/types/resize";
import { computeResizeResult } from "./computeResizeResult";

const GENEROUS_BOUNDS: ResizeBounds = { left: -10000, top: -10000, right: 10000, bottom: 10000 };

function session(overrides: Partial<ResizeSession> = {}): ResizeSession {
  return {
    nodeId: "container-1",
    direction: "e",
    startWidth: 200,
    startHeight: 100,
    startLeft: 300,
    startTop: 150,
    startOffsetX: 0,
    startOffsetY: 0,
    startPointerX: 500,
    startPointerY: 300,
    bounds: GENEROUS_BOUNDS,
    ...overrides,
  };
}

describe("computeResizeResult", () => {
  describe("direction math (generous bounds)", () => {
    it("grows width when dragging the east handle right, left edge fixed", () => {
      const result = computeResizeResult(session({ direction: "e" }), 560, 300, DEFAULT_RESIZE_CONSTRAINTS);

      expect(result).toEqual({ preferredWidth: 260, preferredHeight: 100, offsetX: 0, offsetY: 0 });
    });

    it("shrinks width when dragging the east handle left", () => {
      const result = computeResizeResult(session({ direction: "e" }), 470, 300, DEFAULT_RESIZE_CONSTRAINTS);

      expect(result).toEqual({ preferredWidth: 170, preferredHeight: 100, offsetX: 0, offsetY: 0 });
    });

    it("grows height when dragging the south handle down, top edge fixed", () => {
      const result = computeResizeResult(session({ direction: "s" }), 500, 340, DEFAULT_RESIZE_CONSTRAINTS);

      expect(result).toEqual({ preferredWidth: 200, preferredHeight: 140, offsetX: 0, offsetY: 0 });
    });

    it("drives both axes at once for a diagonal (south-east) handle, top-left anchor fixed", () => {
      const result = computeResizeResult(session({ direction: "se" }), 540, 330, DEFAULT_RESIZE_CONSTRAINTS);

      expect(result).toEqual({ preferredWidth: 240, preferredHeight: 130, offsetX: 0, offsetY: 0 });
    });

    it("clamps width to the minimum constraint instead of going negative or to zero", () => {
      const result = computeResizeResult(session({ direction: "e" }), 0, 300, DEFAULT_RESIZE_CONSTRAINTS);

      expect(result.preferredWidth).toBe(DEFAULT_RESIZE_CONSTRAINTS.minWidth);
    });
  });

  describe("west/north anchoring", () => {
    it("west resize (dragging left, growing) keeps the right edge fixed: width grows and offsetX compensates", () => {
      const result = computeResizeResult(session({ direction: "w" }), 440, 300, DEFAULT_RESIZE_CONSTRAINTS);

      // width grew by 60 (500->440 is -60 delta, west subtracts delta)
      expect(result.preferredWidth).toBe(260);
      // offset must shift left by exactly the growth so the right edge (startLeft+startWidth) stays put
      expect(result.offsetX).toBe(-60);
      const renderedLeft = session().startLeft + result.offsetX;
      const renderedRight = renderedLeft + result.preferredWidth;
      expect(renderedRight).toBe(session().startLeft + session().startWidth);
    });

    it("west resize (dragging right, shrinking) keeps the right edge fixed", () => {
      const result = computeResizeResult(session({ direction: "w" }), 560, 300, DEFAULT_RESIZE_CONSTRAINTS);

      expect(result.preferredWidth).toBe(140);
      expect(result.offsetX).toBe(60);
      const renderedLeft = session().startLeft + result.offsetX;
      expect(renderedLeft + result.preferredWidth).toBe(session().startLeft + session().startWidth);
    });

    it("west resize composes onto a pre-existing offsetX rather than resetting it", () => {
      const result = computeResizeResult(
        session({ direction: "w", startOffsetX: -60 }),
        440,
        300,
        DEFAULT_RESIZE_CONSTRAINTS,
      );

      expect(result.offsetX).toBe(-120);
    });

    it("north resize keeps the bottom edge fixed: height grows and offsetY compensates", () => {
      const result = computeResizeResult(session({ direction: "n" }), 500, 260, DEFAULT_RESIZE_CONSTRAINTS);

      expect(result.preferredHeight).toBe(140);
      expect(result.offsetY).toBe(-40);
      const renderedTop = session().startTop + result.offsetY;
      expect(renderedTop + result.preferredHeight).toBe(session().startTop + session().startHeight);
    });

    it("east resize never touches offsetX even with a pre-existing offset", () => {
      const result = computeResizeResult(
        session({ direction: "e", startOffsetX: -60 }),
        560,
        300,
        DEFAULT_RESIZE_CONSTRAINTS,
      );

      expect(result.offsetX).toBe(-60);
    });

    it("north-west drives both anchored axes at once", () => {
      const result = computeResizeResult(session({ direction: "nw" }), 470, 280, DEFAULT_RESIZE_CONSTRAINTS);

      expect(result.preferredWidth).toBe(230);
      expect(result.offsetX).toBe(-30);
      expect(result.preferredHeight).toBe(120);
      expect(result.offsetY).toBe(-20);
    });

    it("south-west updates the width/offsetX axis and the unanchored height axis", () => {
      const result = computeResizeResult(session({ direction: "sw" }), 470, 330, DEFAULT_RESIZE_CONSTRAINTS);

      expect(result.preferredWidth).toBe(230);
      expect(result.offsetX).toBe(-30);
      expect(result.preferredHeight).toBe(130);
      expect(result.offsetY).toBe(0);
    });

    it("west resize still respects the minimum width constraint", () => {
      const result = computeResizeResult(session({ direction: "w" }), 10000, 300, DEFAULT_RESIZE_CONSTRAINTS);

      expect(result.preferredWidth).toBe(DEFAULT_RESIZE_CONSTRAINTS.minWidth);
    });
  });

  describe("boundary clamping", () => {
    it("east resize clamps at the right containing-block boundary", () => {
      const bounds: ResizeBounds = { left: -10000, top: -10000, right: 560, bottom: 10000 };
      const result = computeResizeResult(
        session({ direction: "e", bounds }),
        10000,
        300,
        DEFAULT_RESIZE_CONSTRAINTS,
      );

      // startLeft (300) + width must not exceed bounds.right (560)
      expect(result.preferredWidth).toBe(260);
    });

    it("west resize clamps at the left containing-block boundary", () => {
      const bounds: ResizeBounds = { left: 200, top: -10000, right: 10000, bottom: 10000 };
      const result = computeResizeResult(
        session({ direction: "w", bounds }),
        -10000,
        300,
        DEFAULT_RESIZE_CONSTRAINTS,
      );

      // rendered left edge must not cross bounds.left (200); startLeft+startWidth=500 is the fixed right edge
      expect(result.preferredWidth).toBe(300);
      const renderedLeft = session().startLeft + result.offsetX;
      expect(renderedLeft).toBe(200);
    });

    it("south resize clamps at the bottom containing-block boundary", () => {
      const bounds: ResizeBounds = { left: -10000, top: -10000, right: 10000, bottom: 300 };
      const result = computeResizeResult(
        session({ direction: "s", bounds }),
        500,
        10000,
        DEFAULT_RESIZE_CONSTRAINTS,
      );

      expect(result.preferredHeight).toBe(150);
    });

    it("north resize clamps at the top containing-block boundary", () => {
      const bounds: ResizeBounds = { left: -10000, top: 100, right: 10000, bottom: 10000 };
      const result = computeResizeResult(
        session({ direction: "n", bounds }),
        500,
        -10000,
        DEFAULT_RESIZE_CONSTRAINTS,
      );

      expect(result.preferredHeight).toBe(150);
      const renderedTop = session().startTop + result.offsetY;
      expect(renderedTop).toBe(100);
    });

    it("diagonal resize clamps both axes against the boundary simultaneously", () => {
      const bounds: ResizeBounds = { left: -10000, top: -10000, right: 560, bottom: 330 };
      const result = computeResizeResult(
        session({ direction: "se", bounds }),
        10000,
        10000,
        DEFAULT_RESIZE_CONSTRAINTS,
      );

      expect(result.preferredWidth).toBe(260);
      expect(result.preferredHeight).toBe(180);
    });

    it("an oversized pointer movement never produces overflow past the boundary", () => {
      const bounds: ResizeBounds = { left: -10000, top: -10000, right: 900, bottom: 10000 };
      const result = computeResizeResult(
        session({ direction: "e", bounds }),
        999999,
        300,
        DEFAULT_RESIZE_CONSTRAINTS,
      );

      expect(session().startLeft + result.preferredWidth).toBeLessThanOrEqual(900);
    });

    it("respects a nested node's tighter containing boundary independent of the page sheet", () => {
      // A boundary tighter than the page sheet (e.g. a padded parent container).
      const bounds: ResizeBounds = { left: -10000, top: -10000, right: 420, bottom: 10000 };
      const result = computeResizeResult(
        session({ direction: "e", startWidth: 100, startLeft: 300, bounds }),
        10000,
        300,
        DEFAULT_RESIZE_CONSTRAINTS,
      );

      expect(result.preferredWidth).toBe(120);
    });
  });
});
