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

  it("falls back to the document root when no target is requested and nothing is selected", () => {
    const { result } = renderHook(() => useInsertElement());

    result.current("container");

    const state = useEditorStore.getState();
    expect(state.document.children?.at(-1)?.tag).toBe("div");
  });

  it("targets the current selection when no explicit drop target is requested and the selection can contain children", () => {
    useEditorStore.setState({ selectedElementId: "section-1" });
    const { result } = renderHook(() => useInsertElement());

    result.current("button");

    const section = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-1");
    expect(section?.children?.at(-1)?.tag).toBe("button");
  });

  it("targets the current selection's parent when no explicit drop target is requested and the selection is a leaf", () => {
    useEditorStore.setState({ selectedElementId: "image-1" });
    const { result } = renderHook(() => useInsertElement());

    result.current("image");

    const section = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-2");
    expect(section?.children?.at(-1)?.tag).toBe("img");
    expect(section?.children).toHaveLength(2);
  });

  it("falls back to the document root when no explicit drop target is requested and the selected node no longer exists", () => {
    useEditorStore.setState({ selectedElementId: "does-not-exist" });
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

  it("inserts before the target as a sibling when zone is 'before'", () => {
    const { result } = renderHook(() => useInsertElement());

    result.current("heading", "heading-1", "before");

    const section = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-1");
    expect(section?.children?.map((child) => child.tag)).toEqual([
      "h1",
      "h1",
      "p",
      "button",
    ]);
  });

  it("inserts after the target as a sibling when zone is 'after'", () => {
    const { result } = renderHook(() => useInsertElement());

    result.current("paragraph", "heading-1", "after");

    const section = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-1");
    expect(section?.children?.map((child) => child.id)).toEqual([
      "heading-1",
      expect.stringMatching(/^p-/),
      "paragraph-1",
      "button-1",
    ]);
  });

  it("treats zone 'inside' the same as the default append behavior", () => {
    const { result } = renderHook(() => useInsertElement());

    result.current("button", "section-1", "inside");

    const section = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-1");
    expect(section?.children?.at(-1)?.tag).toBe("button");
  });

  it("inserts a Container into a Section (Checkpoint 1.2 — both tags accept the same insertable types via the shared containment rule)", () => {
    const { result } = renderHook(() => useInsertElement());

    result.current("container", "section-1");

    const section = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-1");
    expect(section?.children?.at(-1)?.tag).toBe("div");
  });

  it("inserts a Section into a Container", () => {
    // Two separate renderHook calls, not one reused across both inserts —
    // the hook closes over the store snapshot from its own render, so a
    // second insert needs a fresh render to see the first insert's result
    // (the store itself, read directly below, is always current).
    const { result: insertContainer } = renderHook(() => useInsertElement());
    insertContainer.current("container");
    const newContainerId = useEditorStore.getState().document.children?.at(-1)?.id;

    const { result: insertSection } = renderHook(() => useInsertElement());
    insertSection.current("section", newContainerId);

    const container = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === newContainerId);
    expect(container?.children?.at(-1)?.tag).toBe("section");
  });

  it("falls back to the default container when a before/after target is the document root", () => {
    const { result } = renderHook(() => useInsertElement());

    result.current("button", "page-root", "before");

    const state = useEditorStore.getState();
    expect(state.document.children?.at(-1)?.tag).toBe("button");
  });
});

describe("useInsertElement — Free destinations (Checkpoint 3.4.4)", () => {
  const initialState = useEditorStore.getState();

  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  function makeSection1Free() {
    useEditorStore.getState().convertToFreeLayout("section-1", {
      "heading-1": { x: 16, y: 16, width: 240, height: 48 },
      "paragraph-1": { x: 16, y: 80, width: 240, height: 80 },
      "button-1": { x: 16, y: 176, width: 120, height: 40 },
    });
    // Give the container a large enough size that a non-overlapping grid
    // slot genuinely exists for a default-sized new element — approximateFreeContainerSize
    // falls back to a generous 400x300 otherwise, too tight for this test.
    useEditorStore
      .getState()
      .resizeElement("section-1", { preferredWidth: 900, preferredHeight: 700, offsetX: 0, offsetY: 0 });
  }

  it("assigns a deterministic freeLayout when inserting into a Free container", () => {
    makeSection1Free();
    const { result } = renderHook(() => useInsertElement());

    result.current("image", "section-1");

    const section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    const inserted = section?.children?.at(-1);
    expect(inserted?.tag).toBe("img");
    expect(inserted?.freeLayout).toBeDefined();
  });

  it("never overlaps an existing Free sibling when inserting", () => {
    makeSection1Free();
    const { result } = renderHook(() => useInsertElement());

    result.current("image", "section-1");

    const section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    const inserted = section!.children!.at(-1)!;
    for (const sibling of section!.children!.slice(0, -1)) {
      const a = inserted.freeLayout!;
      const b = sibling.freeLayout!;
      const overlaps = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
      expect(overlaps).toBe(false);
    }
  });

  it("leaves freeLayout unset when inserting into a Flow container", () => {
    const { result } = renderHook(() => useInsertElement());

    result.current("image", "section-1");

    const section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(section?.children?.at(-1)?.freeLayout).toBeUndefined();
  });
});
