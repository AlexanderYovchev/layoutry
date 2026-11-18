import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { EditorElementNode } from "@/features/editor/types/document";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { createProjectMetadata, serializeProject } from "@/features/project/utils/serializeProject";
import { useEditorStore } from "./useEditorStore";

/**
 * BC-10.2 — mandatory confirmation for every multi-delete, through the
 * store: request → pending (nothing changes) → cancel or confirm (one Undo
 * step, revalidated targets), and the Structure range anchor.
 */

const initialState = useEditorStore.getState();
const store = () => useEditorStore.getState();

/** page > section(s) > [p1, box(b1, b2)], p3, button(trigger → b1) */
function document(): EditorElementNode {
  return {
    id: "page-root",
    tag: "page",
    children: [
      {
        id: "s",
        tag: "section",
        children: [
          { id: "p1", tag: "p", text: "One" },
          { id: "box", tag: "div", children: [{ id: "b1", tag: "p", text: "B1" }, { id: "b2", tag: "p", text: "B2" }] },
        ],
      },
      { id: "p3", tag: "p", text: "Three" },
      { id: "trigger", tag: "button", text: "Go", interactions: [{ id: "i-1", trigger: "click", action: "toggle", targetId: "b1" }] },
    ],
  };
}

const exists = (id: string) => findNodeById(store().document, id) !== undefined;

describe("multi-delete confirmation (BC-10.2)", () => {
  beforeEach(() => {
    useEditorStore.setState(initialState, true);
    store().replaceDocument(document());
  });
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("a single selected element is deleted at once, exactly as before (no confirmation)", () => {
    store().selectOnly("p3");
    store().requestDeleteSelection();
    expect(store().pendingDeletion).toBeNull();
    expect(exists("p3")).toBe(false);
    expect(store().past).toHaveLength(1);
  });

  it("two or more ask first: nothing is deleted, no history entry, the selection stays", () => {
    store().setSelection(["p1", "p3"], "p3");
    const before = store().document;
    store().requestDeleteSelection();
    expect(store().pendingDeletion).toMatchObject({ selectedIds: ["p1", "p3"], nestedCount: 0, totalCount: 2 });
    expect(store().document).toBe(before);
    expect(store().past).toHaveLength(0);
    expect(store().selection.ids).toEqual(["p1", "p3"]);
  });

  it("Cancel leaves the document, history and selection exactly as they were", () => {
    store().setSelection(["p1", "p3"], "p3");
    const before = store().document;
    const selection = store().selection;
    store().requestDeleteSelection();
    store().cancelPendingDeletion();
    expect(store().pendingDeletion).toBeNull();
    expect(store().document).toBe(before);
    expect(store().past).toHaveLength(0);
    expect(store().selection).toBe(selection);
  });

  it("Confirm deletes exactly the targets as one Undo step; Undo and Redo restore everything", () => {
    store().setSelection(["box", "p3"], "p3");
    store().requestDeleteSelection();
    const before = store().document;
    store().confirmPendingDeletion();
    expect(store().pendingDeletion).toBeNull();
    for (const id of ["box", "b1", "b2", "p3"]) expect(exists(id)).toBe(false);
    expect(exists("p1")).toBe(true);
    // The interaction that targeted b1 went with it, in the same write.
    expect(findNodeById(store().document, "trigger")?.interactions).toBeUndefined();
    expect(store().past).toHaveLength(1);
    const after = store().document;
    store().undo();
    expect(store().document).toEqual(before);
    expect(findNodeById(store().document, "trigger")?.interactions).toHaveLength(1);
    store().redo();
    expect(store().document).toEqual(after);
    expect(() => serializeProject({ metadata: createProjectMetadata({ id: "p", now: new Date(0) }), document: store().document })).not.toThrow();
  });

  it("a selected parent and child: the subtree is removed once, and nested elements are counted once", () => {
    store().setSelection(["s", "b1", "p3"], "p3");
    store().requestDeleteSelection();
    // Removed: s, p1, box, b1, b2, p3 = 6; selected 3, so 3 more are nested.
    expect(store().pendingDeletion).toMatchObject({ rootIds: ["s", "p3"], totalCount: 6, nestedCount: 3 });
    store().confirmPendingDeletion();
    expect(store().document.children?.map((child) => child.id)).toEqual(["trigger"]);
    expect(store().past).toHaveLength(1);
  });

  it("a selection change while asking: confirm deletes nothing and says why", () => {
    store().setSelection(["p1", "p3"], "p3");
    store().requestDeleteSelection();
    store().setSelection(["p1", "b2"], "b2");
    const before = store().document;
    store().confirmPendingDeletion();
    expect(store().document).toBe(before);
    expect(store().past).toHaveLength(0);
    expect(store().pendingDeletion).toBeNull();
    expect(store().editorNotice?.message).toMatch(/nothing was deleted/);
  });

  it("a target that disappeared while asking (e.g. Undo of its insertion): nothing is deleted", () => {
    store().insertElement("page-root", { id: "fresh", tag: "p", text: "New" });
    store().setSelection(["fresh", "p3"], "p3");
    store().requestDeleteSelection();
    store().undo();
    const before = store().document;
    store().confirmPendingDeletion();
    expect(store().document).toBe(before);
    expect(exists("p3")).toBe(true);
  });

  it("a second confirm, or a second request while asking, does nothing more", () => {
    store().setSelection(["p1", "p3"], "p3");
    store().requestDeleteSelection();
    const pending = store().pendingDeletion;
    store().requestDeleteSelection();
    expect(store().pendingDeletion).toBe(pending);
    store().confirmPendingDeletion();
    const afterFirst = store().document;
    store().confirmPendingDeletion();
    expect(store().document).toBe(afterFirst);
    expect(store().past).toHaveLength(1);
  });

  it("the page root never counts and is never deleted", () => {
    store().setSelection(["page-root", "p3"], "p3");
    store().requestDeleteSelection();
    expect(store().pendingDeletion).toBeNull();
    expect(exists("p3")).toBe(false);
    expect(store().document.id).toBe("page-root");
  });

  it("entering Preview or opening another project closes a pending confirmation", () => {
    store().setSelection(["p1", "p3"], "p3");
    store().requestDeleteSelection();
    store().enterPreview();
    expect(store().pendingDeletion).toBeNull();
    store().exitPreview();
    store().requestDeleteSelection();
    store().replaceDocument(document());
    expect(store().pendingDeletion).toBeNull();
    expect(store().selectionAnchorId).toBeNull();
  });
});

