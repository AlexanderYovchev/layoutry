import { afterEach, describe, expect, it } from "vitest";
import {
  createAudioNode,
  createCheckboxNode,
  createContainerNode,
  createEmailInputNode,
  createFooterNode,
  createFigcaptionNode,
  createFormNode,
  createHeadingNode,
  createInputNode,
  createLabelNode,
  createLegendNode,
  createLinkNode,
  createListItemNode,
  createProgressNode,
  createRadioNode,
  createIframeNode,
  createSelectNode,
  createTableNode,
  createTextareaNode,
  createUnorderedListNode,
  createVideoNode,
} from "@/features/editor/factories/elementFactories";
import { useEditorStore } from "./useEditorStore";

const initialState = useEditorStore.getState();

describe("useEditorStore", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("starts with no selection", () => {
    expect(useEditorStore.getState().selection).toEqual({ ids: [] });
  });

  it("selects a node", () => {
    useEditorStore.getState().selectElement("heading-1");

    expect(useEditorStore.getState().selection.primaryId).toBe("heading-1");
  });

  it("replaces the selected node when a different id is selected", () => {
    useEditorStore.getState().selectElement("heading-1");
    useEditorStore.getState().selectElement("paragraph-1");

    expect(useEditorStore.getState().selection.primaryId).toBe("paragraph-1");
  });

  it("clears the selection", () => {
    useEditorStore.getState().selectElement("heading-1");
    useEditorStore.getState().clearSelection();

    expect(useEditorStore.getState().selection).toEqual({ ids: [] });
  });

  it("inserts a node into the target parent and selects it in one update", () => {
    const newNode = { id: "button-new", tag: "button", text: "Go" };

    useEditorStore.getState().insertElement("section-1", newNode);

    const section = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-1");
    expect(section?.children?.at(-1)).toEqual(newNode);
    expect(useEditorStore.getState().selection.primaryId).toBe("button-new");
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
    expect(useEditorStore.getState().selection.primaryId).toBe("heading-new");
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
    expect(state.selection.primaryId).toBe("button-1");
  });

  it("rejects an invalid move without altering the document", () => {
    const before = useEditorStore.getState().document;

    useEditorStore.getState().moveElement("section-1", "heading-1", "inside");

    expect(useEditorStore.getState().document).toBe(before);
  });

  it("rejects an invalid move without pushing a spurious history entry (Checkpoint 1.6 — insertElement/moveElement no-op guard)", () => {
    const pastLengthBefore = useEditorStore.getState().past.length;

    useEditorStore.getState().moveElement("section-1", "heading-1", "inside");

    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore);
  });

  it("an insertion rejected by constrained list nesting does not alter the document, push history, or change selection (Checkpoint 1.6)", () => {
    const before = useEditorStore.getState().document;
    const pastLengthBefore = useEditorStore.getState().past.length;
    useEditorStore.getState().selectElement("heading-1");

    // A List Item aimed at an ordinary Section — invalid outside a ul/ol.
    useEditorStore.getState().insertElement("section-1", createListItemNode());

    expect(useEditorStore.getState().document).toBe(before);
    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore);
    expect(useEditorStore.getState().selection.primaryId).toBe("heading-1");
  });

  it("an insertion rejected by Legend's own constrained nesting does not alter the document, push history, or change selection (Checkpoint 1.15.6.12.1 — the same 'safe no-op' shape List Item's own rejection above already proves, now for CONSTRAINED_CHILD_EXTRA_PARENTS)", () => {
    const before = useEditorStore.getState().document;
    const pastLengthBefore = useEditorStore.getState().past.length;
    useEditorStore.getState().selectElement("heading-1");

    // A Legend aimed at an ordinary Section — invalid outside a fieldset.
    useEditorStore.getState().insertElement("section-1", createLegendNode());

    expect(useEditorStore.getState().document).toBe(before);
    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore);
    expect(useEditorStore.getState().selection.primaryId).toBe("heading-1");
  });

  it("an insertion rejected by Figcaption's own constrained nesting does not alter the document, push history, or change selection (Checkpoint 1.15.6.12.2 — the same CONSTRAINED_CHILD_EXTRA_PARENTS shape Legend's own rejection above already proves)", () => {
    const before = useEditorStore.getState().document;
    const pastLengthBefore = useEditorStore.getState().past.length;
    useEditorStore.getState().selectElement("heading-1");

    // A Figcaption aimed at an ordinary Section — invalid outside a figure.
    useEditorStore.getState().insertElement("section-1", createFigcaptionNode());

    expect(useEditorStore.getState().document).toBe(before);
    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore);
    expect(useEditorStore.getState().selection.primaryId).toBe("heading-1");
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
    expect(useEditorStore.getState().selection.primaryId).toBe("section-1");
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
    expect(useEditorStore.getState().selection.primaryId).toBe("section-1");
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
    expect(useEditorStore.getState().selection.primaryId).toBe(pasted?.id);
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
    expect(useEditorStore.getState().selection.primaryId).toBe(ids?.[1]);
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
    expect(useEditorStore.getState().selection.primaryId).toBe("section-1");
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
    expect(useEditorStore.getState().selection.primaryId).toBe("heading-1");
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
    expect(useEditorStore.getState().selection.primaryId).toBe("button-new");
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
    const pastedId = useEditorStore.getState().selection.primaryId;

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

describe("useEditorStore — Free layout (Checkpoint 3.4.4)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  function makeFree() {
    useEditorStore.getState().convertToFreeLayout("section-1", {
      "heading-1": { x: 16, y: 16, width: 240, height: 48 },
      "paragraph-1": { x: 16, y: 80, width: 240, height: 80 },
      "button-1": { x: 16, y: 176, width: 120, height: 40 },
    });
  }

  it("setFreeChildGeometry updates the node and pushes one history entry", () => {
    makeFree();
    const pastLengthBefore = useEditorStore.getState().past.length;

    useEditorStore.getState().setFreeChildGeometry("heading-1", { x: 50, y: 60, width: 200, height: 100 });

    const heading = useEditorStore
      .getState()
      .document.children?.find((c) => c.id === "section-1")
      ?.children?.find((c) => c.id === "heading-1");
    expect(heading?.freeLayout).toEqual({ x: 50, y: 60, width: 200, height: 100 });
    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore + 1);
  });

  it("setFreeChildGeometryLive updates the node without pushing history", () => {
    makeFree();
    const pastLengthBefore = useEditorStore.getState().past.length;

    useEditorStore.getState().setFreeChildGeometryLive("heading-1", { x: 50, y: 60, width: 200, height: 100 });

    const heading = useEditorStore
      .getState()
      .document.children?.find((c) => c.id === "section-1")
      ?.children?.find((c) => c.id === "heading-1");
    expect(heading?.freeLayout).toEqual({ x: 50, y: 60, width: 200, height: 100 });
    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore);
  });

  it("applyFreeContainerChildGeometriesLive atomically updates the container and its children without pushing history", () => {
    makeFree();
    const pastLengthBefore = useEditorStore.getState().past.length;

    useEditorStore.getState().applyFreeContainerChildGeometriesLive(
      "section-1",
      { dimensions: { preferredWidth: 500, preferredHeight: 400, offsetX: 0, offsetY: 0 } },
      { "heading-1": { x: 32, y: 32, width: 480, height: 96 } },
    );

    const section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(section?.dimensions).toEqual({ preferredWidth: 500, preferredHeight: 400, offsetX: 0, offsetY: 0 });
    expect(section?.children?.find((c) => c.id === "heading-1")?.freeLayout).toEqual({
      x: 32,
      y: 32,
      width: 480,
      height: 96,
    });
    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore);
  });

  it("setChildResizePolicy pushes one history entry", () => {
    makeFree();
    const pastLengthBefore = useEditorStore.getState().past.length;

    useEditorStore.getState().setChildResizePolicy("section-1", "clamp");

    const section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(section?.childResizePolicy).toBe("clamp");
    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore + 1);
  });

  it("convertToFreeLayout sets layoutMode free and each child's freeLayout in one history entry", () => {
    const pastLengthBefore = useEditorStore.getState().past.length;

    makeFree();

    const section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(section?.layoutMode).toBe("free");
    expect(section?.children?.find((c) => c.id === "heading-1")?.freeLayout).toEqual({
      x: 16,
      y: 16,
      width: 240,
      height: 48,
    });
    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore + 1);
  });

  it("convertToFlowLayout restores flow mode and clears freeLayout in one history entry, and undo restores Free mode atomically", () => {
    makeFree();
    const pastLengthBefore = useEditorStore.getState().past.length;

    useEditorStore.getState().convertToFlowLayout("section-1");

    let section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(section?.layoutMode).toBe("flow");
    expect(section?.children?.every((c) => c.freeLayout === undefined)).toBe(true);
    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore + 1);

    useEditorStore.getState().undo();

    section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(section?.layoutMode).toBe("free");
    expect(section?.children?.find((c) => c.id === "heading-1")?.freeLayout).toEqual({
      x: 16,
      y: 16,
      width: 240,
      height: 48,
    });
  });

  it("pasteClipboard places a clone inside a Free destination without overlapping an existing child", () => {
    makeFree();
    useEditorStore.getState().selectElement("heading-1");
    useEditorStore.getState().copySelection();
    useEditorStore.getState().selectElement("section-1");

    useEditorStore.getState().pasteClipboard();

    const pastedId = useEditorStore.getState().selection.primaryId;
    const section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    const pasted = section?.children?.find((c) => c.id === pastedId);
    const original = section?.children?.find((c) => c.id === "heading-1");

    expect(pasted?.freeLayout).toBeDefined();
    expect(pasted?.freeLayout).not.toEqual(original?.freeLayout);
    const pastedGeometry = pasted!.freeLayout!;
    expect(pastedGeometry.x + pastedGeometry.width).toBeLessThanOrEqual(
      section!.dimensions?.preferredWidth ?? Infinity,
    );
  });

  it("duplicateSelection places the duplicate inside a Free parent without overlapping the original", () => {
    makeFree();
    useEditorStore.getState().selectElement("heading-1");

    useEditorStore.getState().duplicateSelection();

    const duplicateId = useEditorStore.getState().selection.primaryId;
    const section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    const duplicate = section?.children?.find((c) => c.id === duplicateId);
    const original = section?.children?.find((c) => c.id === "heading-1");

    expect(duplicate?.freeLayout).toBeDefined();
    expect(duplicate?.freeLayout).not.toEqual(original?.freeLayout);
  });

  it("pasting into a Flow destination leaves freeLayout untouched (no Free-specific placement applied)", () => {
    useEditorStore.getState().selectElement("heading-1");
    useEditorStore.getState().copySelection();
    useEditorStore.getState().selectElement("section-2");

    useEditorStore.getState().pasteClipboard();

    const pastedId = useEditorStore.getState().selection.primaryId;
    const section2 = useEditorStore.getState().document.children?.find((c) => c.id === "section-2");
    const pasted = section2?.children?.find((c) => c.id === pastedId);
    expect(pasted?.freeLayout).toBeUndefined();
  });
});

