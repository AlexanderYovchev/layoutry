import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { useFreeChildResizeSession } from "./useFreeChildResizeSession";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { ResizeDirection } from "@/features/editor/types/resize";
import { findNodeById } from "@/features/editor/utils/findNodeById";

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

interface MeasuredTarget {
  id: string;
  rect: { left: number; top: number; right: number; bottom: number };
}

function SnapHarness({ direction, tag, targets }: { direction: ResizeDirection; tag: string; targets: MeasuredTarget[] }) {
  const { onHandlePointerDown, onHandlePointerMove, onHandlePointerUp, onHandlePointerCancel } = useFreeChildResizeSession("box");
  const node = findNodeById(useEditorStore.getState().document, "box");
  const start = node?.freeLayout ?? { x: 0, y: 0, width: 0, height: 0 };
  return (
    <div data-node-id="free-container-1">
      <div data-node-id="box" data-node-type={tag} />
      {targets.map((target) => (
        <div key={target.id} data-node-id={target.id} />
      ))}
      <div
        data-testid="handle"
        onPointerDown={onHandlePointerDown(direction, { startX: start.x, startY: start.y, startWidth: start.width, startHeight: start.height })}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={onHandlePointerCancel}
      />
    </div>
  );
}

/**
 * BC-13.4 — resize snapping on the shared engine, through the real session:
 * measured targets, the controlled edge only, Alt/Snap off, the final
 * pointer position, one Undo step, Escape, ratio-locked corners, margins,
 * the element's own rotate/scale, hidden targets, Shift unchanged.
 */
