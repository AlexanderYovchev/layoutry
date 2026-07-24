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
      .resizeElement("section-1", { width: 320, height: 180, offsetX: 0, offsetY: 0 });

    const section = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-1");
    expect(section?.dimensions).toEqual({ width: 320, height: 180, offsetX: 0, offsetY: 0 });
    expect(useEditorStore.getState().selectedElementId).toBe("section-1");
  });

  it("does not alter the document when resizing an unsupported element type", () => {
    const before = useEditorStore.getState().document;

    useEditorStore
      .getState()
      .resizeElement("heading-1", { width: 320, height: 180, offsetX: 0, offsetY: 0 });

    expect(useEditorStore.getState().document).toBe(before);
  });
});