describe("useEditorStore — Flow layout, spacing, Flex/Grid (Checkpoint 3.5)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("setFlowDisplayMode pushes one history entry and is undoable", () => {
    const pastLengthBefore = useEditorStore.getState().past.length;
    useEditorStore.getState().setFlowDisplayMode("section-1", "flex");

    expect(useEditorStore.getState().document.children?.find((c) => c.id === "section-1")?.flowLayout?.display).toBe(
      "flex",
    );
    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore + 1);

    useEditorStore.getState().undo();
    expect(
      useEditorStore.getState().document.children?.find((c) => c.id === "section-1")?.flowLayout,
    ).toBeUndefined();
  });

  it("setFlexContainerSettings and setGridContainerSettings each push one history entry", () => {
    useEditorStore.getState().setFlexContainerSettings("section-1", {
      direction: "column",
      wrap: "wrap",
      justifyContent: "center",
      alignItems: "center",
      rowGap: 8,
      columnGap: 8,
    });
    useEditorStore.getState().setGridContainerSettings("section-1", {
      columns: 3,
      rows: "auto",
      rowGap: 16,
      columnGap: 16,
    });

    const node = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(node?.flowLayout?.flex?.direction).toBe("column");
    expect(node?.flowLayout?.grid?.columns).toBe(3);
  });

  it("setElementMargin and setElementPadding each push one history entry", () => {
    const pastLengthBefore = useEditorStore.getState().past.length;
    useEditorStore.getState().setElementMargin("heading-1", { top: 4, right: 4, bottom: 4, left: 4 });
    useEditorStore.getState().setElementPadding("section-1", { top: 24, right: 24, bottom: 24, left: 24 });

    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore + 2);
  });

  it("setElementPadding re-normalizes a Free container's children in the same store write", () => {
    useEditorStore.getState().convertToFreeLayout(
      "section-1",
      { "heading-1": { x: 16, y: 16, width: 240, height: 48 } },
      { dimensions: { preferredWidth: 300, preferredHeight: 200, offsetX: 0, offsetY: 0 } },
    );

    useEditorStore.getState().setElementPadding("section-1", { top: 100, right: 100, bottom: 100, left: 100 });

    const section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    const heading = section?.children?.find((c) => c.id === "heading-1");
    // New content box is 100x0 (300-200, 200-200 floored at 0) — heading must fit within it.
    expect(heading!.freeLayout!.x + heading!.freeLayout!.width).toBeLessThanOrEqual(100);
  });

  it("setFlexChildSettings pushes one history entry", () => {
    useEditorStore.getState().setFlexChildSettings("heading-1", { grow: 1, shrink: 0, basis: "auto", alignSelf: "center" });
    const node = useEditorStore
      .getState()
      .document.children?.find((c) => c.id === "section-1")
      ?.children?.find((c) => c.id === "heading-1");
    expect(node?.flexChild).toEqual({ grow: 1, shrink: 0, basis: "auto", alignSelf: "center" });
  });

  it("setGridChildSettings clamps column/row values to the parent's current Grid track bounds", () => {
    useEditorStore.getState().setGridContainerSettings("section-1", {
      columns: 2,
      rows: "auto",
      rowGap: 16,
      columnGap: 16,
    });

    useEditorStore.getState().setGridChildSettings("heading-1", {
      columnStart: 5, // parent only has 2 columns
      columnSpan: 10,
      rowStart: "auto",
      rowSpan: 1,
    });

    const node = useEditorStore
      .getState()
      .document.children?.find((c) => c.id === "section-1")
      ?.children?.find((c) => c.id === "heading-1");
    expect(node?.gridChild?.columnStart).toBe(2);
    expect(node?.gridChild?.columnSpan).toBe(2);
  });

  it("setGridChildSettings clamps against the resolved default grid (2 columns) even when the parent has no explicit Grid settings yet", () => {
    useEditorStore.getState().setGridChildSettings("heading-1", {
      columnStart: 5,
      columnSpan: 10,
      rowStart: "auto",
      rowSpan: 1,
    });

    const node = useEditorStore
      .getState()
      .document.children?.find((c) => c.id === "section-1")
      ?.children?.find((c) => c.id === "heading-1");
    // getGridContainerSettings always resolves safe defaults (2 columns)
    // even for an unconfigured parent, so clamping still applies.
    expect(node?.gridChild?.columnStart).toBe(2);
    expect(node?.gridChild?.columnSpan).toBe(2);
  });

  it("setGridContainerSettings re-clamps an already-set child's placement in the same store write when columns shrink (Checkpoint 3.5.1)", () => {
    useEditorStore.getState().setGridContainerSettings("section-1", {
      columns: 4,
      rows: "auto",
      rowGap: 16,
      columnGap: 16,
    });
    useEditorStore.getState().setGridChildSettings("heading-1", {
      columnStart: 3,
      columnSpan: 2,
      rowStart: "auto",
      rowSpan: 1,
    });

    // Shrink the same container down to 2 columns — heading-1's column 3
    // start no longer exists.
    useEditorStore.getState().setGridContainerSettings("section-1", {
      columns: 2,
      rows: "auto",
      rowGap: 16,
      columnGap: 16,
    });

    const node = useEditorStore
      .getState()
      .document.children?.find((c) => c.id === "section-1")
      ?.children?.find((c) => c.id === "heading-1");
    expect(node?.gridChild?.columnStart).toBeLessThanOrEqual(2);
  });

  it("setMediaFitSettings pushes one history entry and is undoable", () => {
    const pastLengthBefore = useEditorStore.getState().past.length;
    useEditorStore.getState().setMediaFitSettings("image-1", {
      objectFit: "cover",
      objectPositionX: { value: 50, unit: "%" },
      objectPositionY: { value: 0, unit: "%" },
    });

    const node = useEditorStore.getState().document.children?.find((c) => c.id === "section-2")?.children?.find((c) => c.id === "image-1");
    expect(node?.mediaFit).toEqual({ objectFit: "cover", objectPositionX: { value: 50, unit: "%" }, objectPositionY: { value: 0, unit: "%" } });
    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore + 1);

    useEditorStore.getState().undo();
    const reverted = useEditorStore.getState().document.children?.find((c) => c.id === "section-2")?.children?.find((c) => c.id === "image-1");
    expect(reverted?.mediaFit).toBeUndefined();
  });

  it("setElementTypography pushes one history entry and is undoable/redoable", () => {
    const pastLengthBefore = useEditorStore.getState().past.length;
    useEditorStore.getState().setElementTypography("heading-1", { fontWeight: 700, color: "#3366ff" });

    const node = useEditorStore.getState().document.children?.find((c) => c.id === "section-1")?.children?.find((c) => c.id === "heading-1");
    expect(node?.typography).toEqual({ fontWeight: 700, color: "#3366ff" });
    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore + 1);

    useEditorStore.getState().undo();
    const reverted = useEditorStore.getState().document.children?.find((c) => c.id === "section-1")?.children?.find((c) => c.id === "heading-1");
    expect(reverted?.typography).toBeUndefined();

    useEditorStore.getState().redo();
    const redone = useEditorStore.getState().document.children?.find((c) => c.id === "section-1")?.children?.find((c) => c.id === "heading-1");
    expect(redone?.typography).toEqual({ fontWeight: 700, color: "#3366ff" });
  });

  it("setElementBackground pushes one history entry and is undoable/redoable", () => {
    const pastLengthBefore = useEditorStore.getState().past.length;
    useEditorStore.getState().setElementBackground("section-1", { color: "#3366ff", repeat: "no-repeat" });

    const node = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(node?.background).toEqual({ color: "#3366ff", repeat: "no-repeat" });
    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore + 1);

    useEditorStore.getState().undo();
    const reverted = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(reverted?.background).toBeUndefined();

    useEditorStore.getState().redo();
    const redone = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(redone?.background).toEqual({ color: "#3366ff", repeat: "no-repeat" });
  });

  it("setElementBorder pushes one history entry and is undoable/redoable", () => {
    const pastLengthBefore = useEditorStore.getState().past.length;
    const border = { top: { width: { value: 2, unit: "px" as const }, style: "solid" as const } };
    useEditorStore.getState().setElementBorder("section-1", border);

    const node = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(node?.border).toEqual(border);
    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore + 1);

    useEditorStore.getState().undo();
    const reverted = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(reverted?.border).toBeUndefined();

    useEditorStore.getState().redo();
    const redone = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(redone?.border).toEqual(border);
  });

  it("setElementBorderRadius pushes one history entry and is undoable/redoable", () => {
    const pastLengthBefore = useEditorStore.getState().past.length;
    const borderRadius = { topLeft: { value: 8, unit: "px" as const } };
    useEditorStore.getState().setElementBorderRadius("section-1", borderRadius);

    const node = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(node?.borderRadius).toEqual(borderRadius);
    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore + 1);

    useEditorStore.getState().undo();
    const reverted = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(reverted?.borderRadius).toBeUndefined();

    useEditorStore.getState().redo();
    const redone = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(redone?.borderRadius).toEqual(borderRadius);
  });

  it("setElementBoxShadow pushes one history entry and is undoable/redoable", () => {
    const pastLengthBefore = useEditorStore.getState().past.length;
    const boxShadow = [{ id: "shadow-1", enabled: true, inset: false, color: "#000000" }];
    useEditorStore.getState().setElementBoxShadow("section-1", boxShadow);

    const node = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(node?.boxShadow).toEqual(boxShadow);
    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore + 1);

    useEditorStore.getState().undo();
    const reverted = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(reverted?.boxShadow).toBeUndefined();

    useEditorStore.getState().redo();
    const redone = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(redone?.boxShadow).toEqual(boxShadow);
  });

  it("setElementFilters pushes one history entry and is undoable/redoable", () => {
    const pastLengthBefore = useEditorStore.getState().past.length;
    const filters = { opacity: 50, blur: { value: 4, unit: "px" as const } };
    useEditorStore.getState().setElementFilters("section-1", filters);

    const node = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(node?.filters).toEqual(filters);
    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore + 1);

    useEditorStore.getState().undo();
    const reverted = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(reverted?.filters).toBeUndefined();

    useEditorStore.getState().redo();
    const redone = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(redone?.filters).toEqual(filters);
  });

  it("setElementDisplay pushes one history entry and is undoable/redoable", () => {
    const pastLengthBefore = useEditorStore.getState().past.length;
    const display = { display: "none" as const, cursor: "not-allowed" as const };
    useEditorStore.getState().setElementDisplay("section-1", display);

    const node = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(node?.display).toEqual(display);
    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore + 1);

    useEditorStore.getState().undo();
    const reverted = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(reverted?.display).toBeUndefined();

    useEditorStore.getState().redo();
    const redone = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(redone?.display).toEqual(display);
  });

  it("setElementPosition pushes one history entry and is undoable/redoable", () => {
    const pastLengthBefore = useEditorStore.getState().past.length;
    const position = { position: "absolute" as const };
    useEditorStore.getState().setElementPosition("section-1", position);

    const node = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(node?.position).toEqual(position);
    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore + 1);

    useEditorStore.getState().undo();
    const reverted = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(reverted?.position).toBeUndefined();

    useEditorStore.getState().redo();
    const redone = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(redone?.position).toEqual(position);
  });
});

