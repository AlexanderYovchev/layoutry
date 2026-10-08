import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { useFreeChildResizeSession } from "./useFreeChildResizeSession";
import type { ResizeDirection } from "@/features/editor/types/resize";

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

function stubClientSize(el: Element, width: number, height: number) {
  Object.defineProperty(el, "clientWidth", { value: width, configurable: true });
  Object.defineProperty(el, "clientHeight", { value: height, configurable: true });
}

function Harness({ direction, nodeId = "free-image-1" }: { direction: ResizeDirection; nodeId?: string }) {
  const { onHandlePointerDown, onHandlePointerMove, onHandlePointerUp } = useFreeChildResizeSession(nodeId);
  return (
    <div data-node-id="free-container-1">
      <div data-node-id={nodeId} data-node-type="img" />
      <div
        data-testid="handle"
        onPointerDown={onHandlePointerDown(direction, { startX: 16, startY: 16, startWidth: 100, startHeight: 80 })}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
      />
    </div>
  );
}

describe("useFreeChildResizeSession", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});

    useEditorStore.setState((state) => ({
      document: {
        ...state.document,
        children: [
          {
            id: "free-container-1",
            tag: "div",
            layoutMode: "free",
            children: [
              {
                id: "free-image-1",
                tag: "img",
                freeLayout: { x: 16, y: 16, width: 100, height: 80 },
              },
            ],
          },
        ],
      },
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  function setupDom() {
    const { container } = render(<Harness direction="e" />);
    const containerEl = container.querySelector('[data-node-id="free-container-1"]') as HTMLElement;
    const target = container.querySelector('[data-node-id="free-image-1"]') as HTMLElement;
    stubRect(containerEl, { left: 0, top: 0, right: 400, bottom: 300 });
    stubClientSize(containerEl, 400, 300);
    return { container, containerEl, target };
  }

  it("east: grows width in place and writes the node's freeLayout live", () => {
    const { target } = setupDom();
    const handle = target.parentElement!.querySelector('[data-testid="handle"]') as HTMLElement;

    fireEvent.pointerDown(handle, { clientX: 200, clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 230, clientY: 200, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 230, clientY: 200, pointerId: 1 });

    const image = useEditorStore
      .getState()
      .document.children?.find((c) => c.id === "free-container-1")
      ?.children?.find((c) => c.id === "free-image-1");
    expect(image?.freeLayout).toEqual({ x: 16, y: 16, width: 130, height: 80 });
  });

  it("does not resize an unrelated sibling", () => {
    useEditorStore.setState((state) => ({
      document: {
        ...state.document,
        children: [
          {
            ...state.document.children![0],
            children: [
              ...state.document.children![0].children!,
              { id: "free-image-2", tag: "img", freeLayout: { x: 200, y: 16, width: 60, height: 60 } },
            ],
          },
        ],
      },
    }));
    const { target } = setupDom();
    const handle = target.parentElement!.querySelector('[data-testid="handle"]') as HTMLElement;

    fireEvent.pointerDown(handle, { clientX: 200, clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 230, clientY: 200, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 230, clientY: 200, pointerId: 1 });

    const sibling = useEditorStore
      .getState()
      .document.children?.find((c) => c.id === "free-container-1")
      ?.children?.find((c) => c.id === "free-image-2");
    expect(sibling?.freeLayout).toEqual({ x: 200, y: 16, width: 60, height: 60 });
  });

  it("clamps growth at the parent's content bounds", () => {
    const { target } = setupDom();
    const handle = target.parentElement!.querySelector('[data-testid="handle"]') as HTMLElement;

    fireEvent.pointerDown(handle, { clientX: 200, clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 100000, clientY: 200, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 100000, clientY: 200, pointerId: 1 });

    const image = useEditorStore
      .getState()
      .document.children?.find((c) => c.id === "free-container-1")
      ?.children?.find((c) => c.id === "free-image-1");
    expect(image!.freeLayout!.x + image!.freeLayout!.width).toBeLessThanOrEqual(400);
  });

  it("a full drag produces exactly one history entry (transaction wrapping)", () => {
    const { target } = setupDom();
    const handle = target.parentElement!.querySelector('[data-testid="handle"]') as HTMLElement;

    fireEvent.pointerDown(handle, { clientX: 200, clientY: 200, pointerId: 1 });
    for (let x = 205; x <= 230; x += 5) {
      fireEvent.pointerMove(handle, { clientX: x, clientY: 200, pointerId: 1 });
    }
    fireEvent.pointerUp(handle, { clientX: 230, clientY: 200, pointerId: 1 });

    expect(useEditorStore.getState().past).toHaveLength(1);
  });

  it("a plain click on the handle (pointerdown immediately followed by pointerup, no pointermove) commits nothing and records no history (Checkpoint 5.7 regression)", () => {
    const { target } = setupDom();
    const handle = target.parentElement!.querySelector('[data-testid="handle"]') as HTMLElement;

    fireEvent.pointerDown(handle, { clientX: 200, clientY: 200, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 200, clientY: 200, pointerId: 1 });

    const image = useEditorStore
      .getState()
      .document.children?.find((c) => c.id === "free-container-1")
      ?.children?.find((c) => c.id === "free-image-1");
    expect(image?.freeLayout).toEqual({ x: 16, y: 16, width: 100, height: 80 });
    expect(useEditorStore.getState().past).toHaveLength(0);
  });

  it("Escape mid-drag cancels the resize and records no history", () => {
    const { target } = setupDom();
    const handle = target.parentElement!.querySelector('[data-testid="handle"]') as HTMLElement;

    fireEvent.pointerDown(handle, { clientX: 200, clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 230, clientY: 200, pointerId: 1 });
    fireEvent.keyDown(window, { key: "Escape" });

    const image = useEditorStore
      .getState()
      .document.children?.find((c) => c.id === "free-container-1")
      ?.children?.find((c) => c.id === "free-image-1");
    expect(image?.freeLayout).toEqual({ x: 16, y: 16, width: 100, height: 80 });
    expect(useEditorStore.getState().past).toHaveLength(0);
  });
});

describe("useFreeChildResizeSession — Transform geometry safety (Checkpoint 1.15.6.14.3)", () => {
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

  function seedContainerWithTransform(transform: Record<string, number> | undefined) {
    useEditorStore.setState((state) => ({
      document: {
        ...state.document,
        children: [
          {
            id: "free-container-1",
            tag: "div",
            layoutMode: "free",
            transform,
            children: [{ id: "free-image-1", tag: "img", freeLayout: { x: 16, y: 16, width: 100, height: 80 } }],
          },
        ],
      },
    }));
  }

  function setupDom() {
    const { container } = render(<Harness direction="e" />);
    const containerEl = container.querySelector('[data-node-id="free-container-1"]') as HTMLElement;
    const target = container.querySelector('[data-node-id="free-image-1"]') as HTMLElement;
    stubRect(containerEl, { left: 0, top: 0, right: 400, bottom: 300 });
    stubClientSize(containerEl, 400, 300);
    return { container, containerEl, target };
  }

  it("a translate-only container parent does not block the child's resize", () => {
    seedContainerWithTransform({ translateX: 50 });
    const { target } = setupDom();
    const handle = target.parentElement!.querySelector('[data-testid="handle"]') as HTMLElement;

    fireEvent.pointerDown(handle, { clientX: 200, clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 230, clientY: 200, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 230, clientY: 200, pointerId: 1 });

    const image = useEditorStore.getState().document.children?.[0]?.children?.find((c) => c.id === "free-image-1");
    expect(image?.freeLayout).toEqual({ x: 16, y: 16, width: 130, height: 80 });
  });

  it("a rotated container parent blocks the child's resize and shows the exact editor notice", () => {
    seedContainerWithTransform({ rotateDeg: 20 });
    const { target } = setupDom();
    const handle = target.parentElement!.querySelector('[data-testid="handle"]') as HTMLElement;

    fireEvent.pointerDown(handle, { clientX: 200, clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 230, clientY: 200, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 230, clientY: 200, pointerId: 1 });

    const image = useEditorStore.getState().document.children?.[0]?.children?.find((c) => c.id === "free-image-1");
    expect(image?.freeLayout).toEqual({ x: 16, y: 16, width: 100, height: 80 });
    expect(useEditorStore.getState().editorNotice?.message).toBe(
      "This element is inside a rotated or scaled container. Reset the ancestor's transform to move or resize it.",
    );
  });

  it("a scaled container parent blocks the child's resize", () => {
    seedContainerWithTransform({ scale: 1.5 });
    const { target } = setupDom();
    const handle = target.parentElement!.querySelector('[data-testid="handle"]') as HTMLElement;

    fireEvent.pointerDown(handle, { clientX: 200, clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 230, clientY: 200, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 230, clientY: 200, pointerId: 1 });

    const image = useEditorStore.getState().document.children?.[0]?.children?.find((c) => c.id === "free-image-1");
    expect(image?.freeLayout).toEqual({ x: 16, y: 16, width: 100, height: 80 });
  });

  it("resetting the blocking ancestor's transform immediately unblocks the child's resize", () => {
    seedContainerWithTransform(undefined);
    const { target } = setupDom();
    const handle = target.parentElement!.querySelector('[data-testid="handle"]') as HTMLElement;

    fireEvent.pointerDown(handle, { clientX: 200, clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 230, clientY: 200, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 230, clientY: 200, pointerId: 1 });

    const image = useEditorStore.getState().document.children?.[0]?.children?.find((c) => c.id === "free-image-1");
    expect(image?.freeLayout).toEqual({ x: 16, y: 16, width: 130, height: 80 });
  });
});

describe("useFreeChildResizeSession — nested Free container scaling (Checkpoint 3.4.4)", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});

    useEditorStore.setState((state) => ({
      document: {
        ...state.document,
        children: [
          {
            id: "outer-container",
            tag: "div",
            layoutMode: "free",
            freeLayout: { x: 0, y: 0, width: 400, height: 300 },
            children: [
              {
                id: "inner-container",
                tag: "div",
                layoutMode: "free",
                freeLayout: { x: 16, y: 16, width: 200, height: 150 },
                children: [{ id: "leaf", tag: "p", freeLayout: { x: 10, y: 10, width: 50, height: 30 } }],
              },
            ],
          },
        ],
      },
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  function NestedHarness({ direction }: { direction: ResizeDirection }) {
    const { onHandlePointerDown, onHandlePointerMove, onHandlePointerUp } = useFreeChildResizeSession("inner-container");
    return (
      <div data-node-id="outer-container">
        <div data-node-id="inner-container" data-node-type="div">
          <div data-node-id="leaf" data-node-type="p" />
        </div>
        <div
          data-testid="handle"
          onPointerDown={onHandlePointerDown(direction, { startX: 16, startY: 16, startWidth: 200, startHeight: 150 })}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
        />
      </div>
    );
  }

  it("resizing a Free container that is itself a Free child atomically scales its own children too", () => {
    const { container } = render(<NestedHarness direction="e" />);
    const outerEl = container.querySelector('[data-node-id="outer-container"]') as HTMLElement;
    const innerEl = container.querySelector('[data-node-id="inner-container"]') as HTMLElement;
    stubClientSize(outerEl, 400, 300);
    stubClientSize(innerEl, 200, 150);
    const handle = container.querySelector('[data-testid="handle"]') as HTMLElement;

    fireEvent.pointerDown(handle, { clientX: 300, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 400, clientY: 300, pointerId: 1 }); // width 200 -> 300, scaleX = 1.5
    fireEvent.pointerUp(handle, { clientX: 400, clientY: 300, pointerId: 1 });

    const inner = useEditorStore
      .getState()
      .document.children?.find((c) => c.id === "outer-container")
      ?.children?.find((c) => c.id === "inner-container");
    expect(inner?.freeLayout).toEqual({ x: 16, y: 16, width: 300, height: 150 });
    expect(inner?.children?.find((c) => c.id === "leaf")?.freeLayout).toEqual({
      x: 15,
      y: 10,
      width: 75,
      height: 30,
    });
  });
});
