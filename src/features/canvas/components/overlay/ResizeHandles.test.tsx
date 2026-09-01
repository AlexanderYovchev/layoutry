import { fireEvent, render } from "@testing-library/react";
import { useRef, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { selectionFromSingle } from "@/features/editor/types/selection";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { ResizeHandles } from "./ResizeHandles";
import type { MeasuredNodeRect } from "@/features/canvas/hooks/useMeasuredNodeRect";
import { DEFAULT_RESIZE_CONSTRAINTS } from "@/features/editor/types/resize";

const initialState = useEditorStore.getState();

const rect: MeasuredNodeRect = { top: 150, left: 300, width: 200, height: 100 };

// No data-node-id in this harness's DOM means resolveResizeBounds's
// querySelector lookup finds nothing, and useResizeSession falls back to
// unbounded — exactly what the direction-math tests below want, since
// they're only proving per-handle math, not boundary clamping (that gets
// its own dedicated harness further down).
function UnboundedHarness({ children }: { children: ReactNode }) {
  const canvasRootRef = useRef<HTMLDivElement>(null);
  return <div ref={canvasRootRef}>{children}</div>;
}

// heading-1 uses the generic resize floor every tag now shares (Checkpoint
// 1.12.1 removed the bigger, per-tag-category container floor — see
// getResizeConstraintsForTag), so these direction-math/anchor tests
// exercise plain per-handle geometry against that small, shared minimum.
function renderHandles(overrides: Partial<{ offsetX: number; offsetY: number }> = {}) {
  return render(
    <UnboundedHarness>
      <ResizeHandles
        nodeId="heading-1"
        rect={rect}
        offsetX={overrides.offsetX ?? 0}
        offsetY={overrides.offsetY ?? 0}
        canvasRootRef={{ current: document.body }}
      />
    </UnboundedHarness>,
  );
}

describe("ResizeHandles", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useEditorStore.setState(initialState, true);
  });

  it("renders all 8 handle directions", () => {
    renderHandles();

    for (const direction of ["n", "ne", "e", "se", "s", "sw", "w", "nw"]) {
      expect(document.querySelector(`[data-resize-handle="${direction}"]`)).toBeInTheDocument();
    }
  });

  it("grows the node's width when dragging the east handle right, without moving offsetX", () => {
    renderHandles();
    const handle = document.querySelector('[data-resize-handle="e"]') as Element;

    fireEvent.pointerDown(handle, { clientX: 500, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 560, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 560, clientY: 300, pointerId: 1 });

    const section = findNodeById(useEditorStore.getState().document, "heading-1");
    expect(section?.dimensions).toEqual({ preferredWidth: 260, preferredHeight: 100, offsetX: 0, offsetY: 0 });
  });

  it("grows the node's height when dragging the south handle down", () => {
    renderHandles();
    const handle = document.querySelector('[data-resize-handle="s"]') as Element;

    fireEvent.pointerDown(handle, { clientX: 500, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 500, clientY: 340, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 500, clientY: 340, pointerId: 1 });

    const section = findNodeById(useEditorStore.getState().document, "heading-1");
    expect(section?.dimensions).toEqual({ preferredWidth: 200, preferredHeight: 140, offsetX: 0, offsetY: 0 });
  });

  it("drives both axes at once when dragging a diagonal (south-east) handle", () => {
    renderHandles();
    const handle = document.querySelector('[data-resize-handle="se"]') as Element;

    fireEvent.pointerDown(handle, { clientX: 500, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 540, clientY: 330, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 540, clientY: 330, pointerId: 1 });

    const section = findNodeById(useEditorStore.getState().document, "heading-1");
    expect(section?.dimensions).toEqual({ preferredWidth: 240, preferredHeight: 130, offsetX: 0, offsetY: 0 });
  });

  it("grows width and shifts offsetX left when dragging the west handle left (true left-edge growth)", () => {
    renderHandles();
    const handle = document.querySelector('[data-resize-handle="w"]') as Element;

    fireEvent.pointerDown(handle, { clientX: 500, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 440, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 440, clientY: 300, pointerId: 1 });

    const section = findNodeById(useEditorStore.getState().document, "heading-1");
    expect(section?.dimensions).toEqual({ preferredWidth: 260, preferredHeight: 100, offsetX: -60, offsetY: 0 });
    // right edge (startLeft + startWidth) must stay put
    const renderedRight = rect.left + section!.dimensions!.offsetX + section!.dimensions!.preferredWidth;
    expect(renderedRight).toBe(rect.left + rect.width);
  });

  it("composes a west drag onto a pre-existing offsetX from an earlier resize", () => {
    renderHandles({ offsetX: -20 });
    const handle = document.querySelector('[data-resize-handle="w"]') as Element;

    fireEvent.pointerDown(handle, { clientX: 500, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 440, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 440, clientY: 300, pointerId: 1 });

    const section = findNodeById(useEditorStore.getState().document, "heading-1");
    expect(section?.dimensions?.offsetX).toBe(-80);
  });

  it("clamps to the minimum size instead of shrinking past it", () => {
    renderHandles();
    const handle = document.querySelector('[data-resize-handle="e"]') as Element;

    fireEvent.pointerDown(handle, { clientX: 500, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 0, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 0, clientY: 300, pointerId: 1 });

    const section = findNodeById(useEditorStore.getState().document, "heading-1");
    expect(section?.dimensions?.preferredWidth).toBe(DEFAULT_RESIZE_CONSTRAINTS.minWidth);
  });

  it("marks the dragged handle active while resizing", () => {
    renderHandles();
    const handle = document.querySelector('[data-resize-handle="e"]') as Element;

    fireEvent.pointerDown(handle, { clientX: 500, clientY: 300, pointerId: 1 });
    expect(handle.className).toContain("bg-blue-500");

    fireEvent.pointerUp(handle, { clientX: 500, clientY: 300, pointerId: 1 });
    expect(handle.className).not.toContain("bg-blue-500");
  });

  it("stops a handle click from bubbling to a window click listener (which would otherwise clear selection)", () => {
    const onWindowClick = vi.fn();
    window.addEventListener("click", onWindowClick);
    renderHandles();
    const handle = document.querySelector('[data-resize-handle="e"]') as Element;

    fireEvent.pointerDown(handle, { clientX: 500, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 500, clientY: 300, pointerId: 1 });
    fireEvent.click(handle);

    expect(onWindowClick).not.toHaveBeenCalled();
    window.removeEventListener("click", onWindowClick);
  });

  it("does not resize an unrelated node", () => {
    renderHandles();
    const handle = document.querySelector('[data-resize-handle="e"]') as Element;

    fireEvent.pointerDown(handle, { clientX: 500, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 560, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 560, clientY: 300, pointerId: 1 });

    const otherSection = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-2");
    expect(otherSection?.dimensions).toBeUndefined();
  });
});