describe("useEditorStore — Resize & Sizing (Checkpoint 5.7)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("setElementDimensions pushes one history entry and is undoable", () => {
    const pastLengthBefore = useEditorStore.getState().past.length;
    useEditorStore.getState().setElementDimensions("section-1", { preferredWidth: 320, preferredHeight: 180, offsetX: 0, offsetY: 0 });

    const node = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(node?.dimensions).toEqual({ preferredWidth: 320, preferredHeight: 180, offsetX: 0, offsetY: 0 });
    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore + 1);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.children?.find((c) => c.id === "section-1")?.dimensions).toBeUndefined();
  });

  it("setSizeConstraints pushes one history entry and is undoable", () => {
    const pastLengthBefore = useEditorStore.getState().past.length;
    useEditorStore.getState().setSizeConstraints("section-1", { minWidth: 100, maxWidth: 800 });

    const node = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(node?.sizeConstraints).toEqual({ minWidth: 100, maxWidth: 800 });
    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore + 1);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.children?.find((c) => c.id === "section-1")?.sizeConstraints).toBeUndefined();
  });

  it("setAspectRatioLocked pushes one history entry and is undoable", () => {
    const pastLengthBefore = useEditorStore.getState().past.length;
    useEditorStore.getState().setAspectRatioLocked("section-1", true);

    const node = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(node?.aspectRatioLocked).toBe(true);
    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore + 1);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.children?.find((c) => c.id === "section-1")?.aspectRatioLocked).toBeUndefined();
  });

  it("setElementText pushes exactly one history entry per commit and is undoable/redoable (Checkpoint 1.3)", () => {
    const pastLengthBefore = useEditorStore.getState().past.length;
    useEditorStore.getState().setElementText("heading-1", "Build visually with Layoutry");

    const node = useEditorStore
      .getState()
      .document.children?.find((c) => c.id === "section-1")
      ?.children?.find((c) => c.id === "heading-1");
    expect(node?.text).toBe("Build visually with Layoutry");
    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore + 1);

    useEditorStore.getState().undo();
    const reverted = useEditorStore
      .getState()
      .document.children?.find((c) => c.id === "section-1")
      ?.children?.find((c) => c.id === "heading-1");
    expect(reverted?.text).toBe("Build layouts visually. Own the code.");

    useEditorStore.getState().redo();
    const redone = useEditorStore
      .getState()
      .document.children?.find((c) => c.id === "section-1")
      ?.children?.find((c) => c.id === "heading-1");
    expect(redone?.text).toBe("Build visually with Layoutry");
  });

  it("setElementText on a Button label pushes exactly one history entry and is undoable/redoable (Checkpoint 1.5 — same tag-agnostic command as Heading/Paragraph/Link)", () => {
    const pastLengthBefore = useEditorStore.getState().past.length;
    useEditorStore.getState().setElementText("button-1", "Start Building");

    const findButton = () =>
      useEditorStore
        .getState()
        .document.children?.find((c) => c.id === "section-1")
        ?.children?.find((c) => c.id === "button-1");
    expect(findButton()?.text).toBe("Start Building");
    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore + 1);

    useEditorStore.getState().undo();
    expect(findButton()?.text).toBe("Get Started");

    useEditorStore.getState().redo();
    expect(findButton()?.text).toBe("Start Building");
  });

  it("setElementHref pushes exactly one history entry per commit and is undoable/redoable (Checkpoint 1.4)", () => {
    useEditorStore.getState().insertElement("section-1", createLinkNode());
    const linkId = useEditorStore.getState().selection.primaryId!;
    const pastLengthBefore = useEditorStore.getState().past.length;

    useEditorStore.getState().setElementHref(linkId, "/pricing");

    const findLink = () =>
      useEditorStore
        .getState()
        .document.children?.find((c) => c.id === "section-1")
        ?.children?.find((c) => c.id === linkId);

    expect(findLink()?.href).toBe("/pricing");
    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore + 1);

    useEditorStore.getState().undo();
    expect(findLink()?.href).toBe("#");

    useEditorStore.getState().redo();
    expect(findLink()?.href).toBe("/pricing");
  });
});

describe("useEditorStore — setElementTag (Checkpoint 1.7)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  function findHeading() {
    return useEditorStore
      .getState()
      .document.children?.find((c) => c.id === "section-1")
      ?.children?.find((c) => c.id === "heading-1");
  }

  it("pushes exactly one history entry per commit and is undoable/redoable", () => {
    const pastLengthBefore = useEditorStore.getState().past.length;

    useEditorStore.getState().setElementTag("heading-1", "h3");

    expect(findHeading()?.tag).toBe("h3");
    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore + 1);

    useEditorStore.getState().undo();
    expect(findHeading()?.tag).toBe("h1");

    useEditorStore.getState().redo();
    expect(findHeading()?.tag).toBe("h3");
  });

  it("does not push a history entry when the tag is already the current one (selecting the already-active level does nothing)", () => {
    const pastLengthBefore = useEditorStore.getState().past.length;

    useEditorStore.getState().setElementTag("heading-1", "h1");

    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore);
  });

  it("preserves text, styles, and selection across a level change", () => {
    useEditorStore.getState().selectElement("heading-1");
    useEditorStore.getState().setElementTypography("heading-1", { fontWeight: 700 });

    useEditorStore.getState().setElementTag("heading-1", "h2");

    expect(findHeading()?.text).toBe("Build layouts visually. Own the code.");
    expect(findHeading()?.typography).toEqual({ fontWeight: 700 });
    expect(useEditorStore.getState().selection.primaryId).toBe("heading-1");
  });
});

describe("useEditorStore — Lists (Checkpoint 1.6)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("inserts a starter unordered list as one logical insertion — one history entry for the whole ul + 3 li subtree", () => {
    const pastLengthBefore = useEditorStore.getState().past.length;

    useEditorStore.getState().insertElement("section-1", createUnorderedListNode());

    const listId = useEditorStore.getState().selection.primaryId!;
    const list = useEditorStore
      .getState()
      .document.children?.find((c) => c.id === "section-1")
      ?.children?.find((c) => c.id === listId);
    expect(list?.tag).toBe("ul");
    expect(list?.children).toHaveLength(3);
    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore + 1);
  });

  it("inserting a List Item while the list itself is selected appends it into that list (a practical, un-hacky add-item path)", () => {
    useEditorStore.getState().insertElement("section-1", createUnorderedListNode());
    const listId = useEditorStore.getState().selection.primaryId!;
    // selection is already the ul after insertElement (see comment above insertElement's own definition)

    useEditorStore.getState().insertElement(listId, createListItemNode());

    const list = useEditorStore
      .getState()
      .document.children?.find((c) => c.id === "section-1")
      ?.children?.find((c) => c.id === listId);
    expect(list?.children).toHaveLength(4);
  });

  it("setElementText on a list item's label pushes exactly one history entry and is undoable/redoable, same tag-agnostic command as every other primitive", () => {
    useEditorStore.getState().insertElement("section-1", createUnorderedListNode());
    const listId = useEditorStore.getState().selection.primaryId!;
    const findList = () =>
      useEditorStore
        .getState()
        .document.children?.find((c) => c.id === "section-1")
        ?.children?.find((c) => c.id === listId);
    const firstItemId = findList()!.children![0].id;
    const pastLengthBefore = useEditorStore.getState().past.length;

    useEditorStore.getState().setElementText(firstItemId, "First item");

    expect(findList()?.children?.[0]?.text).toBe("First item");
    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore + 1);

    useEditorStore.getState().undo();
    expect(findList()?.children?.[0]?.text).toBe("List item");

    useEditorStore.getState().redo();
    expect(findList()?.children?.[0]?.text).toBe("First item");
  });

  it("duplicating an entire list clones every item recursively with fresh ids (reuses cloneNodeWithFreshIds — no list-specific clone logic)", () => {
    useEditorStore.getState().insertElement("section-1", createUnorderedListNode());
    const listId = useEditorStore.getState().selection.primaryId!;

    useEditorStore.getState().duplicateSelection();

    const section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    const lists = section?.children?.filter((c) => c.tag === "ul") ?? [];
    expect(lists).toHaveLength(2);
    const [original, duplicate] = lists;
    expect(duplicate.id).not.toBe(original.id);
    expect(duplicate.children).toHaveLength(3);
    expect(original.id).toBe(listId);
    const originalItemIds = original.children?.map((c) => c.id) ?? [];
    const duplicateItemIds = duplicate.children?.map((c) => c.id) ?? [];
    expect(duplicateItemIds.some((id) => originalItemIds.includes(id))).toBe(false);
  });

  it("reordering list items via moveElement changes document order (drives native OL numbering/UL bullet order)", () => {
    useEditorStore.getState().insertElement("section-1", createUnorderedListNode());
    const listId = useEditorStore.getState().selection.primaryId!;
    const findList = () =>
      useEditorStore
        .getState()
        .document.children?.find((c) => c.id === "section-1")
        ?.children?.find((c) => c.id === listId);
    const [first, second, third] = findList()?.children ?? [];

    useEditorStore.getState().moveElement(third.id, first.id, "before");

    expect(findList()?.children?.map((c) => c.id)).toEqual([third.id, first.id, second.id]);
  });
});

describe("useEditorStore — semantic sectioning family (Checkpoint 1.8)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("duplicates a Footer subtree (Footer > Container > Heading) recursively with fresh ids, and the duplicate is undoable/redoable", () => {
    useEditorStore.getState().insertElement("section-1", createFooterNode());
    const footerId = useEditorStore.getState().selection.primaryId!;
    useEditorStore.getState().insertElement(footerId, createContainerNode());
    const containerId = useEditorStore.getState().selection.primaryId!;
    useEditorStore.getState().insertElement(containerId, createHeadingNode());

    useEditorStore.getState().selectElement(footerId);
    useEditorStore.getState().duplicateSelection();

    const section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    const footers = section?.children?.filter((c) => c.tag === "footer") ?? [];
    expect(footers).toHaveLength(2);
    const [original, duplicate] = footers;
    expect(duplicate.id).not.toBe(original.id);

    const originalIds = collectIds(original);
    const duplicateIds = collectIds(duplicate);
    expect(duplicateIds).toHaveLength(originalIds.length);
    expect(duplicateIds.some((id) => originalIds.includes(id))).toBe(false);
    // Structure preserved: the duplicate's own Container still holds a Heading.
    expect(duplicate.children?.[0]?.tag).toBe("div");
    expect(duplicate.children?.[0]?.children?.[0]?.tag).toBe("h1");

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.children?.find((c) => c.id === "section-1")?.children?.filter((c) => c.tag === "footer")).toHaveLength(1);

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().document.children?.find((c) => c.id === "section-1")?.children?.filter((c) => c.tag === "footer")).toHaveLength(2);
  });
});

