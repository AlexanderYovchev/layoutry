import { describe, expect, it } from "vitest";
import {
  AUTO_SCROLL_EDGE_PX,
  AUTO_SCROLL_MAX_FRAME_MS,
  AUTO_SCROLL_MAX_SPEED,
  AUTO_SCROLL_MIN_SPEED,
  autoScrollSpeed,
  planAutoScroll,
  type ScrollerState,
} from "@/features/canvas/utils/freeAutoScroll";

const room = (r: Partial<ScrollerState["room"]> = {}): ScrollerState["room"] => ({ left: 0, right: 0, up: 0, down: 0, ...r });
const scroller = (visible: ScrollerState["visible"], r: Partial<ScrollerState["room"]>): ScrollerState => ({ visible, room: room(r) });

describe("freeAutoScroll (BC-13.5, D20)", () => {
  it("speed: zero outside the edge band, ramping up to the maximum at (or past) the edge", () => {
    expect(autoScrollSpeed(AUTO_SCROLL_EDGE_PX)).toBe(0);
    expect(autoScrollSpeed(AUTO_SCROLL_EDGE_PX - 0.01)).toBeCloseTo(AUTO_SCROLL_MIN_SPEED, 0);
    expect(autoScrollSpeed(AUTO_SCROLL_EDGE_PX / 2)).toBeGreaterThan(AUTO_SCROLL_MIN_SPEED);
    expect(autoScrollSpeed(0)).toBe(AUTO_SCROLL_MAX_SPEED);
    expect(autoScrollSpeed(-50)).toBe(AUTO_SCROLL_MAX_SPEED);
  });

  const workspace = scroller({ left: 0, top: 0, right: 1000, bottom: 800 }, { right: 500, down: 500, left: 500, up: 500 });

  it("scrolls the direction of the nearby edge (right, left, down, up) and nothing in the middle", () => {
    expect(planAutoScroll({ x: 990, y: 400 }, [workspace], 16).x.delta).toBeGreaterThan(0);
    expect(planAutoScroll({ x: 10, y: 400 }, [workspace], 16).x.delta).toBeLessThan(0);
    expect(planAutoScroll({ x: 500, y: 790 }, [workspace], 16).y.delta).toBeGreaterThan(0);
    expect(planAutoScroll({ x: 500, y: 5 }, [workspace], 16).y.delta).toBeLessThan(0);
    const idle = planAutoScroll({ x: 500, y: 400 }, [workspace], 16);
    expect(idle.x.index).toBe(-1);
    expect(idle.y.index).toBe(-1);
  });

  it("scrolls both axes at once near a corner", () => {
    const step = planAutoScroll({ x: 995, y: 795 }, [workspace], 16);
    expect(step.x.delta).toBeGreaterThan(0);
    expect(step.y.delta).toBeGreaterThan(0);
  });

  it("respects the boundary: never more than the remaining room, nothing when there is none", () => {
    const almost = scroller({ left: 0, top: 0, right: 1000, bottom: 800 }, { right: 3 });
    expect(planAutoScroll({ x: 999, y: 400 }, [almost], 16).x.delta).toBe(3);
    const done = scroller({ left: 0, top: 0, right: 1000, bottom: 800 }, {});
    expect(planAutoScroll({ x: 999, y: 400 }, [done], 16).x.index).toBe(-1);
  });

  it("the innermost container that can still scroll wins; an ancestor takes over once it can't", () => {
    const inner = scroller({ left: 100, top: 100, right: 500, bottom: 400 }, { down: 200 });
    const step = planAutoScroll({ x: 300, y: 395 }, [inner, workspace], 16);
    expect(step.y.index).toBe(0);
    const innerDone = scroller({ left: 100, top: 100, right: 500, bottom: 400 }, { down: 0 });
    // The pointer is near the inner bottom edge but far from the workspace's: nothing scrolls.
    expect(planAutoScroll({ x: 300, y: 395 }, [innerDone, workspace], 16).y.index).toBe(-1);
    // Near both bottoms (the inner one exhausted): the workspace scrolls — only one container per axis.
    const nested = scroller({ left: 100, top: 100, right: 500, bottom: 795 }, { down: 0 });
    expect(planAutoScroll({ x: 300, y: 790 }, [nested, workspace], 16).y.index).toBe(1);
  });

  it("only reveals more of the dragged element's own container (reach): capped at its far edge, nothing once it's in view", () => {
    // The container ends 30px below the visible bottom: at most 30px more.
    expect(planAutoScroll({ x: 500, y: 799 }, [workspace], 32, { left: 0, top: 0, right: 1000, bottom: 830 }).y.delta).toBe(30);
    // Its bottom is already visible: no scrolling, even though the scroller has room.
    expect(planAutoScroll({ x: 500, y: 799 }, [workspace], 32, { left: 0, top: 0, right: 1000, bottom: 700 }).y.index).toBe(-1);
    // The same rule upwards.
    expect(planAutoScroll({ x: 500, y: 2 }, [workspace], 32, { left: 0, top: 10, right: 1000, bottom: 700 }).y.index).toBe(-1);
  });

  it("is time-based with a capped frame step (a long stall never jumps far)", () => {
    const slow = planAutoScroll({ x: 1000, y: 400 }, [workspace], 1000).x.delta;
    expect(slow).toBeCloseTo((AUTO_SCROLL_MAX_SPEED * AUTO_SCROLL_MAX_FRAME_MS) / 1000, 5);
  });
});
