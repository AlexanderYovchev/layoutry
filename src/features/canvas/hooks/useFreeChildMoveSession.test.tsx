import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
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

interface RenderedTarget {
  id: string;
  /** Measured border box (client = local here: the container sits at 0,0 with no border). */
  rect: { left: number; top: number; right: number; bottom: number };
  children?: RenderedTarget[];
}

function TargetElement({ target }: { target: RenderedTarget }) {
  return (
    <div data-node-id={target.id}>
      {target.children?.map((child) => <TargetElement key={child.id} target={child} />)}
    </div>
  );
}

function Harness({ nodeId = "free-a", targets = [] }: { nodeId?: string; targets?: RenderedTarget[] }) {
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
      {targets.map((target) => <TargetElement key={target.id} target={target} />)}
    </div>
  );
}

/**
 * Checkpoint 1.15.6.1.1 Snap; BC-13.3 — the Free drag on the shared engine:
 * DOM-measured targets (siblings, nested, locked; hidden excluded), the 6px
 * threshold, hysteresis, margins, equal spacing, Alt bypass, Shift axis
 * lock, containment rejection, guides with Snap off, one Undo step.
 */
describe("useFreeChildMoveSession", () => {
  let frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 1;
  /** Runs the pending animation frame(s), as the browser would before the next paint. */
  const flush = () => {
    const pending = [...frames.values()];
    frames = new Map();
    for (const callback of pending) callback(0);
  };
  const move = (target: HTMLElement, x: number, y: number, modifiers: { altKey?: boolean; shiftKey?: boolean } = {}) => {
    fireEvent.pointerMove(target, { clientX: x, clientY: y, pointerId: 1, ...modifiers });
    flush();
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

  type Seed = { id: string; x: number; y: number; width: number; height: number; extra?: Partial<EditorElementNode>; children?: EditorElementNode[] };

  function seedDocument(children: Seed[], container: Partial<EditorElementNode> = {}) {
    useEditorStore.setState((state) => ({
      document: {
        ...state.document,
        children: [
          {
            id: "free-container-1",
            tag: "div",
            layoutMode: "free",
            ...container,
            children: children.map((c) => ({
              id: c.id,
              tag: "div",
              freeLayout: { x: c.x, y: c.y, width: c.width, height: c.height },
              ...c.extra,
              ...(c.children ? { children: c.children } : {}),
            })),
          },
        ],
      },
    }));
  }

  /** Renders the container (500×400 at the origin), the mover, and measured targets. */
  function setupDom(options: { nodeId?: string; targets?: RenderedTarget[]; mover?: { left: number; top: number; right: number; bottom: number }; paddingRight?: number } = {}) {
    const nodeId = options.nodeId ?? "free-a";
    const { container } = render(<Harness nodeId={nodeId} targets={options.targets} />);
    const containerEl = container.querySelector('[data-node-id="free-container-1"]') as HTMLElement;
    if (options.paddingRight) containerEl.style.paddingRight = `${options.paddingRight}px`;
    stubRect(containerEl, { left: 0, top: 0, right: 500, bottom: 400 });
    stubClientSize(containerEl, 500, 400);
    const stubAll = (targets: RenderedTarget[]) => {
      for (const target of targets) {
        stubRect(container.querySelector(`[data-node-id="${target.id}"]`)!, target.rect);
        if (target.children) stubAll(target.children);
      }
    };
    stubAll(options.targets ?? []);
    const target = container.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement;
    stubRect(target, options.mover ?? { left: 200, top: 200, right: 230, bottom: 230 });
    return { container, containerEl, target };
  }

  const geometry = (id = "free-a") => findNodeById(useEditorStore.getState().document, id)?.freeLayout;
  const guides = () => useEditorStore.getState().activeSnapGuides;
  // Start the 30×30 mover at (200,200), pointer at (215,215): stored x = 200 + (clientX − 215).
  const drag = (target: HTMLElement, moves: { x: number; y: number; altKey?: boolean; shiftKey?: boolean }[], release = true) => {
    fireEvent.pointerDown(target, { clientX: 215, clientY: 215, pointerId: 1 });
    for (const step of moves) move(target, step.x, step.y, { altKey: step.altKey, shiftKey: step.shiftKey });
    const last = moves[moves.length - 1];
    if (release) fireEvent.pointerUp(target, { clientX: last.x, clientY: last.y, pointerId: 1, shiftKey: last.shiftKey });
  };

  it("moves without snapping when far from every target", () => {
    seedDocument([{ id: "free-a", x: 200, y: 200, width: 30, height: 30 }]);
    const { target } = setupDom();
    drag(target, [{ x: 145, y: 145 }]);
    expect(geometry()).toEqual({ x: 130, y: 130, width: 30, height: 30 });
  });

  it("snaps to the parent's left edge within the 6px threshold — and not beyond it (the old 8px no longer applies)", () => {
    seedDocument([{ id: "free-a", x: 200, y: 200, width: 30, height: 30 }]);
    const { target } = setupDom();
    drag(target, [{ x: 20, y: 145 }]); // raw x 5
    expect(geometry()?.x).toBe(0);
    useEditorStore.setState(initialState, true);
    seedDocument([{ id: "free-a", x: 200, y: 200, width: 30, height: 30 }]);
    const second = setupDom();
    drag(second.target, [{ x: 22.5, y: 145 }]); // raw x 7.5
    expect(geometry()?.x).toBe(7.5);
  });

  it("publishes the guide live (achieved, spanning the parent) and clears it on pointer-up", () => {
    seedDocument([{ id: "free-a", x: 200, y: 200, width: 30, height: 30 }]);
    const { target } = setupDom();
    drag(target, [{ x: 20, y: 145 }], false);
    expect(guides()).toMatchObject({ containerId: "free-container-1", vertical: { coordinate: 0, achieved: true, from: 0, to: 400 } });
    fireEvent.pointerUp(target, { clientX: 20, clientY: 145, pointerId: 1 });
    expect(guides()).toBeNull();
  });

  it("hysteresis: once snapped, the lock holds up to 9px and then releases", () => {
    seedDocument([{ id: "free-a", x: 200, y: 200, width: 30, height: 30 }]);
    const { target } = setupDom();
    drag(target, [{ x: 19, y: 145 }, { x: 22.5, y: 145 }], false); // raw 4 → 0, then raw 7.5 (beyond 6, within 9) → still 0
    expect(geometry()?.x).toBe(0);
    move(target, 24.5, 145); // raw 9.5 → released
    expect(geometry()?.x).toBe(9.5);
    fireEvent.pointerUp(target, { clientX: 24.5, clientY: 145, pointerId: 1 });
  });

  it("snaps to a measured sibling's edge, and leaves the sibling untouched", () => {
    seedDocument([
      { id: "free-a", x: 200, y: 200, width: 30, height: 30 },
      { id: "free-b", x: 100, y: 50, width: 40, height: 40 },
    ]);
    const { target } = setupDom({ targets: [{ id: "free-b", rect: { left: 100, top: 50, right: 140, bottom: 90 } }] });
    drag(target, [{ x: 113, y: 145 }]); // raw x 98 → 100
    expect(geometry()?.x).toBe(100);
    expect(geometry("free-b")).toEqual({ x: 100, y: 50, width: 40, height: 40 });
  });

  it("nested descendants and style-locked elements are targets; hidden elements are not", () => {
    const nested: EditorElementNode = { id: "deep", tag: "p", text: "Deep" };
    seedDocument([
      { id: "free-a", x: 200, y: 200, width: 30, height: 30 },
      { id: "box", x: 280, y: 20, width: 150, height: 100, extra: { lockChildStyles: true }, children: [nested] },
      { id: "ghost", x: 60, y: 300, width: 40, height: 40, extra: { display: { display: "none" } } },
    ]);
    const { target } = setupDom({
      targets: [
        { id: "box", rect: { left: 280, top: 20, right: 430, bottom: 120 }, children: [{ id: "deep", rect: { left: 330, top: 40, right: 380, bottom: 60 } }] },
        { id: "ghost", rect: { left: 60, top: 300, right: 100, bottom: 340 } },
      ],
    });
    drag(target, [{ x: 344, y: 145 }]); // raw x 329: its left edge is 1 from the nested element's left edge (330)
    expect(geometry()?.x).toBe(330);
    useEditorStore.setState(initialState, true);
    seedDocument([
      { id: "free-a", x: 200, y: 200, width: 30, height: 30 },
      { id: "ghost", x: 60, y: 300, width: 40, height: 40, extra: { display: { display: "none" } } },
    ]);
    const second = setupDom({ targets: [{ id: "ghost", rect: { left: 60, top: 300, right: 100, bottom: 340 } }] });
    drag(second.target, [{ x: 72, y: 145 }]); // raw x 57: 3 from the hidden box's left edge → no snap
    expect(geometry()?.x).toBe(57);
  });

  it("aligns the visible border box: a mover with a margin snaps its rendered edge, and the stored x keeps the margin out", () => {
    seedDocument([
      { id: "free-a", x: 200, y: 200, width: 30, height: 30, extra: { spacing: { margin: { left: 8, top: 0 } } } },
      { id: "free-b", x: 100, y: 50, width: 40, height: 40 },
    ]);
    const { target } = setupDom({ mover: { left: 208, top: 200, right: 238, bottom: 230 }, targets: [{ id: "free-b", rect: { left: 100, top: 50, right: 140, bottom: 90 } }] });
    drag(target, [{ x: 105, y: 145 }]); // stored raw 90 → rendered 98 → snaps to 100 → stored 92
    expect(geometry()?.x).toBe(92);
  });

  it("equal spacing: the mover snaps one equal gap after a pair, and the indicator shows the gaps", () => {
    seedDocument([
      { id: "free-a", x: 400, y: 300, width: 100, height: 50 },
      { id: "a", x: 0, y: 300, width: 100, height: 50 },
      { id: "b", x: 140, y: 300, width: 100, height: 50 },
    ]);
    const { target } = setupDom({
      mover: { left: 400, top: 300, right: 500, bottom: 350 },
      targets: [
        { id: "a", rect: { left: 0, top: 300, right: 100, bottom: 350 } },
        { id: "b", rect: { left: 140, top: 300, right: 240, bottom: 350 } },
      ],
    });
    // pointer down at (215,215) → stored x = 400 + (clientX − 215); raw x 276 → 280 (240 + 40).
    fireEvent.pointerDown(target, { clientX: 215, clientY: 215, pointerId: 1 });
    move(target, 91, 215);
    expect(geometry()?.x).toBe(280);
    expect(guides()?.spacing[0]).toMatchObject({ axis: "x", value: 40, achieved: true, gaps: [{ from: 100, to: 140 }, { from: 240, to: 280 }] });
    fireEvent.pointerUp(target, { clientX: 91, clientY: 215, pointerId: 1 });
  });

  it("Alt/Option bypasses snapping but keeps the (nearby) guide; releasing it snaps again without moving the pointer", () => {
    seedDocument([{ id: "free-a", x: 200, y: 200, width: 30, height: 30 }]);
    const { target } = setupDom();
    drag(target, [{ x: 20, y: 145, altKey: true }], false); // raw x 5
    expect(geometry()?.x).toBe(5);
    expect(guides()?.vertical).toMatchObject({ coordinate: 0, achieved: false });
    fireEvent.keyUp(window, { key: "Alt", altKey: false });
    flush();
    expect(geometry()?.x).toBe(0);
    expect(guides()?.vertical).toMatchObject({ coordinate: 0, achieved: true });
    expect(useEditorStore.getState().snapEnabled).toBe(true); // the preference itself is untouched
    fireEvent.pointerUp(target, { clientX: 20, clientY: 145, pointerId: 1 });
  });

  it("with Snap turned off: no snapping, but the alignment is still shown as a nearby guide (D22)", () => {
    seedDocument([{ id: "free-a", x: 200, y: 200, width: 30, height: 30 }]);
    useEditorStore.getState().setSnapEnabled(false);
    const { target } = setupDom();
    drag(target, [{ x: 20, y: 215 }], false);
    expect(geometry()?.x).toBe(5);
    expect(guides()?.vertical).toMatchObject({ coordinate: 0, achieved: false });
    fireEvent.pointerUp(target, { clientX: 20, clientY: 215, pointerId: 1 });
    expect(guides()).toBeNull();
  });

  it("Shift constrains the drag to the dominant axis (no snap on the locked one) and the release click doesn't add to the selection", () => {
    seedDocument([{ id: "free-a", x: 200, y: 200, width: 30, height: 30 }]);
    useEditorStore.getState().setSelection(["free-container-1"]);
    const { target } = setupDom();
    // dx 115 ≫ dy 10: horizontal. y stays 200 (it would otherwise move to 210, near nothing).
    drag(target, [{ x: 100, y: 225, shiftKey: true }]);
    expect(geometry()).toEqual({ x: 85, y: 200, width: 30, height: 30 });
    expect(useEditorStore.getState().selection.ids).toEqual(["free-a"]);
    // A vertical Shift drag near the parent's top edge snaps y; x stays.
    useEditorStore.setState(initialState, true);
    seedDocument([{ id: "free-a", x: 200, y: 200, width: 30, height: 30 }]);
    const second = setupDom();
    drag(second.target, [{ x: 230, y: 19, shiftKey: true }]); // raw y 4 → 0; x locked at 200
    expect(geometry()).toEqual({ x: 200, y: 0, width: 30, height: 30 });
  });

  it("pressing Shift mid-drag keeps the current position of the locked axis (no jump)", () => {
    seedDocument([{ id: "free-a", x: 200, y: 200, width: 30, height: 30 }]);
    const { target } = setupDom();
    fireEvent.pointerDown(target, { clientX: 215, clientY: 215, pointerId: 1 });
    move(target, 150, 160); // (135, 145)
    move(target, 140, 162, { shiftKey: true }); // dx 75 > dy 53 → y stays 145
    expect(geometry()).toEqual({ x: 125, y: 145, width: 30, height: 30 });
    fireEvent.pointerUp(target, { clientX: 140, clientY: 162, pointerId: 1, shiftKey: true });
  });

  it("a candidate the containment rule can't reach is rejected: no snap, no guide", () => {
    // padding-right 20 → containment width 480, max x 450; the parent's right edge (500) is out of reach.
    seedDocument([{ id: "free-a", x: 200, y: 200, width: 30, height: 30 }]);
    const { target } = setupDom({ paddingRight: 20 });
    drag(target, [{ x: 482, y: 145 }], false); // raw x 467 (right 497, 3 from 500)
    expect(geometry()?.x).toBe(450);
    expect(guides()?.vertical?.coordinate).not.toBe(500);
    fireEvent.pointerUp(target, { clientX: 482, clientY: 145, pointerId: 1 });
  });

  it("a snapped move drag is exactly one history entry, and undo restores the pre-drag position", () => {
    seedDocument([{ id: "free-a", x: 200, y: 200, width: 30, height: 30 }]);
    const { target } = setupDom();
    const historyLengthBefore = useEditorStore.getState().past.length;
    drag(target, [{ x: 50, y: 215 }, { x: 20, y: 215 }]);
    expect(useEditorStore.getState().past.length).toBe(historyLengthBefore + 1);
    useEditorStore.getState().undo();
    expect(geometry()).toEqual({ x: 200, y: 200, width: 30, height: 30 });
    useEditorStore.getState().redo();
    expect(geometry()?.x).toBe(0); // Redo restores the snapped geometry, no recalculation
  });

  it("Escape mid-drag restores the original position and clears any active snap guide", () => {
    seedDocument([{ id: "free-a", x: 200, y: 200, width: 30, height: 30 }]);
    const { target } = setupDom();
    drag(target, [{ x: 20, y: 215 }], false);
    expect(guides()).not.toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(geometry()).toEqual({ x: 200, y: 200, width: 30, height: 30 });
    expect(guides()).toBeNull();
  });

  it("a plain click (no movement) commits nothing and leaves no history entry", () => {
    seedDocument([{ id: "free-a", x: 200, y: 200, width: 30, height: 30 }]);
    const { target } = setupDom();
    const historyLengthBefore = useEditorStore.getState().past.length;
    fireEvent.pointerDown(target, { clientX: 215, clientY: 215, pointerId: 1 });
    fireEvent.pointerUp(target, { clientX: 215, clientY: 215, pointerId: 1 });
    expect(useEditorStore.getState().past.length).toBe(historyLengthBefore);
    expect(guides()).toBeNull();
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
