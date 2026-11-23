import { describe, expect, it } from "vitest";
import type { Rect } from "./freeLayoutFrame";
import {
  ALL_EDGES,
  buildSnapIndex,
  NO_SNAP_LOCK,
  parentSnapTarget,
  resolveSnap,
  selectSnapTargets,
  SNAP_THRESHOLD_SCREEN_PX,
  translateBox,
  type SnapAdjust,
  type SnapLock,
  type SnapRequest,
  type SnapTarget,
} from "./snapEngine";
import { computeEqualSpacingCandidates } from "./snapEqualSpacing";

/** BC-13.2 — the pure snapping engine. */

const parent = parentSnapTarget("parent", { width: 600, height: 400 });
const el = (id: string, rect: Rect, rank = 0): SnapTarget => ({ id, kind: "element", rect, rank });
const box = (x: number, y: number, width = 100, height = 50): Rect => ({ x, y, width, height });

function snap(proposed: Rect, targets: SnapTarget[], extra: Partial<SnapRequest> = {}) {
  return resolveSnap({ box: proposed, edges: ALL_EDGES, index: buildSnapIndex(targets), enabled: true, adjust: translateBox, ...extra });
}

describe("alignment types", () => {
  const other = el("other", box(300, 200, 120, 60));

  it("left, right and center on x; top, bottom and center on y", () => {
    expect(snap(box(296, 10), [other]).box.x).toBe(300); // left ↔ left
    expect(snap(box(318, 10), [other]).box.x).toBe(320); // right ↔ right (320 + 100 = 420)
    expect(snap(box(308, 10), [other]).box.x).toBe(310); // center ↔ center (360)
    expect(snap(box(10, 196), [other]).box.y).toBe(200); // top ↔ top
    expect(snap(box(10, 212), [other]).box.y).toBe(210); // bottom ↔ bottom (260)
    expect(snap(box(10, 203), [other]).box.y).toBe(205); // center ↔ center (230)
  });

  it("parent edges and centre (padding box)", () => {
    expect(snap(box(4, 397 - 50), [parent]).box).toEqual(box(0, 350));
    expect(snap(box(247, 5), [parent]).box.x).toBe(250); // centre 300
    expect(snap(box(497, 5), [parent]).box.x).toBe(500); // right 600
  });

  it("axes are independent: x can snap while y doesn't", () => {
    const result = snap(box(296, 100), [other]);
    expect(result.x.applied).toBe(true);
    expect(result.y.match).toBeNull();
    expect(result.box).toEqual(box(300, 100));
  });

  it("overlapping boxes still align (overlap allowed, D14/D40)", () => {
    const result = snap(box(303, 205), [other]); // overlaps 'other'
    expect(result.x.applied).toBe(true);
    expect(result.box.x).toBe(300);
  });
});

describe("threshold (6 screen px, scale-aware)", () => {
  const target = el("t", box(100, 300, 50, 50));
  it("inside, exactly at and outside 6px", () => {
    expect(snap(box(94.5, 0), [target]).x.applied).toBe(true);
    expect(snap(box(94, 0), [target]).x.match?.distance).toBe(6);
    expect(snap(box(93.9, 0), [target]).x.match).toBeNull();
    expect(SNAP_THRESHOLD_SCREEN_PX).toBe(6);
  });

  it("at scale 2 the same 6 screen px are 3 local px", () => {
    expect(snap(box(97, 0), [target], { scale: 2 }).x.applied).toBe(true);
    expect(snap(box(96.9, 0), [target], { scale: 2 }).x.match).toBeNull();
  });
});

