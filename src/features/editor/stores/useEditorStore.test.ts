import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "./useEditorStore";

const initialState = useEditorStore.getState();

describe("useEditorStore", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("starts with no selection", () => {
    expect(useEditorStore.getState().selectedElementId).toBeNull();
  });

  it("selects a node", () => {
    useEditorStore.getState().selectElement("heading-1");

    expect(useEditorStore.getState().selectedElementId).toBe("heading-1");
  });

  it("replaces the selected node when a different id is selected", () => {
    useEditorStore.getState().selectElement("heading-1");
    useEditorStore.getState().selectElement("paragraph-1");

    expect(useEditorStore.getState().selectedElementId).toBe("paragraph-1");
  });

  it("clears the selection", () => {
    useEditorStore.getState().selectElement("heading-1");
    useEditorStore.getState().clearSelection();

    expect(useEditorStore.getState().selectedElementId).toBeNull();
  });

  it("inserts a node into the target parent and selects it in one update", () => {
    const newNode = { id: "button-new", tag: "button", text: "Go" };

    useEditorStore.getState().insertElement("section-1", newNode);

    const section = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-1");
    expect(section?.children?.at(-1)).toEqual(newNode);
    expect(useEditorStore.getState().selectedElementId).toBe("button-new");
  });

  it("inserts a node at an explicit position and selects it", () => {
    const newNode = { id: "heading-new", tag: "h1", text: "New" };

    useEditorStore
      .getState()
      .insertElement("section-1", newNode, { referenceId: "heading-1", placement: "before" });

    const section = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-1");
    expect(section?.children?.map((child) => child.id)).toEqual([
      "heading-new",
      "heading-1",
      "paragraph-1",
      "button-1",
    ]);
    expect(useEditorStore.getState().selectedElementId).toBe("heading-new");
  });

  it("moves a node and keeps it selected in one update", () => {
    useEditorStore.getState().moveElement("button-1", "section-2", "inside");

    const state = useEditorStore.getState();
    const sourceSection = state.document.children?.find((child) => child.id === "section-1");
    const targetSection = state.document.children?.find((child) => child.id === "section-2");
    expect(sourceSection?.children?.map((child) => child.id)).toEqual([
      "heading-1",
      "paragraph-1",
    ]);
    expect(targetSection?.children?.map((child) => child.id)).toEqual(["image-1", "button-1"]);
    expect(state.selectedElementId).toBe("button-1");
  });

  it("rejects an invalid move without altering the document", () => {
    const before = useEditorStore.getState().document;

    useEditorStore.getState().moveElement("section-1", "heading-1", "inside");

    expect(useEditorStore.getState().document).toBe(before);
  });

  it("resizes a node without changing selection", () => {
    useEditorStore.getState().selectElement("section-1");

    useEditorStore
      .getState()
      .resizeElement("section-1", { preferredWidth: 320, preferredHeight: 180, offsetX: 0, offsetY: 0 });

    const section = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-1");
    expect(section?.dimensions).toEqual({ preferredWidth: 320, preferredHeight: 180, offsetX: 0, offsetY: 0 });
    expect(useEditorStore.getState().selectedElementId).toBe("section-1");
  });

  it("resizes a text element (heading) — universal resize, Checkpoint 3.4.3", () => {
    useEditorStore
      .getState()
      .resizeElement("heading-1", { preferredWidth: 400, preferredHeight: 80, offsetX: 0, offsetY: 0 });

    const heading = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-1")
      ?.children?.find((child) => child.id === "heading-1");
    expect(heading?.dimensions).toEqual({ preferredWidth: 400, preferredHeight: 80, offsetX: 0, offsetY: 0 });
  });

  it("does not alter the document when resizing an unsupported element type (the document root)", () => {
    const before = useEditorStore.getState().document;

    useEditorStore
      .getState()
      .resizeElement("page-root", { preferredWidth: 320, preferredHeight: 180, offsetX: 0, offsetY: 0 });

    expect(useEditorStore.getState().document).toBe(before);
  });
});