describe("useEditorStore — Form + Text Input foundation (Checkpoint 1.10)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("setElementValue/setElementName/setElementPlaceholder each push exactly one history entry per completed edit, and undo restores the previous value", () => {
    useEditorStore.getState().insertElement("section-1", createFormNode());
    const formId = useEditorStore.getState().selection.primaryId!;
    useEditorStore.getState().insertElement(formId, createInputNode());
    const inputId = useEditorStore.getState().selection.primaryId!;

    const findInput = () => useEditorStore.getState().document.children?.find((c) => c.id === "section-1")?.children?.find((c) => c.id === formId)?.children?.find((c) => c.id === inputId);

    useEditorStore.getState().setElementValue(inputId, "test@example.com");
    expect(findInput()?.value).toBe("test@example.com");

    useEditorStore.getState().undo();
    expect(findInput()?.value).toBeUndefined();

    useEditorStore.getState().redo();
    expect(findInput()?.value).toBe("test@example.com");

    useEditorStore.getState().setElementName(inputId, "email");
    expect(findInput()?.name).toBe("email");
    useEditorStore.getState().undo();
    expect(findInput()?.name).toBeUndefined();

    useEditorStore.getState().setElementPlaceholder(inputId, "you@example.com");
    expect(findInput()?.placeholder).toBe("you@example.com");
    useEditorStore.getState().undo();
    expect(findInput()?.placeholder).toBe("Enter text");
  });

  it("setElementValue/setElementName/setElementPlaceholder push no history entry when the value is unchanged (strongest no-op guard, same shape as setElementTag)", () => {
    useEditorStore.getState().insertElement("section-1", createInputNode());
    const inputId = useEditorStore.getState().selection.primaryId!;
    const beforeDocument = useEditorStore.getState().document;

    useEditorStore.getState().setElementPlaceholder(inputId, "Enter text");
    useEditorStore.getState().setElementName(inputId, undefined);
    useEditorStore.getState().setElementValue(inputId, undefined);

    expect(useEditorStore.getState().document).toBe(beforeDocument);
    expect(useEditorStore.getState().past).toHaveLength(1); // only the original insertElement entry
  });

  it("a Text Input can be inserted into Form and into an ordinary Container — no Form-only restriction (Section 21)", () => {
    for (const factory of [createFormNode, createContainerNode]) {
      useEditorStore.setState(initialState, true);
      useEditorStore.getState().insertElement("section-1", factory());
      const parentId = useEditorStore.getState().selection.primaryId!;
      useEditorStore.getState().insertElement(parentId, createInputNode());

      const parent = useEditorStore
        .getState()
        .document.children?.find((c) => c.id === "section-1")
        ?.children?.find((c) => c.id === parentId);
      expect(parent?.children?.some((c) => c.tag === "input"), parent?.tag).toBe(true);
    }
  });

  it("duplicates a Form subtree (Form > Input) recursively with fresh ids, preserving inputType/name/placeholder/value, and the duplicate can be edited independently", () => {
    useEditorStore.getState().insertElement("section-1", createFormNode());
    const formId = useEditorStore.getState().selection.primaryId!;
    useEditorStore.getState().insertElement(formId, createInputNode());
    const inputId = useEditorStore.getState().selection.primaryId!;
    useEditorStore.getState().setElementName(inputId, "email");
    useEditorStore.getState().setElementValue(inputId, "test@example.com");

    useEditorStore.getState().selectElement(formId);
    useEditorStore.getState().duplicateSelection();

    const section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    const forms = section?.children?.filter((c) => c.tag === "form") ?? [];
    expect(forms).toHaveLength(2);
    const [original, duplicate] = forms;
    expect(duplicate.id).not.toBe(original.id);

    const duplicateInput = duplicate.children?.[0];
    const originalInput = original.children?.[0];
    expect(duplicateInput?.id).not.toBe(originalInput?.id);
    expect(duplicateInput?.tag).toBe("input");
    expect(duplicateInput?.inputType).toBe("text");
    expect(duplicateInput?.name).toBe("email");
    expect(duplicateInput?.value).toBe("test@example.com");
    expect(duplicateInput?.placeholder).toBe(originalInput?.placeholder);

    // Editing the duplicate never touches the original (independent nodes).
    useEditorStore.getState().setElementValue(duplicateInput!.id, "changed@example.com");
    const refreshedOriginal = useEditorStore
      .getState()
      .document.children?.find((c) => c.id === "section-1")
      ?.children?.find((c) => c.id === original.id)?.children?.[0];
    expect(refreshedOriginal?.value).toBe("test@example.com");
  });
});

describe("useEditorStore — Label + expanded text-like Input types (Checkpoint 1.11)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("setElementInputType pushes exactly one history entry per change, no entry on no-op, and undo restores the previous type", () => {
    useEditorStore.getState().insertElement("section-1", createInputNode());
    const inputId = useEditorStore.getState().selection.primaryId!;
    const findInput = () => useEditorStore.getState().document.children?.find((c) => c.id === "section-1")?.children?.find((c) => c.id === inputId);
    const pastLengthAfterInsert = useEditorStore.getState().past.length;

    useEditorStore.getState().setElementInputType(inputId, "email");
    expect(findInput()?.inputType).toBe("email");
    expect(useEditorStore.getState().past).toHaveLength(pastLengthAfterInsert + 1);

    useEditorStore.getState().setElementInputType(inputId, "email");
    expect(useEditorStore.getState().past).toHaveLength(pastLengthAfterInsert + 1); // no-op, no new entry

    useEditorStore.getState().undo();
    expect(findInput()?.inputType).toBe("text");
  });

  it("Label can be inserted into Form and into an ordinary Container, and can itself contain an Input — Form > Label > Input", () => {
    useEditorStore.getState().insertElement("section-1", createFormNode());
    const formId = useEditorStore.getState().selection.primaryId!;
    useEditorStore.getState().insertElement(formId, createLabelNode());
    const labelId = useEditorStore.getState().selection.primaryId!;
    useEditorStore.getState().insertElement(labelId, createEmailInputNode());

    const form = useEditorStore.getState().document.children?.find((c) => c.id === "section-1")?.children?.find((c) => c.id === formId);
    expect(form?.tag).toBe("form");
    const label = form?.children?.find((c) => c.id === labelId);
    expect(label?.tag).toBe("label");
    expect(label?.children).toHaveLength(1);
    expect(label?.children?.[0]?.tag).toBe("input");
    expect(label?.children?.[0]?.inputType).toBe("email");
  });

  it("Label rejects insertion into a List — Checkpoint 1.6's UL/OL li-only rule remains intact", () => {
    useEditorStore.getState().insertElement("section-1", createUnorderedListNode());
    const listId = useEditorStore.getState().selection.primaryId!;
    const beforeDocument = useEditorStore.getState().document;

    useEditorStore.getState().insertElement(listId, createLabelNode());

    expect(useEditorStore.getState().document).toBe(beforeDocument);
  });

  it("duplicates a Form > Label > Email Input subtree recursively with fresh ids, preserving inputType and independent post-duplicate editing", () => {
    useEditorStore.getState().insertElement("section-1", createFormNode());
    const formId = useEditorStore.getState().selection.primaryId!;
    useEditorStore.getState().insertElement(formId, createLabelNode());
    const labelId = useEditorStore.getState().selection.primaryId!;
    useEditorStore.getState().insertElement(labelId, createEmailInputNode());
    const inputId = useEditorStore.getState().selection.primaryId!;
    useEditorStore.getState().setElementName(inputId, "email");

    useEditorStore.getState().selectElement(labelId);
    useEditorStore.getState().duplicateSelection();

    const form = useEditorStore.getState().document.children?.find((c) => c.id === "section-1")?.children?.find((c) => c.id === formId);
    const labels = form?.children?.filter((c) => c.tag === "label") ?? [];
    expect(labels).toHaveLength(2);
    const [original, duplicate] = labels;

    expect(duplicate.id).not.toBe(original.id);
    const duplicateInput = duplicate.children?.[0];
    const originalInput = original.children?.[0];
    expect(duplicateInput?.id).not.toBe(originalInput?.id);
    expect(duplicateInput?.tag).toBe("input");
    expect(duplicateInput?.inputType).toBe("email");
    expect(duplicateInput?.name).toBe("email");

    // Editing the duplicate's Input never touches the original.
    useEditorStore.getState().setElementInputType(duplicateInput!.id, "tel");
    const refreshedOriginalInput = useEditorStore
      .getState()
      .document.children?.find((c) => c.id === "section-1")
      ?.children?.find((c) => c.id === formId)
      ?.children?.find((c) => c.id === original.id)?.children?.[0];
    expect(refreshedOriginalInput?.inputType).toBe("email");
  });
});

