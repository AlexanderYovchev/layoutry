import { describe, expect, it } from "vitest";
import type { Rect } from "@/features/canvas/utils/freeLayoutFrame";
import { buildFreeSnapGuides } from "@/features/canvas/utils/buildFreeSnapGuides";
import {
  controlledEdges,
  isValidFreeResizeGeometry,
  resolveFreeResizeSnap,
  type FreeResizeSnapRequest,
} from "@/features/canvas/utils/resolveFreeResizeSnap";
import { buildSnapIndex, NO_SNAP_LOCK, parentSnapTarget, type SnapTarget } from "@/features/canvas/utils/snapEngine";
import type { FreeLayoutGeometry } from "@/features/editor/types/layout";
import type { ResizeDirection } from "@/features/editor/types/resize";

const PARENT = { width: 500, height: 400 };
const element = (id: string, rect: Rect, rank = 1): SnapTarget => ({ id, kind: "element", rect, rank });

function request(overrides: Partial<FreeResizeSnapRequest> & { targets?: SnapTarget[] }): FreeResizeSnapRequest {
  const { targets = [], ...rest } = overrides;
  const all = [parentSnapTarget("parent", PARENT), ...targets];
  return {
    direction: "e",
    proposal: { x: 100, y: 100, width: 100, height: 50 },
    offset: { x: 0, y: 0 },
    axes: { x: true, y: true },
    containment: PARENT,
    constraints: { minWidth: 4, minHeight: 4 },
    aspectRatio: null,
    index: buildSnapIndex(all),
    siblingTargets: targets,
    enabled: true,
    lock: NO_SNAP_LOCK,
    coupledWinner: null,
    ...rest,
  };
}

const right = (g: FreeLayoutGeometry) => g.x + g.width;
const bottom = (g: FreeLayoutGeometry) => g.y + g.height;

