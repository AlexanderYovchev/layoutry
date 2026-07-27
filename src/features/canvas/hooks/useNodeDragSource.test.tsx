import { DndContext } from "@dnd-kit/core";
import { fireEvent, render, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { useNodeDragSource } from "./useNodeDragSource";

function wrapper({ children }: { children: ReactNode }) {
  return <DndContext>{children}</DndContext>;
}

describe("useNodeDragSource", () => {
  it("exposes a ref-setter, pointer listeners, and dragging state", () => {
    const { result } = renderHook(
      () => useNodeDragSource({ id: "heading-1", tag: "h1", text: "Title" }),
      { wrapper },
    );

    expect(result.current.setNodeRef).toBeTypeOf("function");
    expect(result.current.isDragging).toBe(false);
    expect(result.current.listeners).toBeDefined();
  });

  it("defaults to the Flow (dnd-kit reorder) branch when parentLayoutMode is omitted", () => {
    const { result } = renderHook(
      () => useNodeDragSource({ id: "heading-1", tag: "h1", text: "Title" }),
      { wrapper },
    );

    // The Flow branch's listeners object only ever carries onPointerDown
    // (dnd-kit's sensors handle move/up globally) — the Free branch below
    // carries all four.
    expect(Object.keys(result.current.listeners ?? {})).toEqual(["onPointerDown"]);
  });

  it("uses the Free move-session branch (all four pointer handlers) when parentLayoutMode is 'free'", () => {
    const { result } = renderHook(
      () => useNodeDragSource({ id: "heading-1", tag: "h1", text: "Title" }, "free"),
      { wrapper },
    );

    expect(Object.keys(result.current.listeners ?? {}).sort()).toEqual(
      ["onPointerCancel", "onPointerDown", "onPointerMove", "onPointerUp"].sort(),
    );
  });
});

describe("useNodeDragSource — Free move session wiring (Checkpoint 3.4.4)", () => {
  const initialState = useEditorStore.getState();

  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

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

  function FreeChildHarness() {
    const { setNodeRef, listeners } = useNodeDragSource(
      { id: "free-image-1", tag: "img" },
      "free",
    );
    return (
      <div data-node-id="free-container-1">
        <div ref={setNodeRef} data-node-id="free-image-1" {...listeners} />
      </div>
    );
  }

  it("dragging a Free child updates its freeLayout via the store, not the dnd-kit reorder path", () => {
    useEditorStore.setState((state) => ({
      document: {
        ...state.document,
        children: [
          {
            id: "free-container-1",
            tag: "div",
            layoutMode: "free",
            children: [
              { id: "free-image-1", tag: "img", freeLayout: { x: 10, y: 10, width: 64, height: 64 } },
            ],
          },
        ],
      },
    }));

    const { container } = render(<FreeChildHarness />);
    const containerEl = container.querySelector('[data-node-id="free-container-1"]') as HTMLElement;
    const target = container.querySelector('[data-node-id="free-image-1"]') as HTMLElement;
    stubRect(containerEl, { left: 0, top: 0, right: 400, bottom: 300 });
    stubRect(target, { left: 10, top: 10, right: 74, bottom: 74 });
    Object.defineProperty(containerEl, "clientWidth", { value: 400, configurable: true });
    Object.defineProperty(containerEl, "clientHeight", { value: 300, configurable: true });

    fireEvent.pointerDown(target, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(target, { clientX: 130, clientY: 120, pointerId: 1 });
    fireEvent.pointerUp(target, { clientX: 130, clientY: 120, pointerId: 1 });

    const updated = useEditorStore
      .getState()
      .document.children?.find((c) => c.id === "free-container-1")
      ?.children?.find((c) => c.id === "free-image-1");
    expect(updated?.freeLayout).toEqual({ x: 40, y: 30, width: 64, height: 64 });
  });
});