describe("useEditorStore — Checkbox/Radio + Textarea foundation (Checkpoint 1.12)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("setElementChecked pushes exactly one history entry per change, no entry on no-op, and undo restores the previous checked state", () => {
    useEditorStore.getState().insertElement("section-1", createCheckboxNode());
    const checkboxId = useEditorStore.getState().selection.primaryId!;
    const findCheckbox = () => useEditorStore.getState().document.children?.find((c) => c.id === "section-1")?.children?.find((c) => c.id === checkboxId);
    const pastLengthAfterInsert = useEditorStore.getState().past.length;

    useEditorStore.getState().setElementChecked(checkboxId, true);
    expect(findCheckbox()?.checked).toBe(true);
    expect(useEditorStore.getState().past).toHaveLength(pastLengthAfterInsert + 1);

    useEditorStore.getState().setElementChecked(checkboxId, true);
    expect(useEditorStore.getState().past).toHaveLength(pastLengthAfterInsert + 1); // no-op, no new entry

    useEditorStore.getState().undo();
    expect(findCheckbox()?.checked).toBeUndefined();
  });

  it("Label can wrap a Checkbox, a Radio, and a Textarea — Label > Checkbox / Label > Radio / Form > Textarea", () => {
    useEditorStore.getState().insertElement("section-1", createFormNode());
    const formId = useEditorStore.getState().selection.primaryId!;

    useEditorStore.getState().insertElement(formId, createLabelNode());
    const checkboxLabelId = useEditorStore.getState().selection.primaryId!;
    useEditorStore.getState().insertElement(checkboxLabelId, createCheckboxNode());

    useEditorStore.getState().selectElement(formId);
    useEditorStore.getState().insertElement(formId, createLabelNode());
    const radioLabelId = useEditorStore.getState().selection.primaryId!;
    useEditorStore.getState().insertElement(radioLabelId, createRadioNode());

    useEditorStore.getState().selectElement(formId);
    useEditorStore.getState().insertElement(formId, createTextareaNode());

    const form = useEditorStore.getState().document.children?.find((c) => c.id === "section-1")?.children?.find((c) => c.id === formId);
    const checkboxLabel = form?.children?.find((c) => c.id === checkboxLabelId);
    const radioLabel = form?.children?.find((c) => c.id === radioLabelId);
    const textarea = form?.children?.find((c) => c.tag === "textarea");

    expect(checkboxLabel?.children?.[0]?.inputType).toBe("checkbox");
    expect(radioLabel?.children?.[0]?.inputType).toBe("radio");
    expect(textarea?.tag).toBe("textarea");
  });

  it("Checkbox and Textarea both reject insertion into a List — Checkpoint 1.6's UL/OL li-only rule remains intact", () => {
    useEditorStore.getState().insertElement("section-1", createUnorderedListNode());
    const listId = useEditorStore.getState().selection.primaryId!;
    const beforeDocument = useEditorStore.getState().document;

    useEditorStore.getState().insertElement(listId, createCheckboxNode());
    expect(useEditorStore.getState().document).toBe(beforeDocument);

    useEditorStore.getState().insertElement(listId, createTextareaNode());
    expect(useEditorStore.getState().document).toBe(beforeDocument);
  });

  it("switching Input Type across families (text -> checkbox -> radio -> email) preserves name/value and never destroys stored data", () => {
    useEditorStore.getState().insertElement("section-1", createInputNode());
    const inputId = useEditorStore.getState().selection.primaryId!;
    useEditorStore.getState().setElementName(inputId, "newsletter");
    useEditorStore.getState().setElementValue(inputId, "yes");
    useEditorStore.getState().setElementPlaceholder(inputId, "Email");

    const findInput = () => useEditorStore.getState().document.children?.find((c) => c.id === "section-1")?.children?.find((c) => c.id === inputId);

    useEditorStore.getState().setElementInputType(inputId, "checkbox");
    expect(findInput()?.name).toBe("newsletter");
    expect(findInput()?.value).toBe("yes");
    expect(findInput()?.placeholder).toBe("Email"); // preserved, though hidden in the Inspector for this type

    useEditorStore.getState().setElementChecked(inputId, true);
    useEditorStore.getState().setElementInputType(inputId, "radio");
    expect(findInput()?.checked).toBe(true); // preserved, though hidden in the Inspector for a fresh selection state
    expect(findInput()?.name).toBe("newsletter");

    useEditorStore.getState().setElementInputType(inputId, "email");
    expect(findInput()?.inputType).toBe("email");
    expect(findInput()?.name).toBe("newsletter");
    expect(findInput()?.value).toBe("yes");
    expect(findInput()?.placeholder).toBe("Email");
    expect(findInput()?.checked).toBe(true); // still stored, simply inert for a text-like type
  });

  it("duplicates a Form > Label > Checkbox / Label > Radio / Textarea structure recursively with fresh ids, preserving checked/inputType, and independent post-duplicate editing", () => {
    useEditorStore.getState().insertElement("section-1", createFormNode());
    const formId = useEditorStore.getState().selection.primaryId!;
    useEditorStore.getState().insertElement(formId, createLabelNode());
    const labelId = useEditorStore.getState().selection.primaryId!;
    useEditorStore.getState().insertElement(labelId, createCheckboxNode());
    const checkboxId = useEditorStore.getState().selection.primaryId!;
    useEditorStore.getState().setElementChecked(checkboxId, true);
    useEditorStore.getState().setElementName(checkboxId, "terms");

    useEditorStore.getState().selectElement(labelId);
    useEditorStore.getState().duplicateSelection();

    const form = useEditorStore.getState().document.children?.find((c) => c.id === "section-1")?.children?.find((c) => c.id === formId);
    const labels = form?.children?.filter((c) => c.tag === "label") ?? [];
    expect(labels).toHaveLength(2);
    const [original, duplicate] = labels;

    expect(duplicate.id).not.toBe(original.id);
    const duplicateCheckbox = duplicate.children?.[0];
    const originalCheckbox = original.children?.[0];
    expect(duplicateCheckbox?.id).not.toBe(originalCheckbox?.id);
    expect(duplicateCheckbox?.inputType).toBe("checkbox");
    expect(duplicateCheckbox?.checked).toBe(true);
    expect(duplicateCheckbox?.name).toBe("terms");

    // Editing the duplicate's checked state never touches the original.
    useEditorStore.getState().setElementChecked(duplicateCheckbox!.id, false);
    const refreshedOriginalCheckbox = useEditorStore
      .getState()
      .document.children?.find((c) => c.id === "section-1")
      ?.children?.find((c) => c.id === formId)
      ?.children?.find((c) => c.id === original.id)?.children?.[0];
    expect(refreshedOriginalCheckbox?.checked).toBe(true);
  });
});

describe("useEditorStore — Select + Option foundation (Checkpoint 1.13)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  function findSelect(selectId: string) {
    return useEditorStore.getState().document.children?.find((c) => c.id === "section-1")?.children?.find((c) => c.id === selectId);
  }

  it("setOptionCount pushes exactly one history entry per change, no entry on no-op, grows/shrinks the real child array, and undo restores the previous Options", () => {
    useEditorStore.getState().insertElement("section-1", createSelectNode());
    const selectId = useEditorStore.getState().selection.primaryId!;
    const pastLengthAfterInsert = useEditorStore.getState().past.length;

    useEditorStore.getState().setOptionCount(selectId, 5);
    expect(findSelect(selectId)?.children).toHaveLength(5);
    expect(useEditorStore.getState().past).toHaveLength(pastLengthAfterInsert + 1);

    useEditorStore.getState().setOptionCount(selectId, 5);
    expect(useEditorStore.getState().past).toHaveLength(pastLengthAfterInsert + 1); // no-op, no new entry

    useEditorStore.getState().setOptionCount(selectId, 2);
    expect(findSelect(selectId)?.children).toHaveLength(2);
    expect(useEditorStore.getState().past).toHaveLength(pastLengthAfterInsert + 2);

    useEditorStore.getState().undo();
    expect(findSelect(selectId)?.children).toHaveLength(5);
  });

  it("Label can wrap a Select without native activation opening it — Label > Select", () => {
    useEditorStore.getState().insertElement("section-1", createFormNode());
    const formId = useEditorStore.getState().selection.primaryId!;
    useEditorStore.getState().insertElement(formId, createLabelNode());
    const labelId = useEditorStore.getState().selection.primaryId!;
    useEditorStore.getState().insertElement(labelId, createSelectNode());

    const form = useEditorStore.getState().document.children?.find((c) => c.id === "section-1")?.children?.find((c) => c.id === formId);
    const label = form?.children?.find((c) => c.id === labelId);
    expect(label?.children?.[0]?.tag).toBe("select");
  });

  it("Select rejects insertion into a List — Checkpoint 1.6's UL/OL li-only rule remains intact", () => {
    useEditorStore.getState().insertElement("section-1", createUnorderedListNode());
    const listId = useEditorStore.getState().selection.primaryId!;
    const beforeDocument = useEditorStore.getState().document;

    useEditorStore.getState().insertElement(listId, createSelectNode());
    expect(useEditorStore.getState().document).toBe(beforeDocument);
  });

  it("duplicates a Select with a custom selected Option recursively with fresh ids, preserving text/value/selected, and independent post-duplicate editing", () => {
    useEditorStore.getState().insertElement("section-1", createSelectNode());
    const selectId = useEditorStore.getState().selection.primaryId!;
    const originalOptionIds = findSelect(selectId)!.children!.map((c) => c.id);
    useEditorStore.getState().setSelectSelectedOption(selectId, originalOptionIds[1]);

    useEditorStore.getState().selectElement(selectId);
    useEditorStore.getState().duplicateSelection();

    const selects = useEditorStore.getState().document.children?.find((c) => c.id === "section-1")?.children?.filter((c) => c.tag === "select") ?? [];
    expect(selects).toHaveLength(2);
    const [original, duplicate] = selects;

    expect(duplicate.id).not.toBe(original.id);
    expect(duplicate.children).toHaveLength(3);
    const duplicateIds = duplicate.children!.map((c) => c.id);
    expect(duplicateIds.some((id) => originalOptionIds.includes(id))).toBe(false);

    // The same RELATIVE Option (index 1) is preserved as selected in the
    // duplicate — no relational id mapping needed, since selected lives
    // directly on each Option node and cloneNodeWithFreshIds only changes
    // ids, never field values.
    expect(duplicate.children![1].selected).toBe(true);
    expect(duplicate.children![0].selected).toBeUndefined();
    expect(duplicate.children![2].selected).toBeUndefined();
    expect(duplicate.children!.map((c) => c.text)).toEqual(original.children!.map((c) => c.text));
    expect(duplicate.children!.map((c) => c.value)).toEqual(original.children!.map((c) => c.value));

    // Editing the duplicate's selection never touches the original.
    useEditorStore.getState().setSelectSelectedOption(duplicate.id, duplicate.children![0].id);
    const refreshedOriginal = findSelect(original.id);
    expect(refreshedOriginal?.children?.[1].selected).toBe(true);
  });

  it("Form > Select > Option coexists correctly — Select is insertable into Form like any other control", () => {
    useEditorStore.getState().insertElement("section-1", createFormNode());
    const formId = useEditorStore.getState().selection.primaryId!;
    useEditorStore.getState().insertElement(formId, createSelectNode());

    const form = useEditorStore.getState().document.children?.find((c) => c.id === "section-1")?.children?.find((c) => c.id === formId);
    const select = form?.children?.find((c) => c.tag === "select");
    expect(select?.children).toHaveLength(3);
    expect(select?.children?.every((c) => c.tag === "option")).toBe(true);
  });
});

