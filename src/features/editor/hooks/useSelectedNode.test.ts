import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { selectionFromSingle } from "@/features/editor/types/selection";
import { useSelectedNode } from "./useSelectedNode";

const initialState = useEditorStore.getState();

describe("useSelectedNode", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("returns null when nothing is selected", () => {
    const { result } = renderHook(() => useSelectedNode());
    expect(result.current).toBeNull();
  });

  it("resolves the selected node along with its parent id", () => {
    useEditorStore.setState({ selection: selectionFromSingle("heading-1") });

    const { result } = renderHook(() => useSelectedNode());

    expect(result.current?.node.id).toBe("heading-1");
    expect(result.current?.parentId).toBe("section-1");
  });

  it("defaults parentLayoutMode to 'flow' when the parent has no layoutMode set", () => {
    useEditorStore.setState({ selection: selectionFromSingle("heading-1") });

    const { result } = renderHook(() => useSelectedNode());

    expect(result.current?.parentLayoutMode).toBe("flow");
  });

  it("resolves parentLayoutMode to 'free' when the parent is a Free container (Checkpoint 3.4.4)", () => {
    useEditorStore.getState().convertToFreeLayout("section-1", {
      "heading-1": { x: 16, y: 16, width: 240, height: 48 },
    });
    useEditorStore.setState({ selection: selectionFromSingle("heading-1") });

    const { result } = renderHook(() => useSelectedNode());

    expect(result.current?.parentLayoutMode).toBe("free");
  });

  it("defaults parentLayoutMode to 'flow' for the document root (no parent at all)", () => {
    useEditorStore.setState({ selection: selectionFromSingle("section-1") });

    const { result } = renderHook(() => useSelectedNode());

    expect(result.current?.parentId).toBe("page-root");
    expect(result.current?.parentLayoutMode).toBe("flow");
  });

  it("defaults parentFlowDisplay to 'block' when the parent has no flowLayout set", () => {
    useEditorStore.setState({ selection: selectionFromSingle("heading-1") });

    const { result } = renderHook(() => useSelectedNode());

    expect(result.current?.parentFlowDisplay).toBe("block");
  });

  it("resolves parentFlowDisplay to 'flex' when the parent's flowLayout.display is flex (Checkpoint 3.5)", () => {
    useEditorStore.getState().setFlowDisplayMode("section-1", "flex");
    useEditorStore.setState({ selection: selectionFromSingle("heading-1") });

    const { result } = renderHook(() => useSelectedNode());

    expect(result.current?.parentFlowDisplay).toBe("flex");
  });

  it("defaults parentFlowDisplay to 'block' for the document root (no parent at all)", () => {
    useEditorStore.setState({ selection: selectionFromSingle("section-1") });

    const { result } = renderHook(() => useSelectedNode());

    expect(result.current?.parentFlowDisplay).toBe("block");
  });

  it("fails safely to null when the selected id no longer resolves", () => {
    useEditorStore.setState({ selection: selectionFromSingle("does-not-exist") });

    const { result } = renderHook(() => useSelectedNode());

    expect(result.current).toBeNull();
  });
});
