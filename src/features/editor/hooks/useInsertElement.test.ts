import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { useInsertElement } from "./useInsertElement";

const initialState = useEditorStore.getState();

describe("useInsertElement", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("inserts into the requested target when it can accept children", () => {
    const { result } = renderHook(() => useInsertElement());

    result.current("button", "section-1");

    const section = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-1");
    expect(section?.children?.at(-1)?.tag).toBe("button");
  });

  it("selects the newly inserted node", () => {
    const { result } = renderHook(() => useInsertElement());

    result.current("heading", "section-1");

    const state = useEditorStore.getState();
    const inserted = state.document.children
      ?.find((child) => child.id === "section-1")
      ?.children?.at(-1);
    expect(state.selectedElementId).toBe(inserted?.id);
  });

  it("falls back to the document root when no target is requested", () => {
    const { result } = renderHook(() => useInsertElement());

    result.current("container");

    const state = useEditorStore.getState();
    expect(state.document.children?.at(-1)?.tag).toBe("div");
  });

  it("falls back to the document root when the requested target cannot accept children", () => {
    const { result } = renderHook(() => useInsertElement());

    result.current("button", "heading-1");

    const state = useEditorStore.getState();
    expect(state.document.children?.at(-1)?.tag).toBe("button");
  });

  it("falls back to the document root when the requested target does not exist", () => {
    const { result } = renderHook(() => useInsertElement());

    result.current("paragraph", "does-not-exist");

    const state = useEditorStore.getState();
    expect(state.document.children?.at(-1)?.tag).toBe("p");
  });
});