describe("useEditorStore — Table foundation (Checkpoint 1.14)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  function findUnderSection(nodeId: string) {
    return useEditorStore.getState().document.children?.find((c) => c.id === "section-1")?.children?.find((c) => c.id === nodeId);
  }

  it("insertElement('table') produces the full starter structure in one history entry", () => {
    const pastLengthBefore = useEditorStore.getState().past.length;
    useEditorStore.getState().insertElement("section-1", createTableNode());
    const tableId = useEditorStore.getState().selection.primaryId!;

    expect(findUnderSection(tableId)?.children).toHaveLength(2);
    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore + 1);
  });

  it("setTableColumnCount pushes exactly one history entry per change, no entry on no-op, and undo restores the previous columns", () => {
    useEditorStore.getState().insertElement("section-1", createTableNode());
    const tableId = useEditorStore.getState().selection.primaryId!;
    const pastLengthAfterInsert = useEditorStore.getState().past.length;

    useEditorStore.getState().setTableColumnCount(tableId, 5);
    expect(findUnderSection(tableId)?.children?.[0].children?.[0].children).toHaveLength(5);
    expect(useEditorStore.getState().past).toHaveLength(pastLengthAfterInsert + 1);

    useEditorStore.getState().setTableColumnCount(tableId, 5);
    expect(useEditorStore.getState().past).toHaveLength(pastLengthAfterInsert + 1); // no-op

    useEditorStore.getState().undo();
    expect(findUnderSection(tableId)?.children?.[0].children?.[0].children).toHaveLength(3);
  });

  it("setTableBodyRowCount pushes history, no-op guarded, and undo restores the previous rows", () => {
    useEditorStore.getState().insertElement("section-1", createTableNode());
    const tableId = useEditorStore.getState().selection.primaryId!;
    const pastLengthAfterInsert = useEditorStore.getState().past.length;

    useEditorStore.getState().setTableBodyRowCount(tableId, 4);
    expect(findUnderSection(tableId)?.children?.find((c) => c.tag === "tbody")?.children).toHaveLength(4);
    expect(useEditorStore.getState().past).toHaveLength(pastLengthAfterInsert + 1);

    useEditorStore.getState().setTableBodyRowCount(tableId, 4);
    expect(useEditorStore.getState().past).toHaveLength(pastLengthAfterInsert + 1); // no-op

    useEditorStore.getState().undo();
    expect(findUnderSection(tableId)?.children?.find((c) => c.tag === "tbody")?.children).toHaveLength(2);
  });

  it("setTableHeaderEnabled toggles the thead subtree and is history/no-op guarded", () => {
    useEditorStore.getState().insertElement("section-1", createTableNode());
    const tableId = useEditorStore.getState().selection.primaryId!;
    const pastLengthAfterInsert = useEditorStore.getState().past.length;

    useEditorStore.getState().setTableHeaderEnabled(tableId, false);
    expect(findUnderSection(tableId)?.children?.some((c) => c.tag === "thead")).toBe(false);
    expect(useEditorStore.getState().past).toHaveLength(pastLengthAfterInsert + 1);

    useEditorStore.getState().setTableHeaderEnabled(tableId, false);
    expect(useEditorStore.getState().past).toHaveLength(pastLengthAfterInsert + 1); // no-op

    useEditorStore.getState().undo();
    expect(findUnderSection(tableId)?.children?.some((c) => c.tag === "thead")).toBe(true);
  });

  it("setTableFooterEnabled toggles the tfoot subtree and is history/no-op guarded", () => {
    useEditorStore.getState().insertElement("section-1", createTableNode());
    const tableId = useEditorStore.getState().selection.primaryId!;
    const pastLengthAfterInsert = useEditorStore.getState().past.length;

    useEditorStore.getState().setTableFooterEnabled(tableId, true);
    expect(findUnderSection(tableId)?.children?.some((c) => c.tag === "tfoot")).toBe(true);
    expect(useEditorStore.getState().past).toHaveLength(pastLengthAfterInsert + 1);

    useEditorStore.getState().setTableFooterEnabled(tableId, true);
    expect(useEditorStore.getState().past).toHaveLength(pastLengthAfterInsert + 1); // no-op

    useEditorStore.getState().undo();
    expect(findUnderSection(tableId)?.children?.some((c) => c.tag === "tfoot")).toBe(false);
  });

  it("Table rejects insertion into a List — Checkpoint 1.6's UL/OL li-only rule remains intact", () => {
    useEditorStore.getState().insertElement("section-1", createUnorderedListNode());
    const listId = useEditorStore.getState().selection.primaryId!;
    const beforeDocument = useEditorStore.getState().document;

    useEditorStore.getState().insertElement(listId, createTableNode());
    expect(useEditorStore.getState().document).toBe(beforeDocument);
  });

  it("Table rejects insertion into a Select — Checkpoint 1.13's select -> option allowlist remains intact", () => {
    useEditorStore.getState().insertElement("section-1", createSelectNode());
    const selectId = useEditorStore.getState().selection.primaryId!;
    const beforeDocument = useEditorStore.getState().document;

    useEditorStore.getState().insertElement(selectId, createTableNode());
    expect(useEditorStore.getState().document).toBe(beforeDocument);
  });

  it("moving a Data Cell from one Row to another is a valid move", () => {
    useEditorStore.getState().insertElement("section-1", createTableNode());
    const tableId = useEditorStore.getState().selection.primaryId!;
    const tbody = findUnderSection(tableId)!.children!.find((c) => c.tag === "tbody")!;
    const [firstRow, secondRow] = tbody.children!;
    const cellToMove = firstRow.children![0];

    useEditorStore.getState().moveElement(cellToMove.id, secondRow.children![0].id, "before");

    const refreshedTbody = findUnderSection(tableId)!.children!.find((c) => c.tag === "tbody")!;
    expect(refreshedTbody.children![0].children).toHaveLength(2);
    expect(refreshedTbody.children![1].children).toHaveLength(4);
    expect(refreshedTbody.children![1].children!.map((c) => c.id)).toContain(cellToMove.id);
  });

  it("moving a Row from Tbody to Thead is a valid move — both accept only Tr", () => {
    useEditorStore.getState().insertElement("section-1", createTableNode());
    const tableId = useEditorStore.getState().selection.primaryId!;
    const table = findUnderSection(tableId)!;
    const thead = table.children!.find((c) => c.tag === "thead")!;
    const tbody = table.children!.find((c) => c.tag === "tbody")!;
    const rowToMove = tbody.children![0];

    useEditorStore.getState().moveElement(rowToMove.id, thead.id, "inside");

    const refreshedThead = findUnderSection(tableId)!.children!.find((c) => c.tag === "thead")!;
    expect(refreshedThead.children!.some((r) => r.id === rowToMove.id)).toBe(true);
  });

  it("rejects moving a Data Cell directly into a Container — constrained-nesting is enforced through the centralized rule, not a Table-specific branch", () => {
    useEditorStore.getState().insertElement("section-1", createTableNode());
    const tableId = useEditorStore.getState().selection.primaryId!;
    useEditorStore.getState().insertElement("section-1", createContainerNode());
    const containerId = useEditorStore.getState().selection.primaryId!;
    const beforeDocument = useEditorStore.getState().document;

    const tbody = findUnderSection(tableId)!.children!.find((c) => c.tag === "tbody")!;
    const cellId = tbody.children![0].children![0].id;

    useEditorStore.getState().moveElement(cellId, containerId, "inside");
    expect(useEditorStore.getState().document).toBe(beforeDocument);
  });

  it("rejects moving an Option into a Table — every prior constrained-parent rule stays intact", () => {
    useEditorStore.getState().insertElement("section-1", createTableNode());
    const tableId = useEditorStore.getState().selection.primaryId!;
    useEditorStore.getState().insertElement("section-1", createSelectNode());
    const selectId = useEditorStore.getState().selection.primaryId!;
    const optionId = findUnderSection(selectId)!.children![0].id;
    const beforeDocument = useEditorStore.getState().document;

    useEditorStore.getState().moveElement(optionId, tableId, "inside");
    expect(useEditorStore.getState().document).toBe(beforeDocument);
  });

  it("duplicates a whole Table subtree recursively with fresh ids, preserving cell text, and independent post-duplicate editing", () => {
    useEditorStore.getState().insertElement("section-1", createTableNode());
    const tableId = useEditorStore.getState().selection.primaryId!;
    const original = findUnderSection(tableId)!;
    const originalIds = collectIds(original);

    useEditorStore.getState().selectElement(tableId);
    useEditorStore.getState().duplicateSelection();

    const tables = useEditorStore.getState().document.children?.find((c) => c.id === "section-1")?.children?.filter((c) => c.tag === "table") ?? [];
    expect(tables).toHaveLength(2);
    const [orig, duplicate] = tables;

    expect(duplicate.id).not.toBe(orig.id);
    const duplicateIds = collectIds(duplicate);
    expect(duplicateIds.some((id) => originalIds.includes(id))).toBe(false);

    expect(duplicate.children).toHaveLength(2);
    const dupHeadRow = duplicate.children!.find((c) => c.tag === "thead")!.children![0];
    const origHeadRow = orig.children!.find((c) => c.tag === "thead")!.children![0];
    expect(dupHeadRow.children!.map((c) => c.text)).toEqual(origHeadRow.children!.map((c) => c.text));

    // Editing the duplicate's cell text never touches the original.
    useEditorStore.getState().setElementText(dupHeadRow.children![0].id, "Renamed");
    const refreshedOrig = findUnderSection(orig.id);
    const refreshedOrigHeadRow = refreshedOrig!.children!.find((c) => c.tag === "thead")!.children![0];
    expect(refreshedOrigHeadRow.children![0].text).toBe("Heading 1");
  });

  it("Form > Table coexists correctly — Table is insertable into Form like any other control", () => {
    useEditorStore.getState().insertElement("section-1", createFormNode());
    const formId = useEditorStore.getState().selection.primaryId!;
    useEditorStore.getState().insertElement(formId, createTableNode());

    const form = findUnderSection(formId);
    const table = form?.children?.find((c) => c.tag === "table");
    expect(table?.children).toHaveLength(2);
  });
});