describe("useEditorStore clipboard", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("copies the selected node without altering the document", () => {
    useEditorStore.getState().selectElement("heading-1");
    const before = useEditorStore.getState().document;

    useEditorStore.getState().copySelection();

    expect(useEditorStore.getState().document).toBe(before);
    expect(useEditorStore.getState().clipboard?.operation).toBe("copy");
    expect(useEditorStore.getState().clipboard?.nodes[0].id).toBe("heading-1");
    expect(useEditorStore.getState().clipboard?.sourceParentId).toBe("section-1");
  });

  it("does nothing when copying with no selection", () => {
    useEditorStore.getState().copySelection();

    expect(useEditorStore.getState().clipboard).toBeNull();
  });

  it("does nothing when copying the document root", () => {
    useEditorStore.getState().selectElement("page-root");

    useEditorStore.getState().copySelection();

    expect(useEditorStore.getState().clipboard).toBeNull();
  });

  it("cuts the selected node: removes it, fills the clipboard, and selects the former parent", () => {
    useEditorStore.getState().selectElement("heading-1");

    useEditorStore.getState().cutSelection();

    const section = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-1");
    expect(section?.children?.map((child) => child.id)).toEqual(["paragraph-1", "button-1"]);
    expect(useEditorStore.getState().clipboard?.operation).toBe("cut");
    expect(useEditorStore.getState().clipboard?.nodes[0].id).toBe("heading-1");
    expect(useEditorStore.getState().selectedElementId).toBe("section-1");
  });

  it("pastes a copied node with a fresh id into the currently selected container", () => {
    useEditorStore.getState().selectElement("heading-1");
    useEditorStore.getState().copySelection();
    useEditorStore.getState().selectElement("section-2");

    useEditorStore.getState().pasteClipboard();

    const section2 = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-2");
    const pasted = section2?.children?.at(-1);
    expect(pasted?.tag).toBe("h1");
    expect(pasted?.id).not.toBe("heading-1");
    expect(useEditorStore.getState().selectedElementId).toBe(pasted?.id);
    // The original is untouched by a copy+paste.
    const section1 = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-1");
    expect(section1?.children?.some((child) => child.id === "heading-1")).toBe(true);
  });

  it("pasting the same copied clipboard twice produces two distinct ids", () => {
    useEditorStore.getState().selectElement("heading-1");
    useEditorStore.getState().copySelection();
    useEditorStore.getState().selectElement("section-2");

    useEditorStore.getState().pasteClipboard();
    useEditorStore.getState().pasteClipboard();

    const section2 = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-2");
    const pastedIds = section2?.children
      ?.filter((child) => child.tag === "h1")
      .map((child) => child.id);
    expect(pastedIds).toHaveLength(2);
    expect(new Set(pastedIds).size).toBe(2);
  });

  it("pastes a cut node into a new valid location", () => {
    useEditorStore.getState().selectElement("heading-1");
    useEditorStore.getState().cutSelection();
    useEditorStore.getState().selectElement("section-2");

    useEditorStore.getState().pasteClipboard();

    const section2 = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-2");
    expect(section2?.children?.some((child) => child.tag === "h1")).toBe(true);
  });

  it("falls back to the clipboard's original parent when nothing is selected at paste time", () => {
    useEditorStore.getState().selectElement("heading-1");
    useEditorStore.getState().copySelection();
    useEditorStore.getState().clearSelection();

    useEditorStore.getState().pasteClipboard();

    const section1 = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-1");
    expect(section1?.children).toHaveLength(4); // heading-1, paragraph-1, button-1, + pasted
  });

  it("does nothing when pasting with an empty clipboard", () => {
    const before = useEditorStore.getState().document;

    useEditorStore.getState().pasteClipboard();

    expect(useEditorStore.getState().document).toBe(before);
  });

  it("duplicates the selected node with a fresh id, inserted immediately after the source", () => {
    useEditorStore.getState().selectElement("heading-1");

    useEditorStore.getState().duplicateSelection();

    const section = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-1");
    const ids = section?.children?.map((child) => child.id);
    expect(ids?.[0]).toBe("heading-1");
    expect(ids?.[1]).not.toBe("heading-1");
    expect(section?.children?.[1].tag).toBe("h1");
    expect(useEditorStore.getState().selectedElementId).toBe(ids?.[1]);
  });

  it("duplicate preserves dimensions", () => {
    useEditorStore
      .getState()
      .resizeElement("image-1", { preferredWidth: 300, preferredHeight: 150, offsetX: 0, offsetY: 0 });
    useEditorStore.getState().selectElement("image-1");

    useEditorStore.getState().duplicateSelection();

    const section2 = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-2");
    const duplicate = section2?.children?.[1];
    expect(duplicate?.dimensions).toEqual({
      preferredWidth: 300,
      preferredHeight: 150,
      offsetX: 0,
      offsetY: 0,
    });
  });

  it("does nothing when duplicating with no selection", () => {
    const before = useEditorStore.getState().document;

    useEditorStore.getState().duplicateSelection();

    expect(useEditorStore.getState().document).toBe(before);
  });

  it("deletes the selected node and selects a predictable fallback (the former parent)", () => {
    useEditorStore.getState().selectElement("heading-1");

    useEditorStore.getState().deleteSelection();

    const section = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-1");
    expect(section?.children?.map((child) => child.id)).toEqual(["paragraph-1", "button-1"]);
    expect(useEditorStore.getState().selectedElementId).toBe("section-1");
  });

  it("does nothing when the document root is selected for delete/cut/duplicate", () => {
    useEditorStore.getState().selectElement("page-root");
    const before = useEditorStore.getState().document;

    useEditorStore.getState().deleteSelection();
    useEditorStore.getState().cutSelection();
    useEditorStore.getState().duplicateSelection();

    expect(useEditorStore.getState().document).toBe(before);
    expect(useEditorStore.getState().clipboard).toBeNull();
  });
});