describe("Structure range anchor (BC-10.2)", () => {
  beforeEach(() => {
    useEditorStore.setState(initialState, true);
    store().replaceDocument(document());
  });

  const rows = ["s", "p1", "box", "b1", "b2", "p3", "trigger"];

  it("plain and Ctrl/Cmd clicks set the anchor; Shift ranges from it and keeps it; clearing drops it", () => {
    store().selectOnly("p1");
    store().selectRange("b2", rows, false);
    expect(store().selection.ids).toEqual(["p1", "box", "b1", "b2"]);
    store().selectRange("box", rows, false);
    expect(store().selection.ids).toEqual(["p1", "box"]);
    expect(store().selectionAnchorId).toBe("p1");
    store().toggleSelection("trigger");
    expect(store().selectionAnchorId).toBe("trigger");
    store().selectRange("p3", rows, true);
    expect(store().selection.ids).toEqual(["p1", "box", "trigger", "p3"]);
    store().clearSelection();
    expect(store().selectionAnchorId).toBeNull();
  });

  it("selection and anchor stay out of the saved project", () => {
    store().selectOnly("p1");
    store().selectRange("p3", rows, false);
    const text = serializeProject({ metadata: createProjectMetadata({ id: "p", now: new Date(0) }), document: store().document });
    expect(text).not.toMatch(/selection|anchor/i);
  });
});
