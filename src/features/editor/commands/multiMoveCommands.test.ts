import { describe, expect, it } from "vitest";
import { MAX_NAVIGATION_LINKS } from "@/features/editor/commands/navigationLinkCommands";
import { createPaginationNode } from "@/features/editor/factories/navigationCompositions";
import type { EditorElementNode } from "@/features/editor/types/document";
import { getPaginationParts } from "@/features/editor/types/pagination";
import { approximateFreeContainerSize } from "@/features/editor/utils/approximateFreeContainerSize";
import { findNodeById, findParentId } from "@/features/editor/utils/findNodeById";
import { planMultiMove, validateMultiMove } from "./multiMoveCommands";

/** BC-12.4 — the all-or-nothing multi-element move planner. */

const p = (id: string, extra: Partial<EditorElementNode> = {}): EditorElementNode => ({ id, tag: "p", text: id, ...extra });
const childIds = (doc: EditorElementNode, id: string) => (findNodeById(doc, id)?.children ?? []).map((child) => child.id);
const moved = (plan: ReturnType<typeof planMultiMove>) => {
  if (plan.status !== "moved") throw new Error(`expected moved, got ${JSON.stringify(plan)}`);
  return plan.document;
};

const base: EditorElementNode = {
  id: "page-root",
  tag: "page",
  children: [
    { id: "s1", tag: "section", children: [p("a"), p("b"), p("c"), p("d")] },
    { id: "s2", tag: "section", children: [p("x"), { id: "box", tag: "div", children: [p("deep")] }] },
    { id: "list", tag: "ul", children: [{ id: "li", tag: "li", text: "Item" }] },
  ],
};

describe("planMultiMove — order, roots and atomicity", () => {
  it("moves two siblings together, in document order (not selection order)", () => {
    const doc = moved(planMultiMove(base, ["c", "a"], "d", "after"));
    expect(childIds(doc, "s1")).toEqual(["b", "d", "a", "c"]);
  });

  it("cross-container roots are removed once each and inserted together in document order", () => {
    const doc = moved(planMultiMove(base, ["x", "b"], "s1", "inside"));
    expect(childIds(doc, "s1")).toEqual(["a", "c", "d", "b", "x"]);
    expect(childIds(doc, "s2")).toEqual(["box"]);
  });

  it("parent + child selected: the child travels inside its parent, never separately or twice", () => {
    const plan = planMultiMove(base, ["box", "deep", "a"], "list", "after");
    const doc = moved(plan);
    expect(plan.status === "moved" && plan.rootIds).toEqual(["a", "box"]);
    expect(childIds(doc, "page-root")).toEqual(["s1", "s2", "list", "a", "box"]);
    expect(childIds(doc, "box")).toEqual(["deep"]);
  });

  it("keeps every object (ids, HTML ids, interactions, children) and moves the same objects", () => {
    const withInteraction: EditorElementNode = {
      ...base,
      children: [
        { id: "s1", tag: "section", children: [p("a", { htmlId: "alpha", interactions: [{ id: "i1", trigger: "click", action: "toggle", targetId: "x" }] }), p("b")] },
        { id: "s2", tag: "section", children: [p("x")] },
      ],
    };
    const before = { a: findNodeById(withInteraction, "a"), b: findNodeById(withInteraction, "b") };
    const doc = moved(planMultiMove(withInteraction, ["a", "b"], "x", "after"));
    expect(findNodeById(doc, "a")).toBe(before.a);
    expect(findNodeById(doc, "b")).toBe(before.b);
    expect(findNodeById(doc, findNodeById(doc, "a")!.interactions![0].targetId)).toBeDefined();
  });

  it("an invalid batch is refused as a whole (one incompatible root refuses all)", () => {
    expect(planMultiMove(base, ["a", "li"], "s2", "inside")).toEqual({ status: "rejected", reason: "incompatible-parent" });
    expect(planMultiMove(base, ["a", "b"], "list", "inside")).toEqual({ status: "rejected", reason: "incompatible-parent" });
  });

  it("refuses self, descendant and page targets; never creates a cycle", () => {
    expect(planMultiMove(base, ["s2", "a"], "box", "inside")).toEqual({ status: "rejected", reason: "descendant" });
    expect(planMultiMove(base, ["s2", "a"], "deep", "before")).toEqual({ status: "rejected", reason: "descendant" });
    expect(planMultiMove(base, ["s2", "a"], "s2", "inside")).toEqual({ status: "rejected", reason: "self" });
    // The page itself is never part of a moved set (existingSelectedIds, as for copy/cut): only "a" moves.
    const withPage = planMultiMove(base, ["page-root", "a"], "s2", "inside");
    expect(withPage.status === "moved" && withPage.rootIds).toEqual(["a"]);
    expect(planMultiMove(base, ["a", "b"], "page-root", "after")).toEqual({ status: "rejected", reason: "beside-page" });
  });

  it("before/after a moved root means the gap it leaves", () => {
    // a, b, c, d — move b and c "after c": the gap where c was = unchanged order.
    expect(planMultiMove(base, ["b", "c"], "c", "after")).toEqual({ status: "unchanged" });
    // move a and c "before c": a joins c's gap → b, a, c, d.
    expect(childIds(moved(planMultiMove(base, ["a", "c"], "c", "before")), "s1")).toEqual(["b", "a", "c", "d"]);
  });

  it("no-op: a contiguous block dropped where it is, before its next sibling, or appended where it already ends", () => {
    expect(planMultiMove(base, ["b", "c"], "a", "after")).toEqual({ status: "unchanged" });
    expect(planMultiMove(base, ["b", "c"], "d", "before")).toEqual({ status: "unchanged" });
    expect(planMultiMove(base, ["c", "d"], "s1", "inside")).toEqual({ status: "unchanged" });
    // A genuine reorder inside the selected set's own parent is not a no-op.
    expect(childIds(moved(planMultiMove(base, ["a", "c"], "b", "after")), "s1")).toEqual(["b", "a", "c", "d"]);
  });

  it("validateMultiMove agrees with the plan (null for moved and unchanged)", () => {
    expect(validateMultiMove(base, ["a", "b"], "s2", "inside")).toBeNull();
    expect(validateMultiMove(base, ["b", "c"], "a", "after")).toBeNull();
    expect(validateMultiMove(base, ["a", "li"], "s2", "inside")).toBe("incompatible-parent");
    // One root validates like a single element.
    expect(validateMultiMove(base, ["box", "deep"], "s1", "inside")).toBeNull();
  });
});