describe("ResizeHandles boundary clamping (wired end-to-end through the DOM)", () => {
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

  function BoundedHarness() {
    const canvasRootRef = useRef<HTMLDivElement>(null);
    return (
      <div ref={canvasRootRef} data-testid="canvas-root">
        <div data-node-id="page-root">
          <div data-node-id="section-1" />
        </div>
        <ResizeHandles
          nodeId="section-1"
          rect={rect}
          offsetX={0}
          offsetY={0}
          canvasRootRef={canvasRootRef}
        />
      </div>
    );
  }

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

  it("clamps east growth at the containing block's right edge instead of overflowing it", () => {
    const { container } = render(<BoundedHarness />);
    const canvasRoot = container.querySelector('[data-testid="canvas-root"]') as HTMLElement;
    const pageRoot = container.querySelector('[data-node-id="page-root"]') as HTMLElement;
    stubRect(canvasRoot, { left: 0, top: 0, right: 900, bottom: 600 });
    // page sheet's right content edge sits at 560 — only 60px of headroom past rect's own right edge (500)
    stubRect(pageRoot, { left: 0, top: 0, right: 560, bottom: 600 });

    const handle = container.querySelector('[data-resize-handle="e"]') as Element;
    fireEvent.pointerDown(handle, { clientX: 500, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 10000, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 10000, clientY: 300, pointerId: 1 });

    const section = useEditorStore
      .getState()
      .document.children?.find((child) => child.id === "section-1");
    expect(section?.dimensions?.preferredWidth).toBe(260);
  });
});