describe("useEditorStore history (undo/redo)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("undoes an insertion, restoring the document and selection", () => {
    const newNode = { id: "button-new", tag: "button", text: "Go" };
    useEditorStore.getState().selectElement("heading-1");
    useEditorStore.getState().insertElement("section-1", newNode);

    useEditorStore.getState().undo();

    const section = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-1");
    expect(section?.children?.some((child) => child.id === "button-new")).toBe(false);
    expect(useEditorStore.getState().selectedElementId).toBe("heading-1");
  });

  it("redoes an insertion after an undo", () => {
    const newNode = { id: "button-new", tag: "button", text: "Go" };
    useEditorStore.getState().insertElement("section-1", newNode);
    useEditorStore.getState().undo();

    useEditorStore.getState().redo();

    const section = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-1");
    expect(section?.children?.some((child) => child.id === "button-new")).toBe(true);
    expect(useEditorStore.getState().selectedElementId).toBe("button-new");
  });

  it("undoes a deletion", () => {
    useEditorStore.getState().selectElement("heading-1");
    useEditorStore.getState().deleteSelection();

    useEditorStore.getState().undo();

    const section = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-1");
    expect(section?.children?.some((child) => child.id === "heading-1")).toBe(true);
  });

  it("undoes a cut", () => {
    useEditorStore.getState().selectElement("heading-1");
    useEditorStore.getState().cutSelection();

    useEditorStore.getState().undo();

    const section = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-1");
    expect(section?.children?.some((child) => child.id === "heading-1")).toBe(true);
  });

  it("undoes a paste", () => {
    useEditorStore.getState().selectElement("heading-1");
    useEditorStore.getState().copySelection();
    useEditorStore.getState().selectElement("section-2");
    useEditorStore.getState().pasteClipboard();
    const pastedId = useEditorStore.getState().selectedElementId;

    useEditorStore.getState().undo();

    const section2 = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-2");
    expect(section2?.children?.some((child) => child.id === pastedId)).toBe(false);
  });

  it("undoes a duplicate", () => {
    useEditorStore.getState().selectElement("heading-1");
    useEditorStore.getState().duplicateSelection();

    useEditorStore.getState().undo();

    const section = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-1");
    expect(section?.children?.map((child) => child.id)).toEqual([
      "heading-1",
      "paragraph-1",
      "button-1",
    ]);
  });

  it("undoes a move, restoring the original parent and index", () => {
    useEditorStore.getState().moveElement("button-1", "section-2", "inside");

    useEditorStore.getState().undo();

    const section1 = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-1");
    expect(section1?.children?.map((child) => child.id)).toEqual([
      "heading-1",
      "paragraph-1",
      "button-1",
    ]);
  });

  it("undoes an entire resize drag (one transaction) in a single step", () => {
    useEditorStore.getState().beginResizeTransaction();
    useEditorStore
      .getState()
      .resizeElement("section-1", { preferredWidth: 100, preferredHeight: 100, offsetX: 0, offsetY: 0 });
    useEditorStore
      .getState()
      .resizeElement("section-1", { preferredWidth: 200, preferredHeight: 200, offsetX: 0, offsetY: 0 });
    useEditorStore
      .getState()
      .resizeElement("section-1", { preferredWidth: 320, preferredHeight: 180, offsetX: 0, offsetY: 0 });
    useEditorStore.getState().commitResizeTransaction();

    useEditorStore.getState().undo();

    const section = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-1");
    expect(section?.dimensions).toBeUndefined();
    // One transaction, one undo step — nothing left to undo further back
    // than the pre-drag state in this otherwise-untouched document.
    expect(useEditorStore.getState().past).toHaveLength(0);
  });

  it("clears the redo stack after a new edit", () => {
    useEditorStore.getState().insertElement("section-1", { id: "a", tag: "button", text: "A" });
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().future.length).toBeGreaterThan(0);

    useEditorStore.getState().insertElement("section-1", { id: "b", tag: "button", text: "B" });

    expect(useEditorStore.getState().future).toHaveLength(0);
  });

  it("keeps ids stable through an undo/redo round trip", () => {
    useEditorStore.getState().insertElement("section-1", { id: "button-new", tag: "button", text: "Go" });

    useEditorStore.getState().undo();
    useEditorStore.getState().redo();

    const section = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-1");
    expect(section?.children?.some((child) => child.id === "button-new")).toBe(true);
  });

  it("does nothing when undoing with an empty history", () => {
    const before = useEditorStore.getState().document;

    useEditorStore.getState().undo();

    expect(useEditorStore.getState().document).toBe(before);
  });

  it("does nothing when redoing with an empty future", () => {
    const before = useEditorStore.getState().document;

    useEditorStore.getState().redo();

    expect(useEditorStore.getState().document).toBe(before);
  });
});

