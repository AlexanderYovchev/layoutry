import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MAX_NAVIGATION_LINKS } from "@/features/editor/commands/navigationLinkCommands";
import { moveRejectedMessage, validateMove } from "@/features/editor/commands/moveCommands";
import { createNavbarLinkNode, createPaginationNode } from "@/features/editor/factories/navigationCompositions";
import { getDefaultFreeElementSizeForNode } from "@/features/editor/factories/elementFactories";
import { getPaginationParts } from "@/features/editor/types/pagination";
import type { EditorElementNode } from "@/features/editor/types/document";
import { approximateFreeContainerSize } from "@/features/editor/utils/approximateFreeContainerSize";
import { findNodeById, findParentId } from "@/features/editor/utils/findNodeById";
import { movedOutOfLabelNotice, selectHasUnsavedChanges, useEditorStore } from "./useEditorStore";

/**
 * BC-12.2 — the shared move command (Canvas drag, Structure keyboard):
 * no-op detection, Free entry placement, the Navbar and Pagination rules,
 * Flex/Grid item settings, one Undo step, nothing on a refusal.
 */

const initialState = useEditorStore.getState();
const store = () => useEditorStore.getState();
const node = (id: string) => findNodeById(store().document, id);
const childIds = (id: string) => (node(id)?.children ?? []).map((child) => child.id);
const run = <T,>(action: () => T): T => {
  let result: T | undefined;
  act(() => {
    result = action();
  });
  return result as T;
};

function load(children: EditorElementNode[]) {
  run(() => store().replaceDocument({ id: "page-root", tag: "page", children }));
  run(() => store().markDocumentPersisted(store().document));
}

const p = (id: string, extra: Partial<EditorElementNode> = {}): EditorElementNode => ({ id, tag: "p", text: id, ...extra });

