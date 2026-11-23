import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createImageNode, createVideoEmbedNode } from "@/features/editor/factories/elementFactories";
import type { EditorElementNode } from "@/features/editor/types/document";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { selectHasUnsavedChanges, useEditorStore } from "./useEditorStore";

/**
 * BC-12.5 — final audit of the shared move commands (moveElement /
 * moveElements) for the cases the earlier BC-12 suites did not cover:
 * mixed single + multi Undo/Redo chains, nested and noncontiguous
 * selections, several incompatible roots, media metadata, Free → Free and
 * Flex → Grid batches.
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
const p = (id: string, extra: Partial<EditorElementNode> = {}): EditorElementNode => ({ id, tag: "p", text: id, ...extra });

function load(children: EditorElementNode[]) {
  run(() => store().replaceDocument({ id: "page-root", tag: "page", children }));
  run(() => store().markDocumentPersisted(store().document));
}

describe("BC-12.5 final move audit", () => {
  beforeEach(() => useEditorStore.setState(initialState, true));
  afterEach(() => useEditorStore.setState(initialState, true));

  it("a chain of single and multi moves undoes and redoes one step at a time, back to the saved document", () => {
    load([{ id: "s1", tag: "section", children: [p("a"), p("b"), p("c")] }, { id: "s2", tag: "section", children: [p("x")] }]);
    const saved = store().document;
    run(() => store().moveElement("a", "c", "after"));
    run(() => store().setSelection(["b", "x"], "b"));
    run(() => store().moveElements(["b", "x"], "s2", "inside", "b"));
    run(() => store().moveElement("c", "s2", "inside"));
    expect(childIds("s1")).toEqual(["a"]);
    expect(childIds("s2")).toEqual(["b", "x", "c"]);
    expect(store().past).toHaveLength(3);
    run(() => store().undo());
    expect(childIds("s2")).toEqual(["b", "x"]);
    run(() => store().undo());
    expect(childIds("s1")).toEqual(["b", "c", "a"]);
    expect(childIds("s2")).toEqual(["x"]);
    run(() => store().undo());
    expect(store().document).toBe(saved);
    expect(selectHasUnsavedChanges(store())).toBe(false);
    run(() => store().redo());
    run(() => store().redo());
    run(() => store().redo());
    expect(childIds("s2")).toEqual(["b", "x", "c"]);
  });

  it("parent + several descendants, nested selected branches and noncontiguous picks: each subtree moves exactly once, in document order", () => {
    load([
      { id: "a", tag: "section", children: [{ id: "a1", tag: "div", children: [p("a1x"), p("a1y")] }, p("a2")] },
      { id: "mid", tag: "section", children: [p("m1"), p("m2"), p("m3"), p("m4")] },
      { id: "dest", tag: "div", children: [] },
    ]);
    run(() => store().setSelection(["a1y", "a", "a2", "a1", "m3", "m1"], "m3"));
    expect(run(() => store().moveElements(["a1y", "a", "a2", "a1", "m3", "m1"], "dest", "inside", "m3")).status).toBe("moved");
    expect(childIds("dest")).toEqual(["a", "m1", "m3"]);
    expect(childIds("a")).toEqual(["a1", "a2"]);
    expect(childIds("a1")).toEqual(["a1x", "a1y"]);
    expect(childIds("mid")).toEqual(["m2", "m4"]);
    // Every selected id is still selected; nothing was duplicated.
    expect([...store().selection.ids].sort()).toEqual(["a", "a1", "a1y", "a2", "m1", "m3"]);
    const ids: string[] = [];
    const walk = (n: EditorElementNode) => {
      ids.push(n.id);
      n.children?.forEach(walk);
    };
    walk(store().document);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("several incompatible roots: one refusal, nothing moves, no history, selection kept", () => {
    load([{ id: "l1", tag: "ul", children: [{ id: "li1", tag: "li", text: "1" }] }, { id: "l2", tag: "ul", children: [{ id: "li2", tag: "li", text: "2" }] }, { id: "box", tag: "div", children: [] }]);
    run(() => store().setSelection(["li1", "li2"], "li1"));
    const before = { document: store().document, selection: store().selection };
    expect(run(() => store().moveElements(["li1", "li2"], "box", "inside", "li1"))).toEqual({ status: "rejected", reason: "incompatible-parent" });
    expect(store().document).toBe(before.document);
    expect(store().selection).toBe(before.selection);
    expect(store().past).toHaveLength(0);
    // The same two list items move between lists as a batch.
    expect(run(() => store().moveElements(["li1", "li2"], "l2", "inside", "li1")).status).toBe("moved");
    expect(childIds("l2")).toEqual(["li1", "li2"]);
  });

  it("media and embeds keep their metadata (src, alt, embed fields) through single and multi moves", () => {
    const image = { ...createImageNode(), id: "img", src: "https://example.com/a.png", displayName: "A sunset" };
    const embed = { ...createVideoEmbedNode(), id: "embed" };
    load([{ id: "from", tag: "section", children: [image, embed] }, { id: "to", tag: "section", children: [] }]);
    const before = { image: node("img"), embed: node("embed") };
    run(() => store().setSelection(["img", "embed"], "img"));
    run(() => store().moveElements(["img", "embed"], "to", "inside", "img"));
    expect(node("img")).toBe(before.image);
    expect(node("embed")).toBe(before.embed);
    run(() => store().moveElement("embed", "img", "before"));
    expect(node("embed")).toBe(before.embed);
    expect(childIds("to")).toEqual(["embed", "img"]);
  });

  it("Free → Free batch keeps sizes and relative arrangement; Undo restores the original coordinates", () => {
    const g1 = { x: 200, y: 100, width: 120, height: 40 };
    const g2 = { x: 260, y: 160, width: 100, height: 50 };
    const free = (id: string, children: EditorElementNode[] = []): EditorElementNode => ({ id, tag: "div", layoutMode: "free", dimensions: { preferredWidth: 600, preferredHeight: 400, offsetX: 0, offsetY: 0 }, children });
    load([free("from", [p("f1", { freeLayout: g1 }), p("f2", { freeLayout: g2 })]), free("to")]);
    run(() => store().setSelection(["f1", "f2"], "f1"));
    run(() => store().moveElements(["f1", "f2"], "to", "inside", "f1"));
    const a = node("f1")!.freeLayout!;
    const b = node("f2")!.freeLayout!;
    expect({ w: a.width, h: a.height, w2: b.width, h2: b.height }).toEqual({ w: 120, h: 40, w2: 100, h2: 50 });
    expect({ dx: b.x - a.x, dy: b.y - a.y }).toEqual({ dx: 60, dy: 60 });
    run(() => store().undo());
    expect(node("f1")!.freeLayout).toEqual(g1);
    expect(node("f2")!.freeLayout).toEqual(g2);
  });

  it("Flex → Grid → Flex batch: Grid placement clamped on entry, Flex item settings kept as authored", () => {
    const flexChild = { grow: 2, shrink: 0, basis: "auto" as const, alignSelf: "center" as const };
    load([
      { id: "row", tag: "div", flowLayout: { display: "flex" }, children: [p("i1", { flexChild }), p("i2", { gridChild: { columnStart: 3, columnSpan: 2, rowStart: 1, rowSpan: 1 } })] },
      { id: "grid", tag: "div", flowLayout: { display: "grid", grid: { columns: 2, rows: "auto", columnGap: 0, rowGap: 0 } }, children: [] },
    ]);
    run(() => store().setSelection(["i1", "i2"], "i1"));
    run(() => store().moveElements(["i1", "i2"], "grid", "inside", "i1"));
    expect(node("i1")!.flexChild).toEqual(flexChild);
    expect(node("i2")!.gridChild).toEqual({ columnStart: 2, columnSpan: 2, rowStart: 1, rowSpan: 1 });
    run(() => store().moveElements(["i1", "i2"], "row", "inside", "i1"));
    expect(node("i1")!.flexChild).toEqual(flexChild);
    expect(childIds("row")).toEqual(["i1", "i2"]);
  });
});
