import { afterEach, describe, expect, it, vi } from "vitest";
import type { EditorElementNode } from "@/features/editor/types/document";
import { buildFreeSnapGuides } from "./buildFreeSnapGuides";
import { collectFreeSnapTargets } from "./collectFreeSnapTargets";
import type { FreeContainerFrame } from "./freeLayoutFrame";
import { ALL_EDGES, buildSnapIndex, resolveSnap, translateBox } from "./snapEngine";

/** BC-13.3 — DOM target collection and guide geometry. */

const frame: FreeContainerFrame = { originClientX: 10, originClientY: 20, paddingBox: { width: 500, height: 400 }, containment: { width: 500, height: 400 }, scale: 1 };

function stub(el: Element, left: number, top: number, width: number, height: number) {
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) });
}

function build(html: string) {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.append(host);
  return host;
}

const documentModel: EditorElementNode = {
  id: "page-root",
  tag: "page",
  children: [
    {
      id: "c",
      tag: "div",
      layoutMode: "free",
      children: [
        { id: "mover", tag: "div", children: [{ id: "mover-child", tag: "p" }] },
        { id: "sib", tag: "div", children: [{ id: "nested", tag: "p" }] },
        { id: "clipbox", tag: "div", children: [{ id: "clipped", tag: "p" }, { id: "partial", tag: "p" }] },
        { id: "hidden", tag: "div", display: { visibility: "hidden" } },
        { id: "far", tag: "div" },
        { id: "unlaid", tag: "div" },
      ],
    },
  ],
};

describe("collectFreeSnapTargets", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("parent + visible descendants in local coordinates; excludes the mover's subtree, hidden, fully clipped, offscreen and unlaid-out elements", () => {
    const host = build(`
      <div data-node-id="c">
        <div data-node-id="mover"><p data-node-id="mover-child"></p></div>
        <div data-node-id="sib"><p data-node-id="nested"></p></div>
        <div data-node-id="clipbox" style="overflow-x: hidden; overflow-y: hidden"><p data-node-id="clipped"></p><p data-node-id="partial"></p></div>
        <div data-node-id="hidden"></div>
        <div data-node-id="far"></div>
        <div data-node-id="unlaid"></div>
      </div>`);
    const q = (id: string) => host.querySelector(`[data-node-id="${id}"]`)!;
    stub(q("mover"), 60, 70, 50, 50);
    stub(q("mover-child"), 65, 75, 10, 10);
    stub(q("sib"), 210, 120, 100, 60);
    stub(q("nested"), 220, 130, 20, 20);
    const clipbox = q("clipbox") as HTMLElement;
    stub(clipbox, 310, 220, 100, 100);
    Object.defineProperty(clipbox, "clientWidth", { value: 100 });
    Object.defineProperty(clipbox, "clientHeight", { value: 100 });
    stub(q("clipped"), 450, 220, 30, 30); // entirely right of the clipping box
    stub(q("partial"), 395, 300, 40, 40); // straddles its right edge
    stub(q("hidden"), 10, 20, 30, 30);
    stub(q("far"), 5000, 20, 30, 30); // off the window
    stub(q("unlaid"), 0, 0, 0, 0);
    const result = collectFreeSnapTargets(q("c") as HTMLElement, frame, documentModel, "c", "mover");
    expect(result.targets.map((target) => target.id).join(",")).toBe("c,sib,nested,clipbox,partial");
    expect(result.rectById.get("nested")).toEqual({ x: 210, y: 110, width: 20, height: 20 });
    expect(result.targets[0]).toMatchObject({ kind: "parent", rect: { x: 0, y: 0, width: 500, height: 400 } });
    // Ranks follow document order; equal spacing uses direct siblings only.
    expect(result.targets.find((target) => target.id === "nested")!.rank).toBeGreaterThan(result.targets.find((target) => target.id === "sib")!.rank);
    expect(result.siblingTargets.map((target) => target.id)).toEqual(["sib", "clipbox"]);
  });
});

describe("buildFreeSnapGuides", () => {
  const rectById = new Map([
    ["above", { x: 100, y: 10, width: 50, height: 30 }],
    ["a", { x: 0, y: 300, width: 100, height: 50 }],
    ["b", { x: 140, y: 300, width: 100, height: 50 }],
  ]);
  const parentRect = { x: 0, y: 0, width: 500, height: 400 };

  it("an alignment line spans the mover and the referenced target, with a CSS-px distance label between them", () => {
    const box = { x: 98, y: 100, width: 40, height: 20 };
    const index = buildSnapIndex([{ id: "above", kind: "element", rect: rectById.get("above")!, rank: 0 }]);
    const result = resolveSnap({ box, edges: ALL_EDGES, index, enabled: true, adjust: translateBox });
    const guides = buildFreeSnapGuides("c", result, result.box, rectById, parentRect)!;
    expect(guides.vertical).toEqual({ coordinate: 100, from: 10, to: 120, achieved: true });
    expect(guides.distances).toEqual([{ axis: "y", from: 40, to: 100, at: 100, value: 60 }]);
  });

  it("not applied (Snap off / Alt): the same line is marked not achieved", () => {
    const box = { x: 98, y: 100, width: 40, height: 20 };
    const index = buildSnapIndex([{ id: "above", kind: "element", rect: rectById.get("above")!, rank: 0 }]);
    const result = resolveSnap({ box, edges: ALL_EDGES, index, enabled: false, adjust: translateBox });
    expect(buildFreeSnapGuides("c", result, box, rectById, parentRect)?.vertical?.achieved).toBe(false);
  });

  it("nothing within reach → no guides", () => {
    const result = resolveSnap({ box: { x: 300, y: 200, width: 10, height: 10 }, edges: ALL_EDGES, index: buildSnapIndex([]), enabled: true, adjust: translateBox });
    expect(buildFreeSnapGuides("c", result, { x: 300, y: 200, width: 10, height: 10 }, rectById, parentRect)).toBeNull();
  });
});