describe("shared move integrity (BC-12.2)", () => {
  beforeEach(() => useEditorStore.setState(initialState, true));
  afterEach(() => useEditorStore.setState(initialState, true));

  describe("no-op moves (G1)", () => {
    beforeEach(() => {
      load([{ id: "box", tag: "div", children: [p("a"), p("b"), p("c")] }, { id: "other", tag: "div", children: [] }]);
      run(() => store().selectOnly("other"));
    });

    it.each([
      ["a before b", "a", "b", "before"],
      ["b after a", "b", "a", "after"],
      ["c inside its own parent (already last)", "c", "box", "inside"],
      ["b before c", "b", "c", "before"],
    ] as const)("%s: unchanged, no history, not dirty, selection kept", (_label, id, target, zone) => {
      const before = store().document;
      const outcome = run(() => store().moveElement(id, target, zone));
      expect(outcome).toEqual({ status: "unchanged" });
      expect(store().document).toBe(before);
      expect(store().past).toHaveLength(0);
      expect(selectHasUnsavedChanges(store())).toBe(false);
      expect(store().selection.ids).toEqual(["other"]);
      expect(store().editorNotice).toBeNull();
    });

    it("a real same-parent reorder still moves (sharing a parent is not a no-op)", () => {
      expect(run(() => store().moveElement("a", "c", "after"))).toEqual({ status: "moved", leftLabel: false });
      expect(childIds("box")).toEqual(["b", "c", "a"]);
      expect(store().past).toHaveLength(1);
      expect(store().selection.ids).toEqual(["a"]);
    });

    it("moving the first child inside its own parent appends it", () => {
      run(() => store().moveElement("a", "box", "inside"));
      expect(childIds("box")).toEqual(["b", "c", "a"]);
    });

    it("cross-parent move keeps the same object identity fields and id", () => {
      const original = node("b");
      run(() => store().moveElement("b", "other", "inside"));
      expect(childIds("box")).toEqual(["a", "c"]);
      expect(childIds("other")).toEqual(["b"]);
      expect(node("b")).toEqual(original);
    });
  });

  describe("Free containers (G2, D8)", () => {
    const freeBox = (id: string, width: number, height: number, children: EditorElementNode[] = []): EditorElementNode => ({
      id,
      tag: "div",
      layoutMode: "free",
      dimensions: { preferredWidth: width, preferredHeight: height, offsetX: 0, offsetY: 0 },
      children,
    });

    it("an element entering a Free container gets a position inside the bounds, at its default size", () => {
      load([freeBox("free", 600, 400, [p("f1", { freeLayout: { x: 0, y: 0, width: 100, height: 40 } })]), { id: "flow", tag: "div", children: [p("mover")] }]);
      run(() => store().moveElement("mover", "free", "inside"));
      const placed = node("mover")!.freeLayout!;
      const size = getDefaultFreeElementSizeForNode({ tag: "p" });
      const bounds = approximateFreeContainerSize(node("free")!);
      expect({ width: placed.width, height: placed.height }).toEqual(size);
      expect(placed.x).toBeGreaterThanOrEqual(0);
      expect(placed.y).toBeGreaterThanOrEqual(0);
      expect(placed.x + placed.width).toBeLessThanOrEqual(bounds.width);
      expect(placed.y + placed.height).toBeLessThanOrEqual(bounds.height);
      // never exactly on top of the existing child
      expect(placed.x === 0 && placed.y === 0).toBe(false);
    });

    it("Free to Free keeps the element's size and re-places it", () => {
      load([
        freeBox("from", 600, 400, [p("mover", { freeLayout: { x: 300, y: 200, width: 120, height: 60 } })]),
        freeBox("to", 600, 400),
      ]);
      run(() => store().moveElement("mover", "to", "inside"));
      const placed = node("mover")!.freeLayout!;
      expect({ width: placed.width, height: placed.height }).toEqual({ width: 120, height: 60 });
    });

    it("a reorder inside the same Free container keeps every coordinate (only the paint order changes)", () => {
      const one = { x: 10, y: 10, width: 100, height: 50 };
      const two = { x: 40, y: 20, width: 100, height: 50 };
      load([freeBox("free", 600, 400, [p("one", { freeLayout: one }), p("two", { freeLayout: two })])]);
      run(() => store().moveElement("one", "two", "after"));
      expect(childIds("free")).toEqual(["two", "one"]);
      expect(node("one")!.freeLayout).toEqual(one);
      expect(node("two")!.freeLayout).toEqual(two);
    });

    it("an ordinary Flow sibling reorder never adds geometry", () => {
      load([{ id: "flow", tag: "div", children: [p("a"), p("b")] }]);
      run(() => store().moveElement("a", "b", "after"));
      expect(node("a")!.freeLayout).toBeUndefined();
      expect(node("a")!.dimensions).toBeUndefined();
    });

    it("an element larger than the destination's bounds is refused atomically, with a reason", () => {
      load([freeBox("tiny", 60, 30), freeBox("from", 600, 400, [p("big", { freeLayout: { x: 0, y: 0, width: 300, height: 200 } })])]);
      const before = store().document;
      const outcome = run(() => store().moveElement("big", "tiny", "inside"));
      expect(outcome).toEqual({ status: "rejected", reason: "free-bounds" });
      expect(store().document).toBe(before);
      expect(store().past).toHaveLength(0);
      expect(store().editorNotice?.message).toBe(moveRejectedMessage("Paragraph", "free-bounds"));
    });

    it("Free to Flow keeps the (now inert) freeLayout, so a move back restores the size", () => {
      const geometry = { x: 30, y: 30, width: 140, height: 70 };
      load([freeBox("free", 600, 400, [p("mover", { freeLayout: geometry })]), { id: "flow", tag: "div", children: [] }]);
      run(() => store().moveElement("mover", "flow", "inside"));
      expect(node("mover")!.freeLayout).toEqual(geometry);
    });
  });

  describe("Navbar capacity (G3)", () => {
    const fullNav = (): EditorElementNode => ({
      id: "nav",
      tag: "nav",
      children: Array.from({ length: MAX_NAVIGATION_LINKS }, (_, index) => ({ ...createNavbarLinkNode(`L${index}`), id: `l${index}` })),
    });

    beforeEach(() => load([fullNav(), { id: "box", tag: "div", children: [{ ...createNavbarLinkNode("Extra"), id: "extra" }] }]));

    it("a link moved into a full nav is refused, nothing changes, no history", () => {
      const before = store().document;
      const outcome = run(() => store().moveElement("extra", "l3", "after"));
      expect(outcome).toEqual({ status: "rejected", reason: "navigation-link-limit" });
      expect(store().document).toBe(before);
      expect(store().past).toHaveLength(0);
      expect(store().editorNotice?.message).toContain(`at most ${MAX_NAVIGATION_LINKS} links`);
      expect(run(() => store().moveElement("extra", "nav", "inside")).status).toBe("rejected");
    });

    it("reordering links inside the full nav is allowed and keeps each link as it was", () => {
      const original = node("l0");
      run(() => store().moveElement("l0", "l11", "after"));
      expect(childIds("nav").at(-1)).toBe("l0");
      expect(node("l0")).toEqual(original);
    });

    it("moving a link out of the nav is allowed", () => {
      run(() => store().moveElement("l5", "box", "inside"));
      expect(childIds("nav")).toHaveLength(MAX_NAVIGATION_LINKS - 1);
      expect(findParentId(store().document, "l5")).toBe("box");
    });

    it("the Canvas drop indicator uses the same rule", () => {
      expect(validateMove(store().document, "extra", "nav", "inside")).toBe("navigation-link-limit");
      expect(validateMove(store().document, "l0", "l11", "after")).toBeNull();
    });
  });

  describe("Pagination (D9)", () => {
    let navId = "";
    const parts = () => getPaginationParts(node(navId)!);

    beforeEach(() => {
      const pagination = createPaginationNode();
      navId = pagination.id;
      load([pagination, { id: "box", tag: "div", children: [{ id: "loose", tag: "a", text: "Loose", href: "#" }] }]);
    });

    it("pages reorder between the controls; exactly one current page remains", () => {
      const [one, two, three] = parts().pages;
      run(() => store().moveElement(three.id, one.id, "before"));
      expect(parts().pages.map((page) => page.id)).toEqual([three.id, one.id, two.id]);
      expect(parts().pages.filter((page) => page.ariaCurrent === "page")).toHaveLength(1);
    });

    it("a page can't move outside the Previous/Next controls", () => {
      const { pages, controls } = parts();
      const before = store().document;
      expect(run(() => store().moveElement(pages[0].id, controls.previous!.id, "before"))).toEqual({ status: "rejected", reason: "pagination-order" });
      expect(run(() => store().moveElement(pages[0].id, controls.next!.id, "after"))).toEqual({ status: "rejected", reason: "pagination-order" });
      expect(store().document).toBe(before);
      expect(store().past).toHaveLength(0);
    });

    it("controls keep their place: moving Previous/Next is refused", () => {
      const { controls, pages } = parts();
      expect(run(() => store().moveElement(controls.next!.id, "box", "inside"))).toEqual({ status: "rejected", reason: "pagination-control" });
      expect(run(() => store().moveElement(controls.previous!.id, pages[1].id, "after"))).toEqual({ status: "rejected", reason: "pagination-control" });
    });

    it("a link entering a Pagination becomes a page; the page limit is enforced", () => {
      run(() => store().moveElement("loose", parts().pages[2].id, "after"));
      expect(parts().pages.map((page) => page.id)).toContain("loose");
      // Fill to the limit, then one more is refused.
      const extra = Array.from({ length: 12 }, (_, index) => ({ id: `x${index}`, tag: "a", text: `X${index}`, href: "#" }));
      run(() => store().replaceDocument({ ...store().document, children: [node(navId)!, { id: "box", tag: "div", children: extra }] }));
      let lastOutcome = run(() => store().moveElement("x0", parts().pages[0].id, "after"));
      for (let index = 1; lastOutcome.status === "moved" && index < extra.length; index++) {
        lastOutcome = run(() => store().moveElement(`x${index}`, parts().pages[0].id, "after"));
      }
      expect(lastOutcome).toEqual({ status: "rejected", reason: "pagination-page-limit" });
      expect(parts().pages).toHaveLength(12);
    });
  });

  describe("Flex/Grid item settings (G4)", () => {
    it("Flex item settings are kept, inert, under a non-Flex parent and apply again on the way back", () => {
      const flexChild = { grow: 2, shrink: 0, basis: "auto" as const, alignSelf: "center" as const };
      load([
        { id: "row", tag: "div", flowLayout: { display: "flex" }, children: [p("item", { flexChild })] },
        { id: "block", tag: "div", children: [] },
      ]);
      run(() => store().moveElement("item", "block", "inside"));
      expect(node("item")!.flexChild).toEqual(flexChild);
      run(() => store().moveElement("item", "row", "inside"));
      expect(node("item")!.flexChild).toEqual(flexChild);
    });

    it("a Grid placement is clamped to the tracks of the grid it enters", () => {
      load([
        { id: "wide", tag: "div", flowLayout: { display: "grid", grid: { columns: 4, rows: 2, columnGap: 0, rowGap: 0 } }, children: [p("cell", { gridChild: { columnStart: 4, columnSpan: 3, rowStart: 2, rowSpan: 1 } })] },
        { id: "narrow", tag: "div", flowLayout: { display: "grid", grid: { columns: 2, rows: 1, columnGap: 0, rowGap: 0 } }, children: [] },
      ]);
      run(() => store().moveElement("cell", "narrow", "inside"));
      expect(node("cell")!.gridChild).toEqual({ columnStart: 2, columnSpan: 2, rowStart: 1, rowSpan: 1 });
    });
  });

  describe("structural rules and identity", () => {
    beforeEach(() =>
      load([
        { id: "outer", tag: "section", children: [{ id: "inner", tag: "div", children: [p("deep")] }] },
        { id: "list", tag: "ul", children: [{ id: "li1", tag: "li", text: "One" }] },
        {
          id: "go",
          tag: "button",
          text: "Go",
          htmlId: "go-button",
          className: "cta",
          interactions: [{ id: "go-i", trigger: "click", action: "toggle", targetId: "deep" }],
        },
      ]),
    );

    it.each([
      ["into its own descendant", "outer", "inner", "inside", "descendant"],
      ["onto itself", "outer", "outer", "inside", "self"],
      ["the page itself", "page-root", "outer", "inside", "page"],
      ["beside the page", "go", "page-root", "after", "beside-page"],
      ["a paragraph into a list", "deep", "list", "inside", "incompatible-parent"],
      ["a list item outside a list", "li1", "outer", "inside", "incompatible-parent"],
      ["inside a leaf", "deep", "go", "inside", "incompatible-parent"],
    ] as const)("refuses a move %s, with no history", (_label, id, target, zone, reason) => {
      const before = store().document;
      expect(run(() => store().moveElement(id, target, zone))).toEqual({ status: "rejected", reason });
      expect(store().document).toBe(before);
      expect(store().past).toHaveLength(0);
    });

    it("a move keeps the id, HTML id, class, text, interactions and children; interaction targets stay valid", () => {
      const button = node("go");
      const inner = node("inner");
      run(() => store().moveElement("go", "inner", "inside"));
      run(() => store().moveElement("inner", "list", "after"));
      expect(node("go")).toEqual(button);
      expect(node("inner")!.children!.map((child) => child.id)).toEqual(["deep", "go"]);
      expect(findNodeById(store().document, node("go")!.interactions![0].targetId)).toBeDefined();
      expect(inner!.id).toBe("inner");
    });

    it("one move = one Undo step; Undo restores the parent and order, Redo the destination", () => {
      run(() => store().moveElement("go", "inner", "inside"));
      expect(store().past).toHaveLength(1);
      run(() => store().undo());
      expect(findParentId(store().document, "go")).toBe("page-root");
      expect(childIds("page-root")).toEqual(["outer", "list", "go"]);
      run(() => store().redo());
      expect(childIds("inner")).toEqual(["deep", "go"]);
    });

    it("Undo after a Free entry restores the element with no position", () => {
      load([{ id: "free", tag: "div", layoutMode: "free", dimensions: { preferredWidth: 500, preferredHeight: 300, offsetX: 0, offsetY: 0 }, children: [] }, p("mover")]);
      run(() => store().moveElement("mover", "free", "inside"));
      expect(node("mover")!.freeLayout).toBeDefined();
      expect(store().past).toHaveLength(1);
      run(() => store().undo());
      expect(node("mover")!.freeLayout).toBeUndefined();
      expect(findParentId(store().document, "mover")).toBe("page-root");
    });
  });

  describe("forms (D9)", () => {
    it("a control moved out of its label is allowed, with a notice", () => {
      load([
        { id: "label", tag: "label", children: [{ id: "caption", tag: "span", text: "Email" }, { id: "field", tag: "input", inputType: "email" }] },
        { id: "box", tag: "div", children: [] },
      ]);
      expect(run(() => store().moveElement("field", "box", "inside"))).toEqual({ status: "moved", leftLabel: true });
      expect(store().editorNotice?.message).toBe(movedOutOfLabelNotice("Email Input"));
    });

    it("a reorder inside the same label is silent", () => {
      load([{ id: "label", tag: "label", children: [{ id: "caption", tag: "span", text: "Email" }, { id: "field", tag: "input" }] }]);
      expect(run(() => store().moveElement("field", "caption", "before"))).toEqual({ status: "moved", leftLabel: false });
      expect(store().editorNotice).toBeNull();
    });
  });

  it("a deep, large tree moves in one step (no arbitrary cap)", () => {
    const deep = Array.from({ length: 40 }).reduce<EditorElementNode>((child, _, index) => ({ id: `d${index}`, tag: "div", children: [child] }), p("leaf"));
    const wide: EditorElementNode = { id: "wide", tag: "div", children: Array.from({ length: 1000 }, (_, index) => p(`w${index}`)) };
    load([deep, wide]);
    const started = performance.now();
    run(() => store().moveElement("leaf", "w999", "after"));
    run(() => store().moveElement("w0", "w999", "after"));
    expect(performance.now() - started).toBeLessThan(1000);
    expect(childIds("wide").slice(-3)).toEqual(["w999", "w0", "leaf"]);
    expect(store().past).toHaveLength(2);
  });

  describe("keepSelection (BC-12.3.1, Structure pointer drag)", () => {
    beforeEach(() => {
      load([{ id: "box", tag: "div", children: [p("a"), p("b"), p("c")] }, { id: "other", tag: "div", children: [] }]);
      run(() => store().setSelection(["a", "b", "c"], "c"));
    });

    it("only the dragged element moves; every selected element stays selected and the moved one becomes primary", () => {
      expect(run(() => store().moveElement("b", "other", "inside", { keepSelection: true }))).toEqual({ status: "moved", leftLabel: false });
      expect(childIds("box")).toEqual(["a", "c"]);
      expect(childIds("other")).toEqual(["b"]);
      expect(store().selection).toEqual({ ids: ["a", "b", "c"], primaryId: "b" });
      expect(store().past).toHaveLength(1);
    });

    it("Undo/Redo restore the order; the selection stays valid", () => {
      run(() => store().moveElement("b", "other", "inside", { keepSelection: true }));
      run(() => store().undo());
      expect(childIds("box")).toEqual(["a", "b", "c"]);
      expect(store().selection.ids).toEqual(["a", "b", "c"]);
      run(() => store().redo());
      expect(childIds("other")).toEqual(["b"]);
      expect(store().selection.ids.every((id) => node(id) !== undefined)).toBe(true);
    });

    it("a refused or no-op move leaves the selection untouched", () => {
      const before = store().selection;
      run(() => store().moveElement("box", "a", "inside", { keepSelection: true }));
      run(() => store().moveElement("a", "b", "before", { keepSelection: true }));
      expect(store().selection).toBe(before);
      expect(store().past).toHaveLength(0);
    });

    it("without the option (Canvas drag, Alt+Arrow) the moved element is the only selection, as before", () => {
      run(() => store().moveElement("b", "other", "inside"));
      expect(store().selection).toEqual({ ids: ["b"], primaryId: "b" });
    });
  });
});