describe("ranking, ties and deduplication", () => {
  it("closest wins", () => {
    const result = snap(box(103, 0, 2, 2), [el("a", box(100, 300, 2, 2)), el("b", box(108, 300, 2, 2))]);
    expect(result.x.match?.coordinate).toBe(102); // a's right edge, 1 away (b's left is 5 away)
  });

  it("an exact tie: the parent beats an element", () => {
    // start 5: parent left (0) and the element's right edge (10) are both 5 away.
    const result = snap(box(5, 100, 300, 20), [parentSnapTarget("p", { width: 2000, height: 2000 }), el("e", box(-90, 500, 100, 10))]);
    expect(result.x.match?.coordinate).toBe(0);
    expect(result.x.match?.line?.references[0]).toMatchObject({ kind: "parent" });
  });

  it("an exact tie between elements: the lower rank wins (rank is the caller's stable order)", () => {
    // start 106: e1's right edge (102) and e2's left edge (110) are both 4 away.
    const e1 = el("e1", box(100, 300, 2, 2), 2);
    const e2 = el("e2", box(110, 300, 2, 2), 1);
    expect(snap(box(106, 0, 300, 2), [e1, e2]).x.match?.coordinate).toBe(110);
    expect(snap(box(106, 0, 300, 2), [{ ...e1, rank: 0 }, e2]).x.match?.coordinate).toBe(102);
  });

  it("an exact tie on the same line: the moving box's start edge beats centre and end", () => {
    // A 200-wide box at 98 against a 200-wide target at 100: start, centre and end are all 2 away.
    const result = snap(box(98, 0, 200, 20), [el("t", box(100, 300, 200, 10))]);
    expect(result.x.match).toMatchObject({ edge: "start", coordinate: 100 });
  });

  it("identical coordinates from several targets are one line with all references (D34)", () => {
    const index = buildSnapIndex([el("a", box(100, 0, 50, 50), 1), el("b", box(100, 100, 80, 50), 0), parentSnapTarget("p", { width: 150, height: 400 })]);
    const line100 = index.x.find((line) => line.coordinate === 100)!;
    expect(line100.references.map((ref) => `${ref.targetId}:${ref.edge}`)).toEqual(["b:start", "a:start"]);
    const line150 = index.x.find((line) => line.coordinate === 150)!;
    expect(line150.references.map((ref) => `${ref.targetId}:${ref.edge}`)).toEqual(["p:end", "a:end"]); // parent first
    expect(new Set(index.x.map((line) => line.coordinate)).size).toBe(index.x.length);
  });

  it("is independent of input order (never DOM order)", () => {
    const targets = [el("a", box(200, 0, 30, 30), 0), el("b", box(205, 50, 30, 30), 1), el("c", box(190, 90, 30, 30), 2)];
    const forward = snap(box(197, 300, 20, 20), targets);
    const backward = snap(box(197, 300, 20, 20), [...targets].reverse());
    expect(backward.x.match).toEqual(forward.x.match);
  });
});

describe("locking and hysteresis", () => {
  const near = el("near", box(100, 300, 10, 10), 0);
  const far = el("far", box(104, 400, 10, 10), 1);

  it("a lock holds up to 1.5× the threshold, then releases", () => {
    // Same widths, so start, centre and end are always equally far from the target's lines.
    const wide = el("wide", box(100, 300, 200, 10), 0);
    const first = snap(box(98, 0, 200, 20), [wide]);
    expect(first.x.match).toMatchObject({ edge: "start", coordinate: 100 });
    const held = snap(box(92.5, 0, 200, 20), [wide], { lock: first.lock }); // 7.5px away: beyond 6, within 9
    expect(held.x.applied).toBe(true);
    expect(held.box.x).toBe(100);
    expect(snap(box(92.5, 0, 200, 20), [wide]).x.match).toBeNull(); // without the lock: out of reach
    expect(snap(box(90.9, 0, 200, 20), [wide], { lock: first.lock }).x.match).toBeNull(); // 9.1px: released
  });

  it("no jitter between nearby targets: a lock is replaced only by a candidate closer by ≥ 1px", () => {
    const locked: SnapLock = { x: { kind: "alignment", edge: "start", coordinate: 100 }, y: null };
    // start at 102: near (100) is 2 away, far (104) is 2 away → tie keeps the lock.
    expect(snap(box(102, 0, 20, 20), [near, far], { lock: locked }).x.match?.coordinate).toBe(100);
    // start at 102.6: near 2.6, far 1.4 → closer by 1.2 ≥ 1 → switch.
    expect(snap(box(102.6, 0, 20, 20), [near, far], { lock: locked }).x.match?.coordinate).toBe(104);
    // start at 102.4: near 2.4, far 1.6 → closer by only 0.8 → keep.
    expect(snap(box(102.4, 0, 20, 20), [near, far], { lock: locked }).x.match?.coordinate).toBe(100);
  });

  it("a held lock whose target is gone is simply re-evaluated (D37)", () => {
    const locked: SnapLock = { x: { kind: "alignment", edge: "start", coordinate: 100 }, y: null };
    expect(snap(box(103, 0, 20, 20), [far], { lock: locked }).x.match?.coordinate).toBe(104);
  });
});

