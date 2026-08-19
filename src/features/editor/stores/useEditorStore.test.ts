import { afterEach, describe, expect, it } from "vitest";
import { createLinkNode } from "@/features/editor/factories/elementFactories";
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

    const pastedId = useEditorStore.getState().selectedElementId;
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

    const duplicateId = useEditorStore.getState().selectedElementId;
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

    const pastedId = useEditorStore.getState().selectedElementId;
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

  it("setElementHref pushes exactly one history entry per commit and is undoable/redoable (Checkpoint 1.4)", () => {
    useEditorStore.getState().insertElement("section-1", createLinkNode());
    const linkId = useEditorStore.getState().selectedElementId!;
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
