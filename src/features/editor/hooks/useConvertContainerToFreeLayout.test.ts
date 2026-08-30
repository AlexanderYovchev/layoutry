import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { useConvertContainerToFreeLayout } from "./useConvertContainerToFreeLayout";
import { DEFAULT_RESIZE_CONSTRAINTS } from "@/features/editor/types/resize";

const initialState = useEditorStore.getState();

function stubRect(el: Element, box: { left: number; top: number; right: number; bottom: number }) {
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
    ...box,
    width: box.right - box.left,
    height: box.bottom - box.top,
    x: box.left,
    y: box.top,
    toJSON: () => box,
  });
}

describe("useConvertContainerToFreeLayout", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
    document.body.innerHTML = "";
  });

  it("measures each direct child's rect and converts it to container-content-relative geometry", () => {
    const container = document.createElement("div");
    container.setAttribute("data-node-id", "section-1");
    container.style.paddingLeft = "16px";
    container.style.paddingTop = "16px";
    const heading = document.createElement("h1");
    heading.setAttribute("data-node-id", "heading-1");
    container.appendChild(heading);
    document.body.appendChild(container);

    stubRect(container, { left: 0, top: 0, right: 400, bottom: 300 });
    stubRect(heading, { left: 16, top: 16, right: 256, bottom: 64 });

    const { result } = renderHook(() => useConvertContainerToFreeLayout());
    result.current("section-1");

    const section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(section?.layoutMode).toBe("free");
    expect(section?.children?.find((c) => c.id === "heading-1")?.freeLayout).toEqual({
      x: 0,
      y: 0,
      width: 240,
      height: 48,
    });
  });

  it("preserves the visual composition of multiple children measured at different positions", () => {
    const container = document.createElement("div");
    container.setAttribute("data-node-id", "section-1");
    const heading = document.createElement("h1");
    heading.setAttribute("data-node-id", "heading-1");
    const paragraph = document.createElement("p");
    paragraph.setAttribute("data-node-id", "paragraph-1");
    container.append(heading, paragraph);
    document.body.appendChild(container);

    stubRect(container, { left: 100, top: 50, right: 500, bottom: 400 });
    stubRect(heading, { left: 116, top: 66, right: 356, bottom: 114 });
    stubRect(paragraph, { left: 116, top: 130, right: 356, bottom: 210 });

    const { result } = renderHook(() => useConvertContainerToFreeLayout());
    result.current("section-1");

    const section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(section?.children?.find((c) => c.id === "heading-1")?.freeLayout).toEqual({
      x: 16,
      y: 16,
      width: 240,
      height: 48,
    });
    expect(section?.children?.find((c) => c.id === "paragraph-1")?.freeLayout).toEqual({
      x: 16,
      y: 80,
      width: 240,
      height: 80,
    });
  });

  it("preserves the container's own rendered size (dimensions) so it doesn't visually collapse once children become position: absolute", () => {
    const container = document.createElement("div");
    container.setAttribute("data-node-id", "section-1");
    const heading = document.createElement("h1");
    heading.setAttribute("data-node-id", "heading-1");
    container.appendChild(heading);
    document.body.appendChild(container);

    stubRect(container, { left: 0, top: 0, right: 400, bottom: 300 });
    stubRect(heading, { left: 0, top: 0, right: 240, bottom: 48 });

    const { result } = renderHook(() => useConvertContainerToFreeLayout());
    result.current("section-1");

    const section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(section?.dimensions).toEqual({ preferredWidth: 400, preferredHeight: 300, offsetX: 0, offsetY: 0 });
  });

  it("floors the container's own preserved size at the generic minimum when its Flow-rendered size measures smaller (e.g. empty or lightly populated)", () => {
    useEditorStore.setState((state) => ({
      document: { ...state.document, children: [{ id: "container-1", tag: "div", children: [] }] },
    }));

    const container = document.createElement("div");
    container.setAttribute("data-node-id", "container-1");
    container.setAttribute("data-node-type", "div");
    document.body.appendChild(container);

    // An empty/near-empty Flow container commonly measures far below a
    // typical size — Flow auto-sizing has no enforced floor, unlike an
    // explicit resize. The height here (2px) is below the generic resize
    // floor (Checkpoint 1.12.1); the width (400px) is not.
    stubRect(container, { left: 0, top: 0, right: 400, bottom: 2 });

    const { result } = renderHook(() => useConvertContainerToFreeLayout());
    result.current("container-1");

    const converted = useEditorStore.getState().document.children?.find((c) => c.id === "container-1");
    expect(converted?.dimensions).toEqual({
      preferredWidth: 400,
      preferredHeight: DEFAULT_RESIZE_CONSTRAINTS.minHeight,
      offsetX: 0,
      offsetY: 0,
    });
  });

  it("floors a Section's own preserved size at the same generic minimum as any other tag (Checkpoint 1.12.1 — no bigger, category-specific container floor)", () => {
    useEditorStore.setState((state) => ({
      document: { ...state.document, children: [{ id: "section-x", tag: "section", children: [] }] },
    }));

    const container = document.createElement("div");
    container.setAttribute("data-node-id", "section-x");
    container.setAttribute("data-node-type", "section");
    document.body.appendChild(container);

    stubRect(container, { left: 0, top: 0, right: 2, bottom: 2 });

    const { result } = renderHook(() => useConvertContainerToFreeLayout());
    result.current("section-x");

    const converted = useEditorStore.getState().document.children?.find((c) => c.id === "section-x");
    expect(converted?.dimensions).toEqual({
      preferredWidth: DEFAULT_RESIZE_CONSTRAINTS.minWidth,
      preferredHeight: DEFAULT_RESIZE_CONSTRAINTS.minHeight,
      offsetX: 0,
      offsetY: 0,
    });
  });

  it("preserves a nested Free container's own size as freeLayout (not dimensions) when its own parent is already Free", () => {
    useEditorStore.setState((state) => ({
      document: {
        ...state.document,
        children: [
          {
            id: "outer",
            tag: "div",
            layoutMode: "free",
            children: [{ id: "inner", tag: "div", children: [{ id: "leaf", tag: "p" }] }],
          },
        ],
      },
    }));

    const outerEl = document.createElement("div");
    outerEl.setAttribute("data-node-id", "outer");
    const innerEl = document.createElement("div");
    innerEl.setAttribute("data-node-id", "inner");
    const leafEl = document.createElement("p");
    leafEl.setAttribute("data-node-id", "leaf");
    innerEl.appendChild(leafEl);
    outerEl.appendChild(innerEl);
    document.body.appendChild(outerEl);

    stubRect(outerEl, { left: 0, top: 0, right: 500, bottom: 400 });
    stubRect(innerEl, { left: 20, top: 30, right: 220, bottom: 130 });
    stubRect(leafEl, { left: 20, top: 30, right: 220, bottom: 130 });

    const { result } = renderHook(() => useConvertContainerToFreeLayout());
    result.current("inner");

    const inner = useEditorStore.getState().document.children?.find((c) => c.id === "outer")?.children?.[0];
    expect(inner?.freeLayout).toEqual({ x: 20, y: 30, width: 200, height: 100 });
    expect(inner?.dimensions).toBeUndefined();
  });

  it("is one atomic, one-history-entry write", () => {
    const container = document.createElement("div");
    container.setAttribute("data-node-id", "section-1");
    const heading = document.createElement("h1");
    heading.setAttribute("data-node-id", "heading-1");
    container.appendChild(heading);
    document.body.appendChild(container);
    stubRect(container, { left: 0, top: 0, right: 400, bottom: 300 });
    stubRect(heading, { left: 0, top: 0, right: 240, bottom: 48 });

    const pastLengthBefore = useEditorStore.getState().past.length;
    const { result } = renderHook(() => useConvertContainerToFreeLayout());
    result.current("section-1");

    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore + 1);
  });

  it("does nothing when the container has no rendered DOM node", () => {
    const before = useEditorStore.getState().document;
    const { result } = renderHook(() => useConvertContainerToFreeLayout());
    result.current("does-not-exist");

    expect(useEditorStore.getState().document).toBe(before);
  });
});
