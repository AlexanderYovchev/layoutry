import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "./useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";

// Checkpoint 1.15.4 — Advanced Container Shapes. A separate file from
// useEditorStore.test.ts / useEditorStore.styleProtection.test.ts, the
// same "new checkpoint, new file" convention every prior checkpoint here
// already established.

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

describe("useEditorStore — Advanced Container Shapes (Checkpoint 1.15.4)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
    useEditorStore.getState().dismissEditorNotice();
  });

  describe("setElementShape", () => {
    it("Rectangle -> Circle -> Hexagon -> Rectangle, one history entry per real change", () => {
      setupDocument([{ id: "a", tag: "div" }]);
      const pastBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().setElementShape("a", "circle");
      expect(node("a").shape).toBe("circle");
      useEditorStore.getState().setElementShape("a", "hexagon");
      expect(node("a").shape).toBe("hexagon");
      useEditorStore.getState().setElementShape("a", "none");
      expect(node("a").shape).toBeUndefined();

      expect(useEditorStore.getState().past.length).toBe(pastBefore + 3);
    });

    it("selecting the same current shape again pushes no history", () => {
      setupDocument([{ id: "a", tag: "div", shape: "star" }]);
      const pastBefore = useEditorStore.getState().past.length;
      useEditorStore.getState().setElementShape("a", "star");
      expect(useEditorStore.getState().past.length).toBe(pastBefore);
    });

    it("undo/redo restore the shape exactly", () => {
      setupDocument([{ id: "a", tag: "div" }]);
      useEditorStore.getState().setElementShape("a", "triangle");
      useEditorStore.getState().setElementShape("a", "star");
      useEditorStore.getState().undo();
      expect(node("a").shape).toBe("triangle");
      useEditorStore.getState().undo();
      expect(node("a").shape).toBeUndefined();
      useEditorStore.getState().redo();
      expect(node("a").shape).toBe("triangle");
    });

    it("changing Shape never touches an unrelated, already-stored borderRadius", () => {
      setupDocument([{ id: "a", tag: "div", borderRadius: { topLeft: { value: 24, unit: "px" } } }]);
      useEditorStore.getState().setElementShape("a", "hexagon");
      expect(node("a").borderRadius).toEqual({ topLeft: { value: 24, unit: "px" } });
      useEditorStore.getState().setElementShape("a", "none");
      expect(node("a").borderRadius).toEqual({ topLeft: { value: 24, unit: "px" } });
    });
  });

  describe("Parent Style Protection integration (section 23)", () => {
    it("blocks a protected descendant's Shape change: no document change, no history, notice shown", () => {
      setupDocument([
        { id: "hero", tag: "div", htmlId: "hero", lockChildStyles: true, children: [{ id: "p1", tag: "div" }] },
      ]);
      const pastBefore = useEditorStore.getState().past.length;
      const docBefore = useEditorStore.getState().document;

      useEditorStore.getState().setElementShape("p1", "hexagon");

      expect(useEditorStore.getState().document).toBe(docBefore);
      expect(useEditorStore.getState().past.length).toBe(pastBefore);
      expect(useEditorStore.getState().editorNotice?.message).toBe(
        'Styles are locked by "hero". Disable "Lock child styles" on the parent to edit this element.',
      );
    });

    it("the lock OWNER can still change its own Shape even while it locks its descendants", () => {
      setupDocument([{ id: "hero", tag: "div", lockChildStyles: true }]);
      useEditorStore.getState().setElementShape("hero", "circle");
      expect(node("hero").shape).toBe("circle");
      expect(useEditorStore.getState().editorNotice).toBeNull();
    });

    it("bulk: one protected + one unlocked target blocks the ENTIRE Shape mutation atomically", () => {
      setupDocument([
        { id: "free1", tag: "div" },
        { id: "hero", tag: "div", htmlId: "hero", lockChildStyles: true, children: [{ id: "locked1", tag: "div" }] },
      ]);
      const pastBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().setElementsShape(["free1", "locked1"], "diamond");

      expect(node("free1").shape).toBeUndefined();
      expect(childOf("hero", "locked1").shape).toBeUndefined();
      expect(useEditorStore.getState().past.length).toBe(pastBefore);
      expect(useEditorStore.getState().editorNotice?.message).toContain('"hero"');
    });
  });

  describe("setElementsShape (bulk)", () => {
    it("applies one preset to every selected node in one history entry", () => {
      setupDocument([
        { id: "a", tag: "div", shape: "circle" },
        { id: "b", tag: "div", shape: "hexagon" },
      ]);
      const pastBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().setElementsShape(["a", "b"], "triangle");

      expect(node("a").shape).toBe("triangle");
      expect(node("b").shape).toBe("triangle");
      expect(useEditorStore.getState().past.length).toBe(pastBefore + 1);
    });

    it("no-op bulk apply pushes no history", () => {
      setupDocument([
        { id: "a", tag: "div", shape: "octagon" },
        { id: "b", tag: "div", shape: "octagon" },
      ]);
      const pastBefore = useEditorStore.getState().past.length;
      useEditorStore.getState().setElementsShape(["a", "b"], "octagon");
      expect(useEditorStore.getState().past.length).toBe(pastBefore);
    });
  });

  describe("duplication", () => {
    it("preserves the shape preset and child subtree, with fresh editor ids", () => {
      setupDocument([{ id: "a", tag: "div", shape: "star", children: [{ id: "b", tag: "p", text: "hi" }] }]);
      useEditorStore.getState().setSelection(["a"]);
      useEditorStore.getState().duplicateSelection();

      const children = useEditorStore.getState().document.children!;
      expect(children).toHaveLength(2);
      const duplicate = children[1];
      expect(duplicate.id).not.toBe("a");
      expect(duplicate.shape).toBe("star");
      expect(duplicate.children).toHaveLength(1);
      expect(duplicate.children![0].id).not.toBe("b");
      expect(duplicate.children![0].text).toBe("hi");
    });
  });
});
