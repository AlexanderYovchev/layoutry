import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "./useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";

// Checkpoint 1.15.5 — SVG Foundation. A separate file from
// useEditorStore.styleProtection.test.ts / useEditorStore.shape.test.ts,
// the same "new checkpoint, new file" convention every prior checkpoint
// here already established.

const initialState = useEditorStore.getState();

function setupDocument(children: EditorElementNode[]) {
  useEditorStore.setState((state) => ({ document: { ...state.document, children } }));
}

function node(id: string) {
  return useEditorStore.getState().document.children!.find((c) => c.id === id)!;
}

function childOf(parentId: string, childId: string) {
  return node(parentId).children!.find((c) => c.id === childId)!;
}

describe("useEditorStore — SVG Foundation (Checkpoint 1.15.5)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
    useEditorStore.getState().dismissEditorNotice();
  });

  describe("history — Primitive/ViewBox/Fill", () => {
    it("Rectangle -> Circle -> Star, undo/redo restores each step exactly", () => {
      setupDocument([{ id: "a", tag: "svg" }]);
      useEditorStore.getState().setSvgKind("a", "circle");
      useEditorStore.getState().setSvgKind("a", "star");

      useEditorStore.getState().undo();
      expect(node("a").svgKind).toBe("circle");
      useEditorStore.getState().undo();
      expect(node("a").svgKind).toBeUndefined();
      useEditorStore.getState().redo();
      expect(node("a").svgKind).toBe("circle");
    });

    it("each real Primitive/Fill/ViewBox change is one history entry; same-value re-apply is zero", () => {
      setupDocument([{ id: "a", tag: "svg" }]);
      const pastBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().setSvgKind("a", "circle");
      useEditorStore.getState().setSvgFill("a", "#ff0000");
      useEditorStore.getState().setSvgViewBox("a", { minX: 0, minY: 0, width: 50, height: 50 });
      expect(useEditorStore.getState().past.length).toBe(pastBefore + 3);

      useEditorStore.getState().setSvgKind("a", "circle");
      expect(useEditorStore.getState().past.length).toBe(pastBefore + 3);
    });
  });

  describe("Parent Style Protection — Fill/Stroke/Stroke Width blocked, Primitive/ViewBox allowed (section 36)", () => {
    it("blocks a protected descendant's Fill change: no document change, no history, notice shown", () => {
      setupDocument([
        { id: "hero", tag: "div", htmlId: "hero", lockChildStyles: true, children: [{ id: "svg1", tag: "svg" }] },
      ]);
      const pastBefore = useEditorStore.getState().past.length;
      const docBefore = useEditorStore.getState().document;

      useEditorStore.getState().setSvgFill("svg1", "#ff0000");

      expect(useEditorStore.getState().document).toBe(docBefore);
      expect(useEditorStore.getState().past.length).toBe(pastBefore);
      expect(useEditorStore.getState().editorNotice?.message).toBe(
        'Styles are locked by "hero". Disable "Lock child styles" on the parent to edit this element.',
      );
    });

    it("blocks a protected descendant's Stroke and Stroke Width changes the same way", () => {
      setupDocument([
        { id: "hero", tag: "div", lockChildStyles: true, children: [{ id: "svg1", tag: "svg" }] },
      ]);
      useEditorStore.getState().setSvgStroke("svg1", "#000000");
      useEditorStore.getState().setSvgStrokeWidth("svg1", 5);
      expect(childOf("hero", "svg1").svgStroke).toBeUndefined();
      expect(childOf("hero", "svg1").svgStrokeWidth).toBeUndefined();
    });

    it("allows a protected descendant's Primitive and ViewBox changes — vector content, not styling", () => {
      setupDocument([
        { id: "hero", tag: "div", lockChildStyles: true, children: [{ id: "svg1", tag: "svg" }] },
      ]);
      const pastBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().setSvgKind("svg1", "star");
      useEditorStore.getState().setSvgViewBox("svg1", { minX: 0, minY: 0, width: 200, height: 200 });

      expect(childOf("hero", "svg1").svgKind).toBe("star");
      expect(childOf("hero", "svg1").svgViewBox).toEqual({ minX: 0, minY: 0, width: 200, height: 200 });
      expect(useEditorStore.getState().past.length).toBe(pastBefore + 2);
      expect(useEditorStore.getState().editorNotice).toBeNull();
    });

    it("the lock OWNER can still change its own Fill/Stroke/Primitive/ViewBox even while it locks its descendants", () => {
      setupDocument([{ id: "hero", tag: "svg", lockChildStyles: true }]);
      useEditorStore.getState().setSvgFill("hero", "#00ff00");
      useEditorStore.getState().setSvgKind("hero", "circle");
      expect(node("hero").svgFill).toBe("#00ff00");
      expect(node("hero").svgKind).toBe("circle");
      expect(useEditorStore.getState().editorNotice).toBeNull();
    });
  });

  describe("bulk — Fill/Stroke/StrokeWidth guarded and atomic; Primitive unguarded", () => {
    it("bulk Fill: one protected + one unlocked target blocks the ENTIRE mutation atomically", () => {
      setupDocument([
        { id: "free1", tag: "svg" },
        { id: "hero", tag: "div", htmlId: "hero", lockChildStyles: true, children: [{ id: "locked1", tag: "svg" }] },
      ]);
      const pastBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().setElementsSvgFill(["free1", "locked1"], "#ff0000");

      expect(node("free1").svgFill).toBeUndefined();
      expect(childOf("hero", "locked1").svgFill).toBeUndefined();
      expect(useEditorStore.getState().past.length).toBe(pastBefore);
      expect(useEditorStore.getState().editorNotice?.message).toContain('"hero"');
    });

    it("bulk Primitive is NOT blocked by protection — vector content, applies to every target including protected ones", () => {
      setupDocument([
        { id: "free1", tag: "svg" },
        { id: "hero", tag: "div", lockChildStyles: true, children: [{ id: "locked1", tag: "svg" }] },
      ]);
      useEditorStore.getState().setElementsSvgKind(["free1", "locked1"], "triangle");
      expect(node("free1").svgKind).toBe("triangle");
      expect(childOf("hero", "locked1").svgKind).toBe("triangle");
    });

    it("bulk Fill applies to every target in one history entry when nothing is protected", () => {
      setupDocument([
        { id: "a", tag: "svg" },
        { id: "b", tag: "svg" },
      ]);
      const pastBefore = useEditorStore.getState().past.length;
      useEditorStore.getState().setElementsSvgFill(["a", "b"], "#123456");
      expect(node("a").svgFill).toBe("#123456");
      expect(node("b").svgFill).toBe("#123456");
      expect(useEditorStore.getState().past.length).toBe(pastBefore + 1);
    });
  });

  describe("duplication", () => {
    it("preserves every SVG field with fresh editor ids", () => {
      setupDocument([
        {
          id: "a",
          tag: "svg",
          svgKind: "star",
          svgViewBox: { minX: -5, minY: -5, width: 110, height: 110 },
          svgFill: "#ff0000",
          svgStroke: "#000000",
          svgStrokeWidth: 3,
        },
      ]);
      useEditorStore.getState().setSelection(["a"]);
      useEditorStore.getState().duplicateSelection();

      const children = useEditorStore.getState().document.children!;
      expect(children).toHaveLength(2);
      const duplicate = children[1];
      expect(duplicate.id).not.toBe("a");
      expect(duplicate.svgKind).toBe("star");
      expect(duplicate.svgViewBox).toEqual({ minX: -5, minY: -5, width: 110, height: 110 });
      expect(duplicate.svgFill).toBe("#ff0000");
      expect(duplicate.svgStroke).toBe("#000000");
      expect(duplicate.svgStrokeWidth).toBe(3);
    });
  });

  describe("resize does not touch svgViewBox", () => {
    it("resizeElement changes dimensions but leaves svgViewBox exactly as authored", () => {
      setupDocument([{ id: "a", tag: "svg", svgViewBox: { minX: 0, minY: 0, width: 100, height: 100 } }]);
      useEditorStore.getState().resizeElement("a", { preferredWidth: 400, preferredHeight: 250, offsetX: 0, offsetY: 0 });
      expect(node("a").dimensions).toEqual({ preferredWidth: 400, preferredHeight: 250, offsetX: 0, offsetY: 0 });
      expect(node("a").svgViewBox).toEqual({ minX: 0, minY: 0, width: 100, height: 100 });
    });
  });
});