describe("ResizeHandles — Free container child scaling (Checkpoint 3.4.4)", () => {
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

  function stubClientSize(el: Element, width: number, height: number) {
    Object.defineProperty(el, "clientWidth", { value: width, configurable: true });
    Object.defineProperty(el, "clientHeight", { value: height, configurable: true });
  }

  function FreeContainerHarness() {
    const canvasRootRef = useRef<HTMLDivElement>(null);
    return (
      <div ref={canvasRootRef} data-testid="canvas-root">
        <div data-node-id="page-root">
          <div data-node-id="section-1" />
        </div>
        <ResizeHandles nodeId="section-1" rect={rect} offsetX={0} offsetY={0} canvasRootRef={canvasRootRef} />
      </div>
    );
  }

  function makeSection1FreeWithChildren() {
    useEditorStore.getState().convertToFreeLayout("section-1", {
      "heading-1": { x: 16, y: 16, width: 240, height: 64 },
      "paragraph-1": { x: 16, y: 80, width: 240, height: 80 },
    });
  }

  it("proportionally scales every direct child when the Free container itself is resized (default 'scale' policy)", () => {
    makeSection1FreeWithChildren();
    const { container } = render(<FreeContainerHarness />);
    const canvasRoot = container.querySelector('[data-testid="canvas-root"]') as HTMLElement;
    const pageRoot = container.querySelector('[data-node-id="page-root"]') as HTMLElement;
    const sectionEl = container.querySelector('[data-node-id="section-1"]') as HTMLElement;
    stubRect(canvasRoot, { left: 0, top: 0, right: 900, bottom: 600 });
    stubRect(pageRoot, { left: 0, top: 0, right: 900, bottom: 600 });
    stubClientSize(sectionEl, 200, 100); // matches rect (200x100) — no border/padding inset

    const handle = container.querySelector('[data-resize-handle="e"]') as Element;
    fireEvent.pointerDown(handle, { clientX: 500, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 700, clientY: 300, pointerId: 1 }); // width 200 -> 400, scaleX = 2
    fireEvent.pointerUp(handle, { clientX: 700, clientY: 300, pointerId: 1 });

    const section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(section?.dimensions?.preferredWidth).toBe(400);
    expect(section?.children?.find((c) => c.id === "heading-1")?.freeLayout).toEqual({
      x: 32,
      y: 16,
      width: 480,
      height: 64,
    });
    // scaleY is 1 (only width changed) — untouched.
    expect(section?.children?.find((c) => c.id === "paragraph-1")?.freeLayout).toEqual({
      x: 32,
      y: 80,
      width: 480,
      height: 80,
    });
  });

  it("re-clamps (never scales) children under the 'clamp' policy", () => {
    makeSection1FreeWithChildren();
    useEditorStore.getState().setChildResizePolicy("section-1", "clamp");
    const { container } = render(<FreeContainerHarness />);
    const canvasRoot = container.querySelector('[data-testid="canvas-root"]') as HTMLElement;
    const pageRoot = container.querySelector('[data-node-id="page-root"]') as HTMLElement;
    const sectionEl = container.querySelector('[data-node-id="section-1"]') as HTMLElement;
    stubRect(canvasRoot, { left: 0, top: 0, right: 900, bottom: 600 });
    stubRect(pageRoot, { left: 0, top: 0, right: 900, bottom: 600 });
    stubClientSize(sectionEl, 200, 100);

    const handle = container.querySelector('[data-resize-handle="e"]') as Element;
    fireEvent.pointerDown(handle, { clientX: 500, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 700, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 700, clientY: 300, pointerId: 1 });

    const section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    // Growing never needs to clamp anything — children keep their exact original geometry.
    expect(section?.children?.find((c) => c.id === "heading-1")?.freeLayout).toEqual({
      x: 16,
      y: 16,
      width: 240,
      height: 64,
    });
  });

  it("floors the container's own shrink at 25% of its starting content size, stopping children from becoming unreadably tiny", () => {
    makeSection1FreeWithChildren();
    const { container } = render(<FreeContainerHarness />);
    const canvasRoot = container.querySelector('[data-testid="canvas-root"]') as HTMLElement;
    const pageRoot = container.querySelector('[data-node-id="page-root"]') as HTMLElement;
    const sectionEl = container.querySelector('[data-node-id="section-1"]') as HTMLElement;
    stubRect(canvasRoot, { left: 0, top: 0, right: 900, bottom: 600 });
    stubRect(pageRoot, { left: 0, top: 0, right: 900, bottom: 600 });
    stubClientSize(sectionEl, 200, 100);

    const handle = container.querySelector('[data-resize-handle="e"]') as Element;
    fireEvent.pointerDown(handle, { clientX: 500, clientY: 300, pointerId: 1 });
    // Try to shrink far past 25% of the starting 200px width (would be 50px).
    fireEvent.pointerMove(handle, { clientX: 0, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 0, clientY: 300, pointerId: 1 });

    const section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    // The 25% MIN_FREE_CONTAINER_SCALE floor (50) is what stops this shrink
    // from reaching near-zero — the generic resize floor (Checkpoint
    // 1.12.1) is much smaller than 50 now, so this scenario is really only
    // exercising computeContainerChildScaling's own floor, not resizeNode's.
    expect(section?.dimensions?.preferredWidth).toBeGreaterThanOrEqual(50);
    const heading = section?.children?.find((c) => c.id === "heading-1");
    expect(heading?.freeLayout?.width).toBeGreaterThan(0);
  });

  it("does not affect an ordinary Flow container's resize (no children, no layoutMode) — existing behavior unchanged", () => {
    const { container } = render(<FreeContainerHarness />);
    const canvasRoot = container.querySelector('[data-testid="canvas-root"]') as HTMLElement;
    const pageRoot = container.querySelector('[data-node-id="page-root"]') as HTMLElement;
    stubRect(canvasRoot, { left: 0, top: 0, right: 900, bottom: 600 });
    stubRect(pageRoot, { left: 0, top: 0, right: 900, bottom: 600 });

    const handle = container.querySelector('[data-resize-handle="e"]') as Element;
    fireEvent.pointerDown(handle, { clientX: 500, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 560, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 560, clientY: 300, pointerId: 1 });

    const section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    // Height (100) stays exactly as measured — the generic resize floor
    // (Checkpoint 1.12.1) is far below 100, so resizeNode's defensive
    // clamp has nothing to do here even though it always re-applies to
    // both axes regardless of which handle was actually dragged.
    expect(section?.dimensions).toEqual({ preferredWidth: 260, preferredHeight: 100, offsetX: 0, offsetY: 0 });
  });
});