describe("useFreeChildResizeSession — snapping (BC-13.4)", () => {
  let frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 1;
  const flush = () => {
    const pending = [...frames.values()];
    frames = new Map();
    for (const callback of pending) callback(0);
  };

  beforeEach(() => {
    frames = new Map();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      const id = nextFrame++;
      frames.set(id, callback);
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  type Seed = { id: string; freeLayout: { x: number; y: number; width: number; height: number }; extra?: Partial<EditorElementNode> };

  /** A 500×400 Free container at the origin; "box" (100,100 100×50) is resized; by default a sibling "t" sits at 300..340 × 100..150. */
  function setup(options: { direction: ResizeDirection; tag?: string; box?: Partial<EditorElementNode>; boxRect?: MeasuredTarget["rect"]; siblings?: Seed[] }) {
    const siblings = options.siblings ?? [{ id: "t", freeLayout: { x: 300, y: 100, width: 40, height: 50 } }];
    const tag = options.tag ?? "div";
    useEditorStore.setState((state) => ({
      document: {
        ...state.document,
        children: [
          {
            id: "free-container-1",
            tag: "div",
            layoutMode: "free",
            children: [
              { id: "box", tag, freeLayout: { x: 100, y: 100, width: 100, height: 50 }, ...options.box },
              ...siblings.map((s) => ({ id: s.id, tag: "div", freeLayout: s.freeLayout, ...s.extra })),
            ],
          },
        ],
      },
    }));
    const targets = siblings.map((s) => ({
      id: s.id,
      rect: { left: s.freeLayout.x, top: s.freeLayout.y, right: s.freeLayout.x + s.freeLayout.width, bottom: s.freeLayout.y + s.freeLayout.height },
    }));
    const { container } = render(<SnapHarness direction={options.direction} tag={tag} targets={targets} />);
    const containerEl = container.querySelector('[data-node-id="free-container-1"]') as HTMLElement;
    stubRect(containerEl, { left: 0, top: 0, right: 500, bottom: 400 });
    stubClientSize(containerEl, 500, 400);
    stubRect(container.querySelector('[data-node-id="box"]')!, options.boxRect ?? { left: 100, top: 100, right: 200, bottom: 150 });
    for (const target of targets) stubRect(container.querySelector(`[data-node-id="${target.id}"]`)!, target.rect);
    return container.querySelector('[data-testid="handle"]') as HTMLElement;
  }

  const geometry = (id = "box") => findNodeById(useEditorStore.getState().document, id)?.freeLayout;
  const guides = () => useEditorStore.getState().activeSnapGuides;
  // The pointer starts at (200,125); the raw east width is 100 + (clientX − 200).
  const down = (handle: HTMLElement, init: { altKey?: boolean } = {}) => fireEvent.pointerDown(handle, { clientX: 200, clientY: 125, pointerId: 1, ...init });
  const move = (handle: HTMLElement, x: number, y = 125, init: { altKey?: boolean; shiftKey?: boolean } = {}) => {
    fireEvent.pointerMove(handle, { clientX: x, clientY: y, pointerId: 1, ...init });
    flush();
  };

  it("east: the right edge snaps to a sibling's edge within 6px; the left edge stays; the guide is live, achieved, and cleared on release", () => {
    const handle = setup({ direction: "e" });
    down(handle);
    move(handle, 296); // raw right 296 → 300
    expect(geometry()).toEqual({ x: 100, y: 100, width: 200, height: 50 });
    expect(guides()?.vertical).toMatchObject({ coordinate: 300, achieved: true });
    fireEvent.pointerUp(handle, { clientX: 296, clientY: 125, pointerId: 1 });
    expect(geometry()).toEqual({ x: 100, y: 100, width: 200, height: 50 });
    expect(guides()).toBeNull();
    expect(geometry("t")).toEqual({ x: 300, y: 100, width: 40, height: 50 });
  });

  it("west: the left edge snaps and the right edge stays anchored", () => {
    const handle = setup({ direction: "w", siblings: [{ id: "l", freeLayout: { x: 20, y: 100, width: 40, height: 50 } }] });
    down(handle);
    move(handle, 164); // raw left 64 → 60 (the sibling's right edge)
    expect(geometry()).toEqual({ x: 60, y: 100, width: 140, height: 50 });
  });

  it("Alt/Option bypasses the snap but keeps a nearby (not achieved) guide; releasing Alt snaps without moving the pointer", () => {
    const handle = setup({ direction: "e" });
    down(handle);
    move(handle, 296, 125, { altKey: true });
    expect(geometry()?.width).toBe(196);
    expect(guides()?.vertical).toMatchObject({ coordinate: 300, achieved: false });
    fireEvent.keyUp(window, { key: "Alt", altKey: false });
    flush();
    expect(geometry()?.width).toBe(200);
    expect(useEditorStore.getState().snapEnabled).toBe(true);
  });

  it("with Snap turned off: no snap, a nearby guide, and the preference is unchanged", () => {
    const handle = setup({ direction: "e" });
    useEditorStore.setState({ snapEnabled: false });
    down(handle);
    move(handle, 296);
    expect(geometry()?.width).toBe(196);
    expect(guides()?.vertical?.achieved).toBe(false);
    fireEvent.pointerUp(handle, { clientX: 296, clientY: 125, pointerId: 1 });
    expect(useEditorStore.getState().snapEnabled).toBe(false);
  });

  it("the final pointer position wins: a release away from the last rendered frame commits the release position", () => {
    const handle = setup({ direction: "e" });
    down(handle);
    move(handle, 250);
    fireEvent.pointerMove(handle, { clientX: 290, clientY: 125, pointerId: 1 }); // its frame is still pending
    fireEvent.pointerUp(handle, { clientX: 297, clientY: 125, pointerId: 1 }); // raw right 297 → snaps to 300
    expect(geometry()).toEqual({ x: 100, y: 100, width: 200, height: 50 });
    expect(useEditorStore.getState().past).toHaveLength(1);
  });

  it("a release with no pointermove but a different position still commits it; one at the same position is a no-op", () => {
    const handle = setup({ direction: "e" });
    down(handle);
    fireEvent.pointerUp(handle, { clientX: 230, clientY: 125, pointerId: 1 });
    expect(geometry()?.width).toBe(130);
    expect(useEditorStore.getState().past).toHaveLength(1);
    useEditorStore.getState().undo();
    down(handle);
    fireEvent.pointerUp(handle, { clientX: 200, clientY: 125, pointerId: 1 });
    expect(useEditorStore.getState().past).toHaveLength(0);
    expect(geometry()).toEqual({ x: 100, y: 100, width: 100, height: 50 });
  });

  it("a snapped resize is one Undo step; Undo and Redo restore the exact geometries", () => {
    const handle = setup({ direction: "e" });
    down(handle);
    for (const x of [230, 260, 290, 296]) move(handle, x);
    fireEvent.pointerUp(handle, { clientX: 296, clientY: 125, pointerId: 1 });
    expect(useEditorStore.getState().past).toHaveLength(1);
    useEditorStore.getState().undo();
    expect(geometry()).toEqual({ x: 100, y: 100, width: 100, height: 50 });
    useEditorStore.getState().redo();
    expect(geometry()).toEqual({ x: 100, y: 100, width: 200, height: 50 });
  });

  it("Escape restores the original geometry, clears the guide, and records nothing", () => {
    const handle = setup({ direction: "e" });
    down(handle);
    move(handle, 296);
    expect(guides()).not.toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(geometry()).toEqual({ x: 100, y: 100, width: 100, height: 50 });
    expect(guides()).toBeNull();
    expect(useEditorStore.getState().past).toHaveLength(0);
  });

  it("pointercancel keeps the existing behaviour (commits) and clears the guide", () => {
    const handle = setup({ direction: "e" });
    down(handle);
    move(handle, 296);
    fireEvent.pointerCancel(handle, { pointerId: 1 });
    expect(geometry()?.width).toBe(200);
    expect(guides()).toBeNull();
  });

  it("an aspect-ratio-locked corner (Image default) keeps its ratio while snapping", () => {
    const handle = setup({ direction: "se", tag: "img" });
    down(handle);
    move(handle, 296, 175); // raw width 196 → locked height 98; the x line 300 and y line 200 (parent centre) are compatible
    const g = geometry()!;
    expect(g).toEqual({ x: 100, y: 100, width: 200, height: 100 });
    expect(g.width / g.height).toBe(2);
  });

  it("Shift has no resize meaning: an unlocked corner still resizes both axes (no drag-style axis lock)", () => {
    const handle = setup({ direction: "se", siblings: [] });
    down(handle);
    move(handle, 240, 165, { shiftKey: true });
    expect(geometry()).toEqual({ x: 100, y: 100, width: 140, height: 90 });
  });

  it("margins: the rendered (margin-shifted) edge snaps; the stored width excludes the margin", () => {
    const handle = setup({ direction: "e", box: { spacing: { margin: { left: 8, top: 0 } } }, boxRect: { left: 108, top: 100, right: 208, bottom: 150 } });
    down(handle);
    move(handle, 288); // raw width 188 → rendered right 296 → 300
    expect(geometry()?.width).toBe(192);
  });

  it("hidden elements are not targets", () => {
    const handle = setup({ direction: "e", siblings: [{ id: "ghost", freeLayout: { x: 300, y: 100, width: 40, height: 50 }, extra: { display: { display: "none" } } }] });
    down(handle);
    move(handle, 296);
    expect(geometry()?.width).toBe(196);
    expect(guides()).toBeNull();
  });

  it("an element with its own rotate/scale resizes exactly as before, without snapping", () => {
    const handle = setup({ direction: "e", box: { transform: { rotateDeg: 15 } } });
    down(handle);
    move(handle, 296);
    expect(geometry()?.width).toBe(196);
    expect(guides()).toBeNull();
  });

  it("an axis whose rendered size doesn't follow the stored size doesn't snap (content taller than the box)", () => {
    const handle = setup({ direction: "s", siblings: [{ id: "t", freeLayout: { x: 300, y: 180, width: 40, height: 50 } }], boxRect: { left: 100, top: 100, right: 200, bottom: 166 } });
    down(handle);
    move(handle, 200, 152); // raw height 77 → bottom 177, 3 from the sibling's top
    expect(geometry()?.height).toBe(77);
  });
});
