import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { useMoveElement } from "./useMoveElement";

const initialState = useEditorStore.getState();

describe("useMoveElement", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("moves a node into a different container", () => {
    const { result } = renderHook(() => useMoveElement());

    result.current("button-1", "section-2", "inside");

    const state = useEditorStore.getState();
    const targetSection = state.document.children?.find((child) => child.id === "section-2");
    expect(targetSection?.children?.map((child) => child.id)).toEqual(["image-1", "button-1"]);
    expect(state.selectedElementId).toBe("button-1");
  });

  it("reorders within the same parent", () => {
    const { result } = renderHook(() => useMoveElement());

    result.current("button-1", "heading-1", "before");

    const state = useEditorStore.getState();
    const section = state.document.children?.find((child) => child.id === "section-1");
    expect(section?.children?.map((child) => child.id)).toEqual([
      "button-1",
      "heading-1",
      "paragraph-1",
    ]);
  });

  it("does not call the store action for an invalid move (self-descendant)", () => {
    const { result } = renderHook(() => useMoveElement());
    const before = useEditorStore.getState().document;

    result.current("section-1", "heading-1", "inside");

    expect(useEditorStore.getState().document).toBe(before);
  });

  it("does not call the store action for a rejected root move", () => {
    const { result } = renderHook(() => useMoveElement());
    const before = useEditorStore.getState().document;

    result.current("page-root", "section-2", "inside");

    expect(useEditorStore.getState().document).toBe(before);
  });
});
