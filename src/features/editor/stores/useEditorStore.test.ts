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
});