describe("resolveFreeResizeSnap (BC-13.4)", () => {
  it("maps each of the eight handles to the edges it controls", () => {
    expect(controlledEdges("n")).toEqual({ x: null, y: "start" });
    expect(controlledEdges("s")).toEqual({ x: null, y: "end" });
    expect(controlledEdges("e")).toEqual({ x: "end", y: null });
    expect(controlledEdges("w")).toEqual({ x: "start", y: null });
    expect(controlledEdges("ne")).toEqual({ x: "end", y: "start" });
    expect(controlledEdges("nw")).toEqual({ x: "start", y: "start" });
    expect(controlledEdges("se")).toEqual({ x: "end", y: "end" });
    expect(controlledEdges("sw")).toEqual({ x: "start", y: "end" });
  });

  // Proposal 100,100 100×50 (right 200, bottom 150); vertical lines at 96/204, horizontal at 96/154,
  // each 4px from an edge. Every handle snaps exactly its controlled edges; the opposite ones stay put.
  const lines = [element("v-left", { x: 90, y: 300, width: 6, height: 6 }, 1), element("v-right", { x: 204, y: 300, width: 6, height: 6 }, 2), element("h-top", { x: 400, y: 90, width: 6, height: 6 }, 3), element("h-bottom", { x: 400, y: 154, width: 6, height: 6 }, 4)];
  const cases: Array<[ResizeDirection, FreeLayoutGeometry]> = [
    ["n", { x: 100, y: 96, width: 100, height: 54 }],
    ["s", { x: 100, y: 100, width: 100, height: 54 }],
    ["e", { x: 100, y: 100, width: 104, height: 50 }],
    ["w", { x: 96, y: 100, width: 104, height: 50 }],
    ["ne", { x: 100, y: 96, width: 104, height: 54 }],
    ["nw", { x: 96, y: 96, width: 104, height: 54 }],
    ["se", { x: 100, y: 100, width: 104, height: 54 }],
    ["sw", { x: 96, y: 100, width: 104, height: 54 }],
  ];
  it.each(cases)("%s: only the active edges snap, the opposite edges stay anchored", (direction, expected) => {
    const { geometry } = resolveFreeResizeSnap(request({ direction, targets: lines }));
    expect(geometry).toEqual(expected);
    if (!direction.includes("w")) expect(geometry.x).toBe(100); // left anchored
    if (!direction.includes("e")) expect(right(geometry)).toBe(200); // right anchored
    if (!direction.includes("n")) expect(geometry.y).toBe(100); // top anchored
    if (!direction.includes("s")) expect(bottom(geometry)).toBe(150); // bottom anchored
  });

  it("an edge handle snaps to the parent's edge and to the parent's centre line", () => {
    expect(resolveFreeResizeSnap(request({ proposal: { x: 300, y: 100, width: 196, height: 50 } })).geometry.width).toBe(200); // right → 500
    const centre = resolveFreeResizeSnap(request({ proposal: { x: 100, y: 100, width: 147, height: 50 } }));
    expect(right(centre.geometry)).toBe(250);
    expect(centre.result.x.match?.line?.references[0].kind).toBe("parent");
  });

  it("snaps to an element's centre line, never moves its own centre, and only within 6px", () => {
    const target = element("t", { x: 260, y: 300, width: 80, height: 20 }); // centre x 300
    expect(right(resolveFreeResizeSnap(request({ targets: [target], proposal: { x: 100, y: 100, width: 194, height: 50 } })).geometry)).toBe(300);
    expect(resolveFreeResizeSnap(request({ targets: [target], proposal: { x: 100, y: 100, width: 193.5, height: 50 } })).geometry.width).toBe(193.5);
  });

  it("an unconstrained corner snaps X and Y independently", () => {
    const targets = [element("a", { x: 210, y: 300, width: 10, height: 10 }), element("b", { x: 400, y: 160, width: 10, height: 10 })];
    const { geometry, result } = resolveFreeResizeSnap(request({ direction: "se", targets, proposal: { x: 100, y: 100, width: 107, height: 57 } }));
    expect(geometry).toEqual({ x: 100, y: 100, width: 110, height: 60 });
    expect(result.x.applied && result.y.applied).toBe(true);
  });

  it("locks with hysteresis: once snapped, the edge stays up to 9px away, then releases", () => {
    const targets = [element("t", { x: 300, y: 300, width: 10, height: 10 })];
    const first = resolveFreeResizeSnap(request({ targets, proposal: { x: 100, y: 100, width: 196, height: 50 } }));
    const held = resolveFreeResizeSnap(request({ targets, lock: first.result.lock, proposal: { x: 100, y: 100, width: 191.5, height: 50 } }));
    expect(right(held.geometry)).toBe(300);
    const released = resolveFreeResizeSnap(request({ targets, lock: held.result.lock, proposal: { x: 100, y: 100, width: 190.5, height: 50 } }));
    expect(released.geometry.width).toBe(190.5);
  });

  it("equal-distance ties resolve deterministically (document rank)", () => {
    const targets = [element("later", { x: 287, y: 300, width: 10, height: 10 }, 5), element("earlier", { x: 303, y: 300, width: 10, height: 10 }, 1)];
    const { geometry } = resolveFreeResizeSnap(request({ targets, proposal: { x: 100, y: 100, width: 200, height: 50 } }));
    expect(right(geometry)).toBe(303);
  });

  it("rejects a candidate below the minimum size (no snap, no match to draw)", () => {
    const targets = [element("t", { x: 101, y: 300, width: 10, height: 10 })];
    const out = resolveFreeResizeSnap(request({ direction: "w", targets, proposal: { x: 96, y: 100, width: 4, height: 50 } }));
    expect(out.geometry).toEqual({ x: 96, y: 100, width: 4, height: 50 });
    expect(out.result.x.match).toBeNull();
  });

  it("rejects a candidate outside the containment rule — including an unreachable padded-container edge (C1)", () => {
    // Containment 497 wide (content box of a padded container) while the padding-box edge is at 500, 4px away.
    const out = resolveFreeResizeSnap(request({ containment: { width: 497, height: 400 }, proposal: { x: 300, y: 100, width: 196, height: 50 } }));
    expect(out.geometry.width).toBe(196);
    expect(out.result.x.match?.coordinate).not.toBe(500);
    const guides = buildFreeSnapGuides("parent", out.result, { ...out.geometry }, new Map(), { x: 0, y: 0, width: 500, height: 400 });
    expect(guides?.vertical?.coordinate).not.toBe(500);
  });

  it("an extra rule (the container-scaling floor) can reject a candidate", () => {
    const targets = [element("t", { x: 300, y: 300, width: 10, height: 10 })];
    const out = resolveFreeResizeSnap(request({ targets, proposal: { x: 100, y: 100, width: 196, height: 50 }, accept: (g) => g.width < 198 }));
    expect(out.geometry.width).toBe(196);
  });

  it("never produces non-finite or negative geometry", () => {
    expect(isValidFreeResizeGeometry({ x: 0, y: 0, width: Number.NaN, height: 10 }, PARENT, { minWidth: 4, minHeight: 4 })).toBe(false);
    expect(isValidFreeResizeGeometry({ x: 0, y: 0, width: Infinity, height: 10 }, { width: Infinity, height: Infinity }, { minWidth: 4, minHeight: 4 })).toBe(false);
    expect(isValidFreeResizeGeometry({ x: -1, y: 0, width: 10, height: 10 }, PARENT, { minWidth: 4, minHeight: 4 })).toBe(false);
    expect(isValidFreeResizeGeometry({ x: 0, y: 0, width: 10, height: 10 }, PARENT, { minWidth: 4, minHeight: 4 })).toBe(true);
  });

  it("Alt / Snap off (enabled false): geometry is the proposal untouched, the match is still reported", () => {
    const targets = [element("t", { x: 300, y: 300, width: 10, height: 10 })];
    const proposal = { x: 100, y: 100, width: 196, height: 50 };
    const out = resolveFreeResizeSnap(request({ targets, proposal, enabled: false }));
    expect(out.geometry).toBe(proposal);
    expect(out.result.x.match?.coordinate).toBe(300);
    expect(out.result.x.applied).toBe(false);
  });

  it("an axis whose rendered size doesn't follow the stored size never snaps", () => {
    const out = resolveFreeResizeSnap(request({ direction: "s", axes: { x: true, y: false }, targets: lines }));
    expect(out.geometry).toEqual({ x: 100, y: 100, width: 100, height: 50 });
  });

  it("margins: the visible box (stored + offset) snaps; the stored width excludes the margin", () => {
    const targets = [element("t", { x: 300, y: 300, width: 10, height: 10 })];
    // Margin-left 8: visual left 108, visual right 108 + 188 = 296 → snaps to 300.
    const out = resolveFreeResizeSnap(request({ targets, offset: { x: 8, y: 0 }, proposal: { x: 100, y: 100, width: 188, height: 50 } }));
    expect(out.geometry).toEqual({ x: 100, y: 100, width: 192, height: 50 });
  });

  it("equal spacing: an east resize snaps its right edge one gap before a pair; a west resize one gap after", () => {
    const pair = [element("a", { x: 300, y: 100, width: 40, height: 50 }, 1), element("b", { x: 370, y: 100, width: 40, height: 50 }, 2)]; // gap 30
    const east = resolveFreeResizeSnap(request({ targets: pair, proposal: { x: 100, y: 100, width: 168, height: 50 } }));
    expect(right(east.geometry)).toBe(270);
    expect(east.result.x.match?.kind).toBe("spacing");
    const guides = buildFreeSnapGuides("parent", east.result, east.geometry, new Map(pair.map((t) => [t.id, t.rect])), { x: 0, y: 0, width: 500, height: 400 });
    expect(guides?.spacing[0]).toMatchObject({ value: 30, achieved: true, gaps: [{ from: 270, to: 300 }, { from: 340, to: 370 }] });

    const leftPair = [element("a", { x: 10, y: 100, width: 40, height: 50 }, 1), element("b", { x: 80, y: 100, width: 40, height: 50 }, 2)];
    const west = resolveFreeResizeSnap(request({ direction: "w", targets: leftPair, proposal: { x: 152, y: 100, width: 100, height: 50 } }));
    expect(west.geometry).toEqual({ x: 150, y: 100, width: 102, height: 50 });
  });

  describe("aspect-ratio-locked corners", () => {
    const ratio = 2; // 200 × 100

    it("both axes honoured when one ratio-preserving rectangle satisfies both", () => {
      const targets = [element("x", { x: 300, y: 300, width: 10, height: 10 }), element("y", { x: 450, y: 200, width: 10, height: 10 })];
      const out = resolveFreeResizeSnap(request({ direction: "se", aspectRatio: ratio, targets, proposal: { x: 100, y: 100, width: 196, height: 98 } }));
      expect(out.geometry).toEqual({ x: 100, y: 100, width: 200, height: 100 });
      expect(out.result.x.applied && out.result.y.applied).toBe(true);
    });

    it("incompatible axes: the closer one wins, the ratio holds, and only the winner is reported", () => {
      // x line at 300 is 4 away; y line at 116 is 2 away (bottom 118) → y wins: height 96, width 192.
      const targets = [element("x", { x: 300, y: 300, width: 10, height: 10 }), element("y", { x: 450, y: 116, width: 10, height: 30 })];
      const out = resolveFreeResizeSnap(request({ direction: "se", aspectRatio: ratio, targets, proposal: { x: 100, y: 20, width: 196, height: 98 } }));
      expect(out.geometry).toEqual({ x: 100, y: 20, width: 192, height: 96 });
      expect(out.geometry.width / out.geometry.height).toBe(ratio);
      expect(out.result.x.match).toBeNull();
      expect(out.coupledWinner).toBe("y");
    });

    it("keeps the previous winner unless the other axis is closer by the switch margin (no oscillation)", () => {
      const targets = [element("x", { x: 300, y: 300, width: 10, height: 10 }), element("y", { x: 450, y: 116, width: 10, height: 30 })];
      // x 3 away, y 2.5 away: y is closer, but by less than 1px → x (the previous winner) stays.
      const out = resolveFreeResizeSnap(request({ direction: "se", aspectRatio: ratio, targets, coupledWinner: "x", proposal: { x: 100, y: 20, width: 197, height: 98.5 } }));
      expect(out.coupledWinner).toBe("x");
      expect(out.geometry).toEqual({ x: 100, y: 20, width: 200, height: 100 });
    });

    it("NW: the bottom-right corner stays anchored while the ratio holds", () => {
      const targets = [element("x", { x: 90, y: 300, width: 10, height: 10 })]; // right edge line at 100
      const out = resolveFreeResizeSnap(request({ direction: "nw", aspectRatio: ratio, targets, proposal: { x: 104, y: 202, width: 196, height: 98 } }));
      expect(right(out.geometry)).toBe(300);
      expect(bottom(out.geometry)).toBe(300);
      expect(out.geometry.width / out.geometry.height).toBe(ratio);
    });

    it("rejects a ratio-coupled snap whose derived dimension would leave the container", () => {
      const targets = [element("x", { x: 282, y: 300, width: 10, height: 10 })];
      // The right edge (276) snapping to 282 means width 162 → height 81 → bottom 381 > containment 380.
      const out = resolveFreeResizeSnap(request({ direction: "se", aspectRatio: ratio, containment: { width: 500, height: 380 }, targets, proposal: { x: 120, y: 300, width: 156, height: 78 } }));
      expect(out.geometry).toEqual({ x: 120, y: 300, width: 156, height: 78 });
      expect(out.result.x.match).toBeNull();
    });
  });
});