describe("useEditorStore — Video + Iframe foundation (Checkpoint 1.15)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  function findUnderSection(nodeId: string) {
    return useEditorStore.getState().document.children?.find((c) => c.id === "section-1")?.children?.find((c) => c.id === nodeId);
  }

  it("setElementSrc/setElementPoster/setElementControls/setElementAutoplay/setElementMuted/setElementLoop each push exactly one history entry, no entry on no-op, and undo restores the previous value", () => {
    useEditorStore.getState().insertElement("section-1", createVideoNode());
    const videoId = useEditorStore.getState().selection.primaryId!;

    const cases: [string, () => void, () => unknown][] = [
      ["setElementSrc", () => useEditorStore.getState().setElementSrc(videoId, "https://example.com/video.mp4"), () => findUnderSection(videoId)?.src],
      ["setElementPoster", () => useEditorStore.getState().setElementPoster(videoId, "https://example.com/poster.jpg"), () => findUnderSection(videoId)?.poster],
      ["setElementControls", () => useEditorStore.getState().setElementControls(videoId, false), () => findUnderSection(videoId)?.controls],
      ["setElementAutoplay", () => useEditorStore.getState().setElementAutoplay(videoId, true), () => findUnderSection(videoId)?.autoplay],
      ["setElementMuted", () => useEditorStore.getState().setElementMuted(videoId, true), () => findUnderSection(videoId)?.muted],
      ["setElementLoop", () => useEditorStore.getState().setElementLoop(videoId, true), () => findUnderSection(videoId)?.loop],
    ];

    for (const [, apply, read] of cases) {
      const pastLengthBefore = useEditorStore.getState().past.length;
      apply();
      expect(read()).not.toBeUndefined();
      expect(useEditorStore.getState().past.length).toBe(pastLengthBefore + 1);

      // no-op: applying the exact same value again pushes nothing
      apply();
      expect(useEditorStore.getState().past.length).toBe(pastLengthBefore + 1);

      useEditorStore.getState().undo();
      expect(read()).toBeUndefined();
      // redo to leave state consistent for the next case in this loop
      useEditorStore.getState().redo();
    }
  });

  it("setElementTitle pushes one history entry per change, no entry on no-op, and undo restores the previous title", () => {
    useEditorStore.getState().insertElement("section-1", createIframeNode());
    const iframeId = useEditorStore.getState().selection.primaryId!;
    const pastLengthAfterInsert = useEditorStore.getState().past.length;

    useEditorStore.getState().setElementTitle(iframeId, "Product tour");
    expect(findUnderSection(iframeId)?.title).toBe("Product tour");
    expect(useEditorStore.getState().past).toHaveLength(pastLengthAfterInsert + 1);

    useEditorStore.getState().setElementTitle(iframeId, "Product tour");
    expect(useEditorStore.getState().past).toHaveLength(pastLengthAfterInsert + 1); // no-op

    useEditorStore.getState().undo();
    expect(findUnderSection(iframeId)?.title).toBe("Embedded content");
  });

  it("setElementSrc is reused unchanged for Iframe — the same generic command Video uses", () => {
    useEditorStore.getState().insertElement("section-1", createIframeNode());
    const iframeId = useEditorStore.getState().selection.primaryId!;

    useEditorStore.getState().setElementSrc(iframeId, "https://example.com/embed");
    expect(findUnderSection(iframeId)?.src).toBe("https://example.com/embed");
  });

  it("Video/Iframe reject insertion into a List — Checkpoint 1.6's UL/OL li-only rule remains intact", () => {
    useEditorStore.getState().insertElement("section-1", createUnorderedListNode());
    const listId = useEditorStore.getState().selection.primaryId!;
    const beforeDocument = useEditorStore.getState().document;

    useEditorStore.getState().insertElement(listId, createVideoNode());
    expect(useEditorStore.getState().document).toBe(beforeDocument);

    useEditorStore.getState().insertElement(listId, createIframeNode());
    expect(useEditorStore.getState().document).toBe(beforeDocument);
  });

  it("duplicates a customized Video with fresh id, preserving every semantic field and CSS state, with independent post-duplicate editing", () => {
    useEditorStore.getState().insertElement("section-1", createVideoNode());
    const videoId = useEditorStore.getState().selection.primaryId!;
    useEditorStore.getState().setElementSrc(videoId, "https://example.com/video.mp4");
    useEditorStore.getState().setElementPoster(videoId, "https://example.com/poster.jpg");
    useEditorStore.getState().setElementControls(videoId, false);
    useEditorStore.getState().setElementAutoplay(videoId, true);
    useEditorStore.getState().setElementMuted(videoId, true);
    useEditorStore.getState().setElementLoop(videoId, true);
    useEditorStore.getState().setMediaFitSettings(videoId, { objectFit: "cover" });

    useEditorStore.getState().selectElement(videoId);
    useEditorStore.getState().duplicateSelection();

    const videos = useEditorStore.getState().document.children?.find((c) => c.id === "section-1")?.children?.filter((c) => c.tag === "video") ?? [];
    expect(videos).toHaveLength(2);
    const [original, duplicate] = videos;

    expect(duplicate.id).not.toBe(original.id);
    expect(duplicate.src).toBe("https://example.com/video.mp4");
    expect(duplicate.poster).toBe("https://example.com/poster.jpg");
    expect(duplicate.controls).toBe(false);
    expect(duplicate.autoplay).toBe(true);
    expect(duplicate.muted).toBe(true);
    expect(duplicate.loop).toBe(true);
    expect(duplicate.mediaFit).toEqual({ objectFit: "cover" });

    // Editing the duplicate never touches the original.
    useEditorStore.getState().setElementSrc(duplicate.id, "https://example.com/other.mp4");
    const refreshedOriginal = findUnderSection(original.id);
    expect(refreshedOriginal?.src).toBe("https://example.com/video.mp4");
  });

  it("duplicates a customized Iframe with fresh id, preserving src/title and CSS state, with independent post-duplicate editing", () => {
    useEditorStore.getState().insertElement("section-1", createIframeNode());
    const iframeId = useEditorStore.getState().selection.primaryId!;
    useEditorStore.getState().setElementSrc(iframeId, "https://example.com/embed");
    useEditorStore.getState().setElementTitle(iframeId, "Product tour");

    useEditorStore.getState().selectElement(iframeId);
    useEditorStore.getState().duplicateSelection();

    const iframes = useEditorStore.getState().document.children?.find((c) => c.id === "section-1")?.children?.filter((c) => c.tag === "iframe") ?? [];
    expect(iframes).toHaveLength(2);
    const [original, duplicate] = iframes;

    expect(duplicate.id).not.toBe(original.id);
    expect(duplicate.src).toBe("https://example.com/embed");
    expect(duplicate.title).toBe("Product tour");

    useEditorStore.getState().setElementTitle(duplicate.id, "Renamed");
    const refreshedOriginal = findUnderSection(original.id);
    expect(refreshedOriginal?.title).toBe("Product tour");
  });

  it("Checkpoint 1.15.6.12.3 — insertElement(createAudioNode()) pushes exactly one history entry", () => {
    const pastLengthBefore = useEditorStore.getState().past.length;
    useEditorStore.getState().insertElement("section-1", createAudioNode());
    expect(useEditorStore.getState().past.length).toBe(pastLengthBefore + 1);
    expect(useEditorStore.getState().selection.primaryId).not.toBeNull();
  });

  it("Checkpoint 1.15.6.12.3 — setElementSrc/setElementControls/setElementAutoplay/setElementMuted/setElementLoop are reused unchanged for Audio — the exact same generic commands Video uses, no audioSrc/audioControls/etc.", () => {
    useEditorStore.getState().insertElement("section-1", createAudioNode());
    const audioId = useEditorStore.getState().selection.primaryId!;

    const cases: [() => void, () => unknown][] = [
      [() => useEditorStore.getState().setElementSrc(audioId, "https://example.com/audio.mp3"), () => findUnderSection(audioId)?.src],
      [() => useEditorStore.getState().setElementControls(audioId, false), () => findUnderSection(audioId)?.controls],
      [() => useEditorStore.getState().setElementAutoplay(audioId, true), () => findUnderSection(audioId)?.autoplay],
      [() => useEditorStore.getState().setElementMuted(audioId, true), () => findUnderSection(audioId)?.muted],
      [() => useEditorStore.getState().setElementLoop(audioId, true), () => findUnderSection(audioId)?.loop],
    ];

    for (const [apply, read] of cases) {
      const pastLengthBefore = useEditorStore.getState().past.length;
      apply();
      expect(read()).not.toBeUndefined();
      expect(useEditorStore.getState().past.length).toBe(pastLengthBefore + 1);

      // no-op: applying the exact same value again pushes nothing
      apply();
      expect(useEditorStore.getState().past.length).toBe(pastLengthBefore + 1);
    }
  });

  it("Checkpoint 1.15.6.12.3 — Audio rejects insertion into a List, same as Video/Iframe", () => {
    useEditorStore.getState().insertElement("section-1", createUnorderedListNode());
    const listId = useEditorStore.getState().selection.primaryId!;
    const beforeDocument = useEditorStore.getState().document;

    useEditorStore.getState().insertElement(listId, createAudioNode());
    expect(useEditorStore.getState().document).toBe(beforeDocument);
  });

  it("Checkpoint 1.15.6.12.3 — duplicates a customized Audio with fresh id, preserving every semantic field and CSS state, with independent post-duplicate editing", () => {
    useEditorStore.getState().insertElement("section-1", createAudioNode());
    const audioId = useEditorStore.getState().selection.primaryId!;
    useEditorStore.getState().setElementSrc(audioId, "https://example.com/audio.mp3");
    useEditorStore.getState().setElementControls(audioId, false);
    useEditorStore.getState().setElementAutoplay(audioId, true);
    useEditorStore.getState().setElementMuted(audioId, true);
    useEditorStore.getState().setElementLoop(audioId, true);

    useEditorStore.getState().selectElement(audioId);
    useEditorStore.getState().duplicateSelection();

    const audios = useEditorStore.getState().document.children?.find((c) => c.id === "section-1")?.children?.filter((c) => c.tag === "audio") ?? [];
    expect(audios).toHaveLength(2);
    const [original, duplicate] = audios;

    expect(duplicate.id).not.toBe(original.id);
    expect(duplicate.src).toBe("https://example.com/audio.mp3");
    expect(duplicate.controls).toBe(false);
    expect(duplicate.autoplay).toBe(true);
    expect(duplicate.muted).toBe(true);
    expect(duplicate.loop).toBe(true);

    useEditorStore.getState().setElementSrc(duplicate.id, "https://example.com/other.mp3");
    const refreshedOriginal = findUnderSection(original.id);
    expect(refreshedOriginal?.src).toBe("https://example.com/audio.mp3");
  });

  it("Checkpoint 1.15.6.12.4 — insertElement(createProgressNode()) pushes exactly one history entry", () => {
    const pastLengthBefore = useEditorStore.getState().past.length;
    useEditorStore.getState().insertElement("section-1", createProgressNode());
    expect(useEditorStore.getState().past.length).toBe(pastLengthBefore + 1);
    expect(useEditorStore.getState().selection.primaryId).not.toBeNull();
  });

  it("Checkpoint 1.15.6.12.4 — setElementProgressValue/setElementProgressMax/setElementProgressIndeterminate each push exactly one history entry, no entry on no-op, and undo restores the previous value", () => {
    useEditorStore.getState().insertElement("section-1", createProgressNode());
    const progressId = useEditorStore.getState().selection.primaryId!;

    const valueBefore = useEditorStore.getState().past.length;
    useEditorStore.getState().setElementProgressValue(progressId, 75);
    expect(findUnderSection(progressId)?.progressValue).toBe(75);
    expect(useEditorStore.getState().past.length).toBe(valueBefore + 1);
    useEditorStore.getState().setElementProgressValue(progressId, 75); // no-op
    expect(useEditorStore.getState().past.length).toBe(valueBefore + 1);
    useEditorStore.getState().undo();
    expect(findUnderSection(progressId)?.progressValue).toBe(50);
    useEditorStore.getState().redo();

    const maxBefore = useEditorStore.getState().past.length;
    useEditorStore.getState().setElementProgressMax(progressId, 200);
    expect(findUnderSection(progressId)?.progressMax).toBe(200);
    expect(useEditorStore.getState().past.length).toBe(maxBefore + 1);
    useEditorStore.getState().setElementProgressMax(progressId, 200); // no-op
    expect(useEditorStore.getState().past.length).toBe(maxBefore + 1);
    useEditorStore.getState().undo();
    expect(findUnderSection(progressId)?.progressMax).toBe(100);
    useEditorStore.getState().redo();

    const indeterminateBefore = useEditorStore.getState().past.length;
    useEditorStore.getState().setElementProgressIndeterminate(progressId, true);
    expect(findUnderSection(progressId)?.progressValue).toBeUndefined();
    expect(useEditorStore.getState().past.length).toBe(indeterminateBefore + 1);
    useEditorStore.getState().setElementProgressIndeterminate(progressId, true); // no-op
    expect(useEditorStore.getState().past.length).toBe(indeterminateBefore + 1);
    useEditorStore.getState().undo();
    expect(findUnderSection(progressId)?.progressValue).toBe(75);
  });

  it("Checkpoint 1.15.6.12.4 — shrinking Max below the current Value is ONE atomic history step, restored atomically on undo", () => {
    useEditorStore.getState().insertElement("section-1", createProgressNode()); // 50/100
    const progressId = useEditorStore.getState().selection.primaryId!;
    useEditorStore.getState().setElementProgressValue(progressId, 80);

    const before = useEditorStore.getState().past.length;
    useEditorStore.getState().setElementProgressMax(progressId, 50);
    expect(findUnderSection(progressId)?.progressMax).toBe(50);
    expect(findUnderSection(progressId)?.progressValue).toBe(50);
    expect(useEditorStore.getState().past.length).toBe(before + 1);

    useEditorStore.getState().undo();
    expect(findUnderSection(progressId)?.progressMax).toBe(100);
    expect(findUnderSection(progressId)?.progressValue).toBe(80);
  });

  it("Checkpoint 1.15.6.12.4 — Progress rejects insertion into a List, same as Video/Iframe/Audio", () => {
    useEditorStore.getState().insertElement("section-1", createUnorderedListNode());
    const listId = useEditorStore.getState().selection.primaryId!;
    const beforeDocument = useEditorStore.getState().document;

    useEditorStore.getState().insertElement(listId, createProgressNode());
    expect(useEditorStore.getState().document).toBe(beforeDocument);
  });

  it("Checkpoint 1.15.6.12.4 — duplicates a customized determinate Progress with fresh id, preserving Value/Max and CSS state, with independent post-duplicate editing", () => {
    useEditorStore.getState().insertElement("section-1", createProgressNode());
    const progressId = useEditorStore.getState().selection.primaryId!;
    useEditorStore.getState().setElementProgressValue(progressId, 75);
    useEditorStore.getState().setElementProgressMax(progressId, 150);

    useEditorStore.getState().selectElement(progressId);
    useEditorStore.getState().duplicateSelection();

    const progresses = useEditorStore.getState().document.children?.find((c) => c.id === "section-1")?.children?.filter((c) => c.tag === "progress") ?? [];
    expect(progresses).toHaveLength(2);
    const [original, duplicate] = progresses;

    expect(duplicate.id).not.toBe(original.id);
    expect(duplicate.progressValue).toBe(75);
    expect(duplicate.progressMax).toBe(150);

    useEditorStore.getState().setElementProgressValue(duplicate.id, 10);
    const refreshedOriginal = findUnderSection(original.id);
    expect(refreshedOriginal?.progressValue).toBe(75);
  });

  it("Checkpoint 1.15.6.12.4 — duplicates an indeterminate Progress with fresh id, preserving the indeterminate state", () => {
    useEditorStore.getState().insertElement("section-1", createProgressNode());
    const progressId = useEditorStore.getState().selection.primaryId!;
    useEditorStore.getState().setElementProgressIndeterminate(progressId, true);

    useEditorStore.getState().selectElement(progressId);
    useEditorStore.getState().duplicateSelection();

    const progresses = useEditorStore.getState().document.children?.find((c) => c.id === "section-1")?.children?.filter((c) => c.tag === "progress") ?? [];
    expect(progresses).toHaveLength(2);
    const [, duplicate] = progresses;
    expect(duplicate.progressValue).toBeUndefined();
  });

  it("Form > Video and Form > Iframe coexist correctly — both insertable into Form like any other control", () => {
    useEditorStore.getState().insertElement("section-1", createFormNode());
    const formId = useEditorStore.getState().selection.primaryId!;
    useEditorStore.getState().insertElement(formId, createVideoNode());
    useEditorStore.getState().insertElement(formId, createIframeNode());

    const form = findUnderSection(formId);
    expect(form?.children?.some((c) => c.tag === "video")).toBe(true);
    expect(form?.children?.some((c) => c.tag === "iframe")).toBe(true);
  });
});

