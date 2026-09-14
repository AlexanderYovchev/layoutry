import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "./useEditorStore";
import { getLayoutMode } from "@/features/editor/types/layout";
import type { EditorElementNode } from "@/features/editor/types/document";

// Checkpoint 1.15.3 closure fix — seals the one disclosed bypass
// (convertToFreeLayout/convertToFlowLayout). A separate file from
// useEditorStore.styleProtection.test.ts, the same "new fix, new file"
// convention already established for this checkpoint's own sub-areas.

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

describe("useEditorStore — Parent Style Protection closure: Flow <-> Free conversion", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
    useEditorStore.getState().dismissEditorNotice();
  });

  // A. Protected Flow -> Free
  it("blocks a protected descendant's Flow -> Free conversion: no document change, no history, notice shown", () => {
    setupDocument([
      { id: "a", tag: "div", htmlId: "a", lockChildStyles: true, children: [{ id: "b", tag: "div" }] },
    ]);
    const pastBefore = useEditorStore.getState().past.length;
    const docBefore = useEditorStore.getState().document;

    useEditorStore.getState().convertToFreeLayout("b", {});

    expect(useEditorStore.getState().document).toBe(docBefore);
    expect(getLayoutMode(childOf("a", "b"))).toBe("flow");
    expect(useEditorStore.getState().past.length).toBe(pastBefore);
    expect(useEditorStore.getState().editorNotice?.message).toBe(
      'Styles are locked by "a". Disable "Lock child styles" on the parent to edit this element.',
    );
  });

  // B. Protected Free -> Flow
  it("blocks a protected descendant's Free -> Flow conversion: no document change, no history, notice shown", () => {
    setupDocument([
      {
        id: "a",
        tag: "div",
        htmlId: "a",
        lockChildStyles: true,
        children: [{ id: "b", tag: "div", layoutMode: "free" }],
      },
    ]);
    const pastBefore = useEditorStore.getState().past.length;
    const docBefore = useEditorStore.getState().document;

    useEditorStore.getState().convertToFlowLayout("b");

    expect(useEditorStore.getState().document).toBe(docBefore);
    expect(getLayoutMode(childOf("a", "b"))).toBe("free");
    expect(useEditorStore.getState().past.length).toBe(pastBefore);
    expect(useEditorStore.getState().editorNotice).not.toBeNull();
  });

  // C. Lock owner converts itself
  it("a lock owner remains free to convert its OWN layout mode both directions, with normal undo/redo", () => {
    setupDocument([{ id: "a", tag: "div", lockChildStyles: true }]);
    const pastBefore = useEditorStore.getState().past.length;

    useEditorStore.getState().convertToFreeLayout("a", {});
    expect(getLayoutMode(node("a"))).toBe("free");
    expect(useEditorStore.getState().past.length).toBe(pastBefore + 1);
    expect(useEditorStore.getState().editorNotice).toBeNull();

    useEditorStore.getState().convertToFlowLayout("a");
    expect(getLayoutMode(node("a"))).toBe("flow");
    expect(useEditorStore.getState().past.length).toBe(pastBefore + 2);

    useEditorStore.getState().undo();
    expect(getLayoutMode(node("a"))).toBe("free");
    useEditorStore.getState().undo();
    expect(getLayoutMode(node("a"))).toBe("flow");
    useEditorStore.getState().redo();
    expect(getLayoutMode(node("a"))).toBe("free");
  });

  // D. Locked owner inside a locked ancestor
  it("a locked container is itself blocked from converting when it sits inside another locked ancestor", () => {
    setupDocument([
      {
        id: "a",
        tag: "div",
        htmlId: "outer",
        lockChildStyles: true,
        children: [{ id: "b", tag: "div", lockChildStyles: true }],
      },
    ]);
    const docBefore = useEditorStore.getState().document;

    useEditorStore.getState().convertToFreeLayout("b", {});

    expect(useEditorStore.getState().document).toBe(docBefore);
    expect(getLayoutMode(childOf("a", "b"))).toBe("flow");
    expect(useEditorStore.getState().editorNotice?.message).toContain('"outer"');
  });

  // E. Deep descendant protection
  it("blocks a deep (grandchild) descendant's conversion, protected by the top ancestor", () => {
    setupDocument([
      {
        id: "a",
        tag: "div",
        htmlId: "a",
        lockChildStyles: true,
        children: [{ id: "b", tag: "div", children: [{ id: "c", tag: "div" }] }],
      },
    ]);
    const docBefore = useEditorStore.getState().document;
    useEditorStore.getState().convertToFreeLayout("c", {});
    expect(useEditorStore.getState().document).toBe(docBefore);
  });

  // F. Nearest locking ancestor named in the notice
  it("names the NEAREST locking ancestor when locks are nested", () => {
    setupDocument([
      {
        id: "a",
        tag: "div",
        htmlId: "outer",
        lockChildStyles: true,
        children: [
          {
            id: "b",
            tag: "div",
            htmlId: "inner",
            lockChildStyles: true,
            children: [{ id: "c", tag: "div" }],
          },
        ],
      },
    ]);
    useEditorStore.getState().convertToFreeLayout("c", {});
    expect(useEditorStore.getState().editorNotice?.message).toContain('"inner"');
  });

  // G. Unlocked regression
  it("an unlocked container converts exactly as before", () => {
    setupDocument([{ id: "a", tag: "div" }]);
    useEditorStore.getState().convertToFreeLayout("a", {}, { dimensions: { preferredWidth: 200, preferredHeight: 100, offsetX: 0, offsetY: 0 } });
    expect(getLayoutMode(node("a"))).toBe("free");
    expect(useEditorStore.getState().editorNotice).toBeNull();
  });

  // H. History regression
  it("allowed conversion is one normal history step; blocked conversion is zero", () => {
    setupDocument([{ id: "a", tag: "div" }]);
    const pastBefore = useEditorStore.getState().past.length;
    useEditorStore.getState().convertToFreeLayout("a", {});
    expect(useEditorStore.getState().past.length).toBe(pastBefore + 1);
    useEditorStore.getState().undo();
    expect(getLayoutMode(node("a"))).toBe("flow");
    useEditorStore.getState().redo();
    expect(getLayoutMode(node("a"))).toBe("free");
  });

  // I. Semantic regression — protected child stays semantically editable across a blocked conversion attempt.
  it("a protected child stays semantically editable even after a blocked conversion attempt", () => {
    setupDocument([
      {
        id: "a",
        tag: "div",
        lockChildStyles: true,
        children: [{ id: "b", tag: "p", text: "before" }],
      },
    ]);
    useEditorStore.getState().convertToFreeLayout("b", {});
    useEditorStore.getState().setElementText("b", "after");
    expect(childOf("a", "b").text).toBe("after");
  });

  it("applyFreeContainerChildGeometriesLive is a no-op for a protected container, even called directly", () => {
    setupDocument([
      {
        id: "a",
        tag: "div",
        lockChildStyles: true,
        children: [{ id: "b", tag: "div", layoutMode: "free", children: [{ id: "c", tag: "p", freeLayout: { x: 0, y: 0, width: 50, height: 50 } }] }],
      },
    ]);
    const docBefore = useEditorStore.getState().document;
    useEditorStore.getState().applyFreeContainerChildGeometriesLive(
      "b",
      { freeLayout: { x: 5, y: 5, width: 80, height: 80 } },
      { c: { x: 1, y: 1, width: 10, height: 10 } },
    );
    expect(useEditorStore.getState().document).toBe(docBefore);
  });

  it("applyFreeContainerChildGeometriesLive still works normally for an unprotected container", () => {
    setupDocument([{ id: "b", tag: "div", layoutMode: "free", children: [{ id: "c", tag: "p", freeLayout: { x: 0, y: 0, width: 50, height: 50 } }] }]);
    useEditorStore.getState().applyFreeContainerChildGeometriesLive(
      "b",
      { freeLayout: { x: 5, y: 5, width: 80, height: 80 } },
      { c: { x: 1, y: 1, width: 10, height: 10 } },
    );
    expect(node("b").freeLayout).toEqual({ x: 5, y: 5, width: 80, height: 80 });
    expect(childOf("b", "c").freeLayout).toEqual({ x: 1, y: 1, width: 10, height: 10 });
  });
});
