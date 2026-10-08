import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { useFreeChildMoveSession } from "./useFreeChildMoveSession";

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

function Harness({ nodeId = "free-a" }: { nodeId?: string }) {
  const { onPointerDown, onPointerMove, onPointerUp, onPointerCancel } = useFreeChildMoveSession(nodeId);
  return (
    <div data-node-id="free-container-1">
      <div
        data-testid="moving"
        data-node-id={nodeId}
        data-node-type="div"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      />
    </div>
  );
}

/**
 * Checkpoint 1.15.6.1.1 — Snap. This hook previously had no dedicated
 * test file at all (only exercised indirectly through
 * useNodeDragSource/e2e); adding one here since Snap is now wired
 * directly into its own commit() path.
 */
describe("useFreeChildMoveSession", () => {
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

  function seedDocument(children: Array<{ id: string; x: number; y: number; width: number; height: number }>) {
    useEditorStore.setState((state) => ({
      document: {
        ...state.document,
        children: [
          {
            id: "free-container-1",
            tag: "div",
            layoutMode: "free",
            children: children.map((c) => ({
              id: c.id,
              tag: "div",
              freeLayout: { x: c.x, y: c.y, width: c.width, height: c.height },
            })),
          },
        ],
      },
    }));
  }

  function setupDom(nodeId = "free-a") {
    const { container } = render(<Harness nodeId={nodeId} />);
    const containerEl = container.querySelector('[data-node-id="free-container-1"]') as HTMLElement;
    const target = container.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement;
    stubRect(containerEl, { left: 0, top: 0, right: 500, bottom: 400 });
    stubClientSize(containerEl, 500, 400);
    return { container, containerEl, target };
  }

  it("moves without snapping when far from every target (Snap default-on, but nothing within threshold)", () => {
    seedDocument([{ id: "free-a", x: 200, y: 200, width: 30, height: 30 }]);
    const { target } = setupDom();
    stubRect(target, { left: 200, top: 200, right: 230, bottom: 230 });

    // Parent is 500x400 (targets at 0/250/500 and 0/200/400); a 30x30 box's
    // three reference points landing around x=130/145/160 and y=130/145/160
    // are all comfortably outside the 8px threshold of every parent target.
    fireEvent.pointerDown(target, { clientX: 215, clientY: 215, pointerId: 1 });
    fireEvent.pointerMove(target, { clientX: 145, clientY: 145, pointerId: 1 });
    fireEvent.pointerUp(target, { clientX: 145, clientY: 145, pointerId: 1 });

    const node = findNodeById(useEditorStore.getState().document, "free-a");
    expect(node?.freeLayout).toEqual({ x: 130, y: 130, width: 30, height: 30 });
  });

  it("snaps to the parent's left edge when dragged within threshold of it", () => {
    seedDocument([{ id: "free-a", x: 200, y: 200, width: 30, height: 30 }]);
    const { target } = setupDom();
    stubRect(target, { left: 200, top: 200, right: 230, bottom: 230 });

    // Drag so the raw proposed x would land at 5 (within the 8px threshold of the parent's left edge, 0).
    fireEvent.pointerDown(target, { clientX: 215, clientY: 215, pointerId: 1 });
    fireEvent.pointerMove(target, { clientX: 20, clientY: 215, pointerId: 1 });
    fireEvent.pointerUp(target, { clientX: 20, clientY: 215, pointerId: 1 });

    const node = findNodeById(useEditorStore.getState().document, "free-a");
    expect(node?.freeLayout?.x).toBe(0);
  });

  it("sets activeSnapGuides live while snapped, and clears it on pointer-up", () => {
    seedDocument([{ id: "free-a", x: 200, y: 200, width: 30, height: 30 }]);
    const { target } = setupDom();
    stubRect(target, { left: 200, top: 200, right: 230, bottom: 230 });

    fireEvent.pointerDown(target, { clientX: 215, clientY: 215, pointerId: 1 });
    // x snaps to the parent's left edge; y moves to 130 (see the no-snap
    // test above for why that y is clear of every target) so only the
    // vertical guide is present, not also a coincidental horizontal one.
    fireEvent.pointerMove(target, { clientX: 20, clientY: 145, pointerId: 1 });

    expect(useEditorStore.getState().activeSnapGuides).toEqual({ containerId: "free-container-1", vertical: 0 });

    fireEvent.pointerUp(target, { clientX: 20, clientY: 145, pointerId: 1 });
    expect(useEditorStore.getState().activeSnapGuides).toBeNull();
  });

  it("snaps to a sibling's edge, never to the moving node's own prior position", () => {
    seedDocument([
      { id: "free-a", x: 200, y: 200, width: 30, height: 30 },
      { id: "free-b", x: 100, y: 50, width: 40, height: 40 },
    ]);
    const { target } = setupDom();
    stubRect(target, { left: 200, top: 200, right: 230, bottom: 230 });

    // sibling free-b's left edge is 100; drag so raw proposed x lands at 98,
    // which is closer to the sibling's left edge (distance 2) than to its
    // center at 120 (distance 7 for a 30-wide box) or right edge at 140
    // (excluded, distance 12) — the left-edge match is the unambiguous winner.
    fireEvent.pointerDown(target, { clientX: 215, clientY: 215, pointerId: 1 });
    fireEvent.pointerMove(target, { clientX: 113, clientY: 145, pointerId: 1 });
    fireEvent.pointerUp(target, { clientX: 113, clientY: 145, pointerId: 1 });

    const movedNode = findNodeById(useEditorStore.getState().document, "free-a");
    const siblingNode = findNodeById(useEditorStore.getState().document, "free-b");
    expect(movedNode?.freeLayout?.x).toBe(100);
    // The sibling itself must be completely untouched by the moving node's own drag.
    expect(siblingNode?.freeLayout).toEqual({ x: 100, y: 50, width: 40, height: 40 });
  });

  it("does not snap at all when Snap is turned off", () => {
    seedDocument([{ id: "free-a", x: 200, y: 200, width: 30, height: 30 }]);
    useEditorStore.getState().setSnapEnabled(false);
    const { target } = setupDom();
    stubRect(target, { left: 200, top: 200, right: 230, bottom: 230 });

    fireEvent.pointerDown(target, { clientX: 215, clientY: 215, pointerId: 1 });
    fireEvent.pointerMove(target, { clientX: 20, clientY: 215, pointerId: 1 });
    fireEvent.pointerUp(target, { clientX: 20, clientY: 215, pointerId: 1 });

    const node = findNodeById(useEditorStore.getState().document, "free-a");
    // Raw delta only: startX(200) + (20-215) = 5, clamped to >=0 -> 5, no snap to 0.
    expect(node?.freeLayout?.x).toBe(5);
    expect(useEditorStore.getState().activeSnapGuides).toBeNull();
  });

  it("a snapped move drag is still exactly one history entry, and undo restores the pre-drag position", () => {
    seedDocument([{ id: "free-a", x: 200, y: 200, width: 30, height: 30 }]);
    const { target } = setupDom();
    stubRect(target, { left: 200, top: 200, right: 230, bottom: 230 });
    const historyLengthBefore = useEditorStore.getState().past.length;

    fireEvent.pointerDown(target, { clientX: 215, clientY: 215, pointerId: 1 });
    fireEvent.pointerMove(target, { clientX: 50, clientY: 215, pointerId: 1 });
    fireEvent.pointerMove(target, { clientX: 20, clientY: 215, pointerId: 1 });
    fireEvent.pointerUp(target, { clientX: 20, clientY: 215, pointerId: 1 });

    expect(useEditorStore.getState().past.length).toBe(historyLengthBefore + 1);

    useEditorStore.getState().undo();
    const node = findNodeById(useEditorStore.getState().document, "free-a");
    expect(node?.freeLayout).toEqual({ x: 200, y: 200, width: 30, height: 30 });
  });

  it("Escape mid-drag restores the original position and clears any active snap guide", () => {
    seedDocument([{ id: "free-a", x: 200, y: 200, width: 30, height: 30 }]);
    const { target } = setupDom();
    stubRect(target, { left: 200, top: 200, right: 230, bottom: 230 });

    fireEvent.pointerDown(target, { clientX: 215, clientY: 215, pointerId: 1 });
    fireEvent.pointerMove(target, { clientX: 20, clientY: 215, pointerId: 1 });
    expect(useEditorStore.getState().activeSnapGuides).not.toBeNull();

    fireEvent.keyDown(window, { key: "Escape" });

    const node = findNodeById(useEditorStore.getState().document, "free-a");
    expect(node?.freeLayout).toEqual({ x: 200, y: 200, width: 30, height: 30 });
    expect(useEditorStore.getState().activeSnapGuides).toBeNull();
  });

  it("a plain click (no movement) commits nothing and leaves no history entry, snap or no snap", () => {
    seedDocument([{ id: "free-a", x: 200, y: 200, width: 30, height: 30 }]);
    const { target } = setupDom();
    stubRect(target, { left: 200, top: 200, right: 230, bottom: 230 });
    const historyLengthBefore = useEditorStore.getState().past.length;

    fireEvent.pointerDown(target, { clientX: 215, clientY: 215, pointerId: 1 });
    fireEvent.pointerUp(target, { clientX: 215, clientY: 215, pointerId: 1 });

    expect(useEditorStore.getState().past.length).toBe(historyLengthBefore);
    expect(useEditorStore.getState().activeSnapGuides).toBeNull();
  });
});