describe("ResizeHandles history transactions (Checkpoint 3.4.3)", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useEditorStore.setState(initialState, true);
  });

  it("a full drag (many pointermove frames) produces exactly one history entry", () => {
    renderHandles();
    const handle = document.querySelector('[data-resize-handle="e"]') as Element;

    fireEvent.pointerDown(handle, { clientX: 500, clientY: 300, pointerId: 1 });
    for (let x = 505; x <= 560; x += 5) {
      fireEvent.pointerMove(handle, { clientX: x, clientY: 300, pointerId: 1 });
    }
    fireEvent.pointerUp(handle, { clientX: 560, clientY: 300, pointerId: 1 });

    expect(useEditorStore.getState().past).toHaveLength(1);
  });

  it("a plain click on the handle (pointerdown immediately followed by pointerup, no pointermove) commits nothing and records no history (Checkpoint 5.7 regression — found live via undo/redo verification: this previously materialized explicit dimensions from the node's current rendered size and pushed a spurious history entry)", () => {
    renderHandles();
    const handle = document.querySelector('[data-resize-handle="e"]') as Element;
    const pastLengthBefore = useEditorStore.getState().past.length;

    fireEvent.pointerDown(handle, { clientX: 500, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 500, clientY: 300, pointerId: 1 });

    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore);
    const current = findNodeById(useEditorStore.getState().document, "heading-1");
    expect(current?.dimensions).toBeUndefined();
  });

  it("undo after a completed resize drag reverts the entire drag in one step", () => {
    renderHandles();
    const handle = document.querySelector('[data-resize-handle="e"]') as Element;

    fireEvent.pointerDown(handle, { clientX: 500, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 520, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 560, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 560, clientY: 300, pointerId: 1 });

    useEditorStore.getState().undo();

    const section = findNodeById(useEditorStore.getState().document, "heading-1");
    expect(section?.dimensions).toBeUndefined();
  });

  it("Escape mid-drag cancels the resize: reverts the document and records no history", () => {
    renderHandles();
    const handle = document.querySelector('[data-resize-handle="e"]') as Element;

    fireEvent.pointerDown(handle, { clientX: 500, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 560, clientY: 300, pointerId: 1 });
    fireEvent.keyDown(window, { key: "Escape" });

    const section = findNodeById(useEditorStore.getState().document, "heading-1");
    expect(section?.dimensions).toBeUndefined();
    expect(useEditorStore.getState().past).toHaveLength(0);
    expect(useEditorStore.getState().transactionSnapshot).toBeNull();
  });

  it("Escape mid-drag does not clear the current selection (unlike Escape with no active drag)", () => {
    useEditorStore.setState({ selection: selectionFromSingle("section-1") });
    renderHandles();
    const handle = document.querySelector('[data-resize-handle="e"]') as Element;

    fireEvent.pointerDown(handle, { clientX: 500, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 560, clientY: 300, pointerId: 1 });
    fireEvent.keyDown(window, { key: "Escape" });

    expect(useEditorStore.getState().selection.primaryId).toBe("section-1");
  });

  it("Escape with no active drag does not touch history or the transaction state", () => {
    renderHandles();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(useEditorStore.getState().past).toHaveLength(0);
    expect(useEditorStore.getState().transactionSnapshot).toBeNull();
  });
});