describe("constraints and disabled snapping", () => {
  const target = el("t", box(500, 0, 50, 50));

  it("a candidate the operation rejects produces no snap and no guide", () => {
    const noFurtherThan480: SnapAdjust = (b, axis, edge, delta) => {
      const next = translateBox(b, axis, edge, delta);
      return next && next.x + next.width > 480 ? null : next;
    };
    const result = snap(box(396, 0), [target], { adjust: noFurtherThan480 }); // right 496 → 500 would exceed 480
    expect(result.x.match).toBeNull();
    expect(result.box.x).toBe(396);
  });

  it("a clamp that lands elsewhere is not an alignment (no false guide, D46)", () => {
    const clampTo390: SnapAdjust = (b, axis, edge, delta) => {
      const next = translateBox(b, axis, edge, delta);
      return next ? { ...next, x: Math.min(next.x, 390) } : null;
    };
    expect(snap(box(396, 0), [target], { adjust: clampTo390 }).x.match).toBeNull();
  });

  it("disabled automatic snapping keeps the match (for guides, D22) but never moves the box", () => {
    const result = snap(box(497, 3), [target], { enabled: false });
    expect(result.box).toEqual(box(497, 3));
    expect(result.x).toMatchObject({ applied: false, match: { coordinate: 500, edge: "start" } });
    expect(result.y).toMatchObject({ applied: false, match: { coordinate: 0 } });
  });

  it("resize: only the active edge participates (the right handle snaps the right edge only)", () => {
    const resizeEast: SnapAdjust = (b, axis, edge, delta) => (axis === "x" && edge === "end" ? { ...b, width: b.width + delta } : null);
    const result = snap(box(100, 0, 396), [target], { edges: { x: ["end"], y: [] }, adjust: resizeEast });
    expect(result.box).toEqual({ x: 100, y: 0, width: 400, height: 50 });
    expect(result.y.match).toBeNull();
  });
});

describe("target eligibility (separate from evaluation)", () => {
  it("hidden and excluded (the moving element and its subtree) targets are dropped; partially visible kept; fully clipped dropped", () => {
    const targets = selectSnapTargets(
      [
        { id: "visible", rect: box(0, 0), rank: 0, hidden: false },
        { id: "hidden", rect: box(0, 0), rank: 1, hidden: true },
        { id: "moving", rect: box(0, 0), rank: 2, hidden: false },
        { id: "partly", rect: box(150, 0), rank: 3, hidden: false, visibleRegion: box(0, 0, 200, 200) },
        { id: "clipped", rect: box(300, 0), rank: 4, hidden: false, visibleRegion: box(0, 0, 200, 200) },
        { id: "line", rect: { x: 50, y: 20, width: 100, height: 0 }, rank: 5, hidden: false, visibleRegion: box(0, 0, 200, 200) },
      ],
      new Set(["moving"]),
    );
    expect(targets.map((target) => target.id)).toEqual(["visible", "partly", "line"]);
  });
});

describe("equal spacing through the same engine", () => {
  const a = el("a", box(0, 0, 100, 50), 0);
  const b = el("b", box(140, 0, 100, 50), 1); // gap 40

  it("repeat-after and centre-between are candidates with the same threshold; overlapping boxes give none", () => {
    const moving = box(276, 0, 100, 50);
    const spacing = computeEqualSpacingCandidates("x", moving, [a, b]);
    const result = snap(moving, [], { spacing });
    expect(result.box.x).toBe(280); // b.end 240 + gap 40
    expect(result.x.match).toMatchObject({ kind: "spacing", spacing: { mode: "repeat-after", gap: 40 } });
    expect(computeEqualSpacingCandidates("x", moving, [a, el("over", box(80, 0, 100, 50))])).toEqual([]);
  });

  it("alignment beats spacing on an exact tie", () => {
    const moving = box(276, 0, 100, 50);
    const aligned = el("aligned", box(280, 200, 10, 10), 5);
    const result = snap(moving, [aligned], { spacing: computeEqualSpacingCandidates("x", moving, [a, b]) });
    expect(result.x.match?.kind).toBe("alignment");
  });
});

describe("performance (pure engine, ~1,000 targets)", () => {
  it("builds the index once and resolves 1,000 frames quickly", () => {
    const targets: SnapTarget[] = [parent];
    for (let i = 0; i < 1000; i++) targets.push(el(`e${i}`, box((i * 37) % 560, (i * 53) % 360, 20 + (i % 30), 15 + (i % 20)), i));
    const started = performance.now();
    const index = buildSnapIndex(targets);
    const built = performance.now();
    let lock = NO_SNAP_LOCK;
    for (let frame = 0; frame < 1000; frame++) {
      const result = resolveSnap({ box: box(frame % 500, (frame * 7) % 350, 40, 30), edges: ALL_EDGES, index, enabled: true, adjust: translateBox, lock });
      lock = result.lock;
    }
    const resolved = performance.now();
    console.log(`[BC-13.2 bench] index ${index.x.length + index.y.length} lines in ${(built - started).toFixed(1)} ms; 1,000 frames in ${(resolved - built).toFixed(1)} ms`);
    expect(resolved - built).toBeLessThan(500);
  });
});