describe("useEditorStore resize transactions", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("does not push history until the transaction commits", () => {
    useEditorStore.getState().beginResizeTransaction();
    useEditorStore
      .getState()
      .resizeElement("section-1", { preferredWidth: 100, preferredHeight: 100, offsetX: 0, offsetY: 0 });

    expect(useEditorStore.getState().past).toHaveLength(0);

    useEditorStore.getState().commitResizeTransaction();

    expect(useEditorStore.getState().past).toHaveLength(1);
  });

  it("cancelResizeTransaction discards the transaction without pushing history", () => {
    useEditorStore.getState().beginResizeTransaction();
    useEditorStore
      .getState()
      .resizeElement("section-1", { preferredWidth: 100, preferredHeight: 100, offsetX: 0, offsetY: 0 });

    useEditorStore.getState().cancelResizeTransaction();

    expect(useEditorStore.getState().past).toHaveLength(0);
    expect(useEditorStore.getState().transactionSnapshot).toBeNull();
  });

  it("a second beginResizeTransaction call while one is already open does not overwrite the original snapshot", () => {
    useEditorStore.getState().beginResizeTransaction();
    const firstSnapshot = useEditorStore.getState().transactionSnapshot;

    useEditorStore
      .getState()
      .resizeElement("section-1", { preferredWidth: 100, preferredHeight: 100, offsetX: 0, offsetY: 0 });
    useEditorStore.getState().beginResizeTransaction();

    expect(useEditorStore.getState().transactionSnapshot).toBe(firstSnapshot);
  });
});
