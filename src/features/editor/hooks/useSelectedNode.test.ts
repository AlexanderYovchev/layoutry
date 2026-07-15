import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
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
    useEditorStore.setState({ selectedElementId: "heading-1" });

    const { result } = renderHook(() => useSelectedNode());

    expect(result.current?.node.id).toBe("heading-1");
    expect(result.current?.parentId).toBe("section-1");
  });

  it("fails safely to null when the selected id no longer resolves", () => {
    useEditorStore.setState({ selectedElementId: "does-not-exist" });

    const { result } = renderHook(() => useSelectedNode());

    expect(result.current).toBeNull();
  });
});