describe("Checkpoint 1.15.6.14.3 — Transform geometry safety", () => {
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
            children: [{ id: "free-a", tag: "div", freeLayout: { x: 200, y: 200, width: 30, height: 30 } }],
          },
        ],
      },
    }));
  }

  function setupDom(nodeId = "free-a") {
    const { container } = render(<Harness nodeId={nodeId} />);
    const containerEl = container.querySelector('[data-node-id="free-container-1"]') as HTMLElement;
    const target = container.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement;
    stubRect(containerEl, { left: 0, top: 0, right: 500, bottom: 400 });
    stubClientSize(containerEl, 500, 400);
    return { container, containerEl, target };
  }

  it("startX/startY read from node.freeLayout, not getBoundingClientRect — immune to the moving node's own authored Transform", () => {
    seedContainerWithTransform(undefined);
    const { target } = setupDom();
    // Deliberately stub the rect to report a position that DIFFERS from
    // freeLayout.x/y (simulating a painted position shifted by the node's
    // own authored Transform) — if the hook still read its start position
    // from this rect, the resulting delta would be wrong.
    stubRect(target, { left: 999, top: 999, right: 1029, bottom: 1029 });

    fireEvent.pointerDown(target, { clientX: 215, clientY: 215, pointerId: 1 });
    fireEvent.pointerMove(target, { clientX: 145, clientY: 145, pointerId: 1 });
    fireEvent.pointerUp(target, { clientX: 145, clientY: 145, pointerId: 1 });

    const node = findNodeById(useEditorStore.getState().document, "free-a");
    // Pointer delta (-70,-70) applied to the TRUE freeLayout start (200,200).
    expect(node?.freeLayout).toEqual({ x: 130, y: 130, width: 30, height: 30 });
  });

  it("a translate-only container parent does not block the child's move", () => {
    seedContainerWithTransform({ translateX: 50 });
    const { target } = setupDom();
    stubRect(target, { left: 200, top: 200, right: 230, bottom: 230 });

    fireEvent.pointerDown(target, { clientX: 215, clientY: 215, pointerId: 1 });
    fireEvent.pointerMove(target, { clientX: 145, clientY: 145, pointerId: 1 });
    fireEvent.pointerUp(target, { clientX: 145, clientY: 145, pointerId: 1 });

    const node = findNodeById(useEditorStore.getState().document, "free-a");
    expect(node?.freeLayout).toEqual({ x: 130, y: 130, width: 30, height: 30 });
  });

  it("a rotated container parent blocks the child's move and shows the exact editor notice", () => {
    seedContainerWithTransform({ rotateDeg: 20 });
    const { target } = setupDom();
    stubRect(target, { left: 200, top: 200, right: 230, bottom: 230 });

    fireEvent.pointerDown(target, { clientX: 215, clientY: 215, pointerId: 1 });
    fireEvent.pointerMove(target, { clientX: 145, clientY: 145, pointerId: 1 });
    fireEvent.pointerUp(target, { clientX: 145, clientY: 145, pointerId: 1 });

    const node = findNodeById(useEditorStore.getState().document, "free-a");
    expect(node?.freeLayout).toEqual({ x: 200, y: 200, width: 30, height: 30 });
    expect(useEditorStore.getState().editorNotice?.message).toBe(
      "This element is inside a rotated or scaled container. Reset the ancestor's transform to move or resize it.",
    );
  });

  it("a scaled container parent blocks the child's move", () => {
    seedContainerWithTransform({ scale: 1.5 });
    const { target } = setupDom();
    stubRect(target, { left: 200, top: 200, right: 230, bottom: 230 });

    fireEvent.pointerDown(target, { clientX: 215, clientY: 215, pointerId: 1 });
    fireEvent.pointerMove(target, { clientX: 145, clientY: 145, pointerId: 1 });
    fireEvent.pointerUp(target, { clientX: 145, clientY: 145, pointerId: 1 });

    const node = findNodeById(useEditorStore.getState().document, "free-a");
    expect(node?.freeLayout).toEqual({ x: 200, y: 200, width: 30, height: 30 });
  });

  it("resetting the blocking ancestor's transform immediately unblocks the child's move", () => {
    seedContainerWithTransform(undefined);
    const { target } = setupDom();
    stubRect(target, { left: 200, top: 200, right: 230, bottom: 230 });

    fireEvent.pointerDown(target, { clientX: 215, clientY: 215, pointerId: 1 });
    fireEvent.pointerMove(target, { clientX: 145, clientY: 145, pointerId: 1 });
    fireEvent.pointerUp(target, { clientX: 145, clientY: 145, pointerId: 1 });

    const node = findNodeById(useEditorStore.getState().document, "free-a");
    expect(node?.freeLayout).toEqual({ x: 130, y: 130, width: 30, height: 30 });
  });
});