describe("useEditorStore — HTML Identity foundation (Checkpoint 1.15.1)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  function findSection() {
    return useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
  }

  it("setElementHtmlId/setElementClassName each push exactly one history entry, no entry on no-op, and undo restores the previous value", () => {
    const cases: [string, () => void, () => unknown][] = [
      ["setElementHtmlId", () => useEditorStore.getState().setElementHtmlId("section-1", "hero"), () => findSection()?.htmlId],
      ["setElementClassName", () => useEditorStore.getState().setElementClassName("section-1", "hero-section featured"), () => findSection()?.className],
    ];

    for (const [, apply, read] of cases) {
      const pastLengthBefore = useEditorStore.getState().past.length;
      apply();
      expect(read()).not.toBeUndefined();
      expect(useEditorStore.getState().past.length).toBe(pastLengthBefore + 1);

      // no-op: applying the exact same value again pushes nothing
      apply();
      expect(useEditorStore.getState().past.length).toBe(pastLengthBefore + 1);

      useEditorStore.getState().undo();
      expect(read()).toBeUndefined();
      useEditorStore.getState().redo();
    }
  });

  it("duplicates a customized node with fresh id, preserving htmlId/className, with independent post-duplicate editing", () => {
    useEditorStore.getState().setElementHtmlId("section-1", "hero");
    useEditorStore.getState().setElementClassName("section-1", "hero-section featured");

    const sectionsBefore = useEditorStore.getState().document.children?.filter((c) => c.tag === "section") ?? [];

    useEditorStore.getState().selectElement("section-1");
    useEditorStore.getState().duplicateSelection();

    const sections = useEditorStore.getState().document.children?.filter((c) => c.tag === "section") ?? [];
    expect(sections).toHaveLength(sectionsBefore.length + 1);
    const original = sections.find((c) => c.id === "section-1")!;
    const duplicate = sections.find((c) => c.id !== "section-1" && !sectionsBefore.some((s) => s.id === c.id))!;

    expect(duplicate.id).not.toBe(original.id);
    expect(duplicate.htmlId).toBe("hero");
    expect(duplicate.className).toBe("hero-section featured");

    useEditorStore.getState().setElementHtmlId(duplicate.id, "hero-2");
    const refreshedOriginal = useEditorStore.getState().document.children?.find((c) => c.id === original.id);
    expect(refreshedOriginal?.htmlId).toBe("hero");
  });
});

function collectIds(node: { id: string; children?: { id: string; children?: unknown }[] }): string[] {
  return [node.id, ...(node.children ?? []).flatMap((child) => collectIds(child as never))];
}

describe("useEditorStore — generic transactions (Checkpoint 4.3.1)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("setElementBackgroundLive does not push history", () => {
    const pastLengthBefore = useEditorStore.getState().past.length;
    useEditorStore.getState().setElementBackgroundLive("section-1", { color: "#3366ff" });

    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore);
    const node = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(node?.background).toEqual({ color: "#3366ff" });
  });

  it("collapses an entire drag (multiple live writes between begin/commitTransaction) into one history entry", () => {
    useEditorStore.getState().beginTransaction();
    useEditorStore.getState().setElementBackgroundLive("section-1", { color: "#111111" });
    useEditorStore.getState().setElementBackgroundLive("section-1", { color: "#222222" });
    useEditorStore.getState().setElementBackgroundLive("section-1", { color: "#333333" });
    useEditorStore.getState().commitTransaction();

    const node = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(node?.background).toEqual({ color: "#333333" });
    expect(useEditorStore.getState().past).toHaveLength(1);

    useEditorStore.getState().undo();
    const reverted = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(reverted?.background).toBeUndefined();
  });

  it("cancelTransaction discards the transaction without pushing history", () => {
    useEditorStore.getState().beginTransaction();
    useEditorStore.getState().setElementBackgroundLive("section-1", { color: "#111111" });

    useEditorStore.getState().cancelTransaction();

    expect(useEditorStore.getState().past).toHaveLength(0);
    expect(useEditorStore.getState().transactionSnapshot).toBeNull();
  });

  it("setElementBoxShadowLive does not push history", () => {
    const pastLengthBefore = useEditorStore.getState().past.length;
    useEditorStore.getState().setElementBoxShadowLive("section-1", [{ id: "shadow-1", enabled: true, inset: false }]);

    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore);
    const node = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(node?.boxShadow).toEqual([{ id: "shadow-1", enabled: true, inset: false }]);
  });

  it("collapses an entire shadow-layer drag reorder (multiple live writes between begin/commitTransaction) into one history entry", () => {
    const a = { id: "shadow-a", enabled: true, inset: false };
    const b = { id: "shadow-b", enabled: true, inset: false };

    useEditorStore.getState().beginTransaction();
    useEditorStore.getState().setElementBoxShadowLive("section-1", [a, b]);
    useEditorStore.getState().setElementBoxShadowLive("section-1", [b, a]);
    useEditorStore.getState().commitTransaction();

    const node = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(node?.boxShadow).toEqual([b, a]);
    expect(useEditorStore.getState().past).toHaveLength(1);

    useEditorStore.getState().undo();
    const reverted = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(reverted?.boxShadow).toBeUndefined();
  });

  // Checkpoint 1.15.6.1.1 — the three "Live" setters the new Gap/Opacity
  // Inspector sliders drive, mirroring setElementBoxShadowLive's own
  // no-history / one-history-entry-per-whole-drag shape exactly.
  it("setElementFiltersLive does not push history", () => {
    const pastLengthBefore = useEditorStore.getState().past.length;
    useEditorStore.getState().setElementFiltersLive("section-1", { opacity: 40 });

    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore);
    const node = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(node?.filters?.opacity).toBe(40);
  });

  it("collapses an entire Opacity slider drag (multiple live writes between begin/commitTransaction) into one history entry", () => {
    useEditorStore.getState().beginTransaction();
    useEditorStore.getState().setElementFiltersLive("section-1", { opacity: 70 });
    useEditorStore.getState().setElementFiltersLive("section-1", { opacity: 55 });
    useEditorStore.getState().commitTransaction();

    const node = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(node?.filters?.opacity).toBe(55);
    expect(useEditorStore.getState().past).toHaveLength(1);
  });

  it("setFlexContainerSettingsLive does not push history", () => {
    const flex = { direction: "row" as const, wrap: "nowrap" as const, justifyContent: "start" as const, alignItems: "stretch" as const, rowGap: 24, columnGap: 24 };
    const pastLengthBefore = useEditorStore.getState().past.length;
    useEditorStore.getState().setFlexContainerSettingsLive("section-1", flex);

    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore);
    const node = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(node?.flowLayout?.flex).toEqual(flex);
  });

  it("setGridContainerSettingsLive does not push history", () => {
    const grid = { columns: 2 as const, rows: "auto" as const, rowGap: 32, columnGap: 32 };
    const pastLengthBefore = useEditorStore.getState().past.length;
    useEditorStore.getState().setGridContainerSettingsLive("section-1", grid);

    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore);
    const node = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(node?.flowLayout?.grid).toEqual(grid);
  });

  it("shares the same transactionSnapshot slot as resize transactions (mutually exclusive, not a second parallel mechanism)", () => {
    useEditorStore.getState().beginTransaction();
    const viaGeneric = useEditorStore.getState().transactionSnapshot;

    useEditorStore.getState().cancelTransaction();
    useEditorStore.getState().beginResizeTransaction();
    const viaResize = useEditorStore.getState().transactionSnapshot;

    expect(viaGeneric).not.toBeNull();
    expect(viaResize).not.toBeNull();
    useEditorStore.getState().cancelResizeTransaction();
  });
});