describe("planMultiMove — component rules on the final tree", () => {
  const links = (prefix: string, count: number) => Array.from({ length: count }, (_, index) => ({ id: `${prefix}${index}`, tag: "a", text: `${prefix}${index}`, href: "#" }));

  it("Navbar: 10 links accept 2 more, 11 links refuse a batch of 2; reorders inside a full nav and moves out are allowed", () => {
    const doc = (count: number): EditorElementNode => ({ id: "page-root", tag: "page", children: [{ id: "nav", tag: "nav", children: links("n", count) }, { id: "box", tag: "div", children: links("e", 2) }] });
    expect(planMultiMove(doc(10), ["e0", "e1"], "nav", "inside").status).toBe("moved");
    expect(planMultiMove(doc(11), ["e0", "e1"], "nav", "inside")).toEqual({ status: "rejected", reason: "navigation-link-limit" });
    expect(planMultiMove(doc(MAX_NAVIGATION_LINKS), ["n0", "n1"], "n11", "after").status).toBe("moved");
    expect(planMultiMove(doc(MAX_NAVIGATION_LINKS), ["n0", "n1"], "box", "inside").status).toBe("moved");
    // Moving one link out while two come in nets +1: 11 → 12 is allowed.
    expect(planMultiMove(doc(11), ["n0", "e0"], "box", "inside").status).toBe("moved");
  });

  it("Pagination: controls are fixed; pages stay between Previous and Next; one current page; the page limit counts the batch", () => {
    const pagination = createPaginationNode();
    const parts = getPaginationParts(pagination);
    const doc: EditorElementNode = { id: "page-root", tag: "page", children: [pagination, { id: "box", tag: "div", children: links("e", 10) }] };
    const [one, two] = parts.pages;
    expect(planMultiMove(doc, [parts.controls.next!.id, one.id], "box", "inside")).toEqual({ status: "rejected", reason: "pagination-control" });
    expect(planMultiMove(doc, [one.id, two.id], parts.controls.next!.id, "after")).toEqual({ status: "rejected", reason: "pagination-order" });
    const reordered = moved(planMultiMove(doc, [one.id, two.id], parts.pages[2].id, "after"));
    expect(getPaginationParts(findNodeById(reordered, pagination.id)!).pages.map((page) => page.id)).toEqual([parts.pages[2].id, one.id, two.id]);
    // 3 pages + 10 = 13 > 12.
    expect(planMultiMove(doc, links("e", 10).map((link) => link.id), parts.pages[2].id, "after")).toEqual({ status: "rejected", reason: "pagination-page-limit" });
    // The current page leaving with another page becomes an ordinary page (BC-09.5).
    const out = planMultiMove(doc, [one.id, two.id], "box", "inside");
    expect(out.status === "moved" && [...out.formerCurrentPageIds]).toEqual([one.id]);
    expect(out.status === "moved" && findNodeById(out.document, one.id)?.ariaCurrent).toBeUndefined();
  });

  const freeBox = (id: string, width: number, height: number, children: EditorElementNode[] = []): EditorElementNode => ({
    id,
    tag: "div",
    layoutMode: "free",
    dimensions: { preferredWidth: width, preferredHeight: height, offsetX: 0, offsetY: 0 },
    children,
  });

  it("Free: roots entering get positions inside the bounds; roots from one Free container keep their arrangement; no two share a spot", () => {
    const doc: EditorElementNode = {
      id: "page-root",
      tag: "page",
      children: [
        freeBox("from", 600, 400, [p("f1", { freeLayout: { x: 300, y: 100, width: 100, height: 40 } }), p("f2", { freeLayout: { x: 360, y: 180, width: 100, height: 40 } })]),
        { id: "flow", tag: "div", children: [p("m")] },
        freeBox("to", 600, 400),
      ],
    };
    const after = moved(planMultiMove(doc, ["f1", "f2", "m"], "to", "inside"));
    const bounds = approximateFreeContainerSize(findNodeById(after, "to")!);
    const geometry = (id: string) => findNodeById(after, id)!.freeLayout!;
    for (const id of ["f1", "f2", "m"]) {
      const g = geometry(id);
      expect(g.x).toBeGreaterThanOrEqual(0);
      expect(g.y).toBeGreaterThanOrEqual(0);
      expect(g.x + g.width).toBeLessThanOrEqual(bounds.width);
      expect(g.y + g.height).toBeLessThanOrEqual(bounds.height);
    }
    expect({ dx: geometry("f2").x - geometry("f1").x, dy: geometry("f2").y - geometry("f1").y }).toEqual({ dx: 60, dy: 80 });
    expect(geometry("m").y).toBeGreaterThan(geometry("f2").y); // the Flow root is stacked below, not on top
  });

  it("Free: a reorder inside the same Free container keeps every coordinate", () => {
    const one = { x: 10, y: 10, width: 100, height: 40 };
    const two = { x: 50, y: 30, width: 100, height: 40 };
    const doc: EditorElementNode = { id: "page-root", tag: "page", children: [freeBox("free", 600, 400, [p("o1", { freeLayout: one }), p("o2", { freeLayout: two }), p("o3", { freeLayout: one })])] };
    const after = moved(planMultiMove(doc, ["o1", "o2"], "o3", "after"));
    expect(childIds(after, "free")).toEqual(["o3", "o1", "o2"]);
    expect(findNodeById(after, "o1")!.freeLayout).toEqual(one);
    expect(findNodeById(after, "o2")!.freeLayout).toEqual(two);
  });

  it("Free: a group larger than the destination is refused as a whole", () => {
    const doc: EditorElementNode = { id: "page-root", tag: "page", children: [freeBox("tiny", 120, 60), { id: "flow", tag: "div", children: [p("m1"), p("m2"), p("m3")] }] };
    expect(planMultiMove(doc, ["m1", "m2", "m3"], "tiny", "inside")).toEqual({ status: "rejected", reason: "free-bounds" });
  });

  it("Grid: placements are clamped for roots entering a smaller grid; Flex settings are kept", () => {
    const doc: EditorElementNode = {
      id: "page-root",
      tag: "page",
      children: [
        { id: "wide", tag: "div", flowLayout: { display: "grid", grid: { columns: 4, rows: 2, columnGap: 0, rowGap: 0 } }, children: [p("g1", { gridChild: { columnStart: 4, columnSpan: 1, rowStart: 2, rowSpan: 1 } }), p("g2", { flexChild: { grow: 1, shrink: 1, basis: "auto", alignSelf: "auto" } })] },
        { id: "narrow", tag: "div", flowLayout: { display: "grid", grid: { columns: 2, rows: 1, columnGap: 0, rowGap: 0 } }, children: [] },
      ],
    };
    const after = moved(planMultiMove(doc, ["g1", "g2"], "narrow", "inside"));
    expect(findNodeById(after, "g1")!.gridChild).toEqual({ columnStart: 2, columnSpan: 1, rowStart: 1, rowSpan: 1 });
    expect(findNodeById(after, "g2")!.flexChild).toEqual({ grow: 1, shrink: 1, basis: "auto", alignSelf: "auto" });
  });

  it("forms: a control leaving its label is allowed and flagged", () => {
    const doc: EditorElementNode = { id: "page-root", tag: "page", children: [{ id: "label", tag: "label", children: [p("cap"), { id: "field", tag: "input" }] }, { id: "box", tag: "div", children: [] }] };
    const plan = planMultiMove(doc, ["cap", "field"], "box", "inside");
    expect(plan.status === "moved" && plan.leftLabel).toBe(true);
    expect(plan.status === "moved" && findParentId(plan.document, "field")).toBe("box");
  });
});
