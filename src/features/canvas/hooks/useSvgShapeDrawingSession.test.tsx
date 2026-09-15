import { fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { useSvgShapeDrawingSession } from "./useSvgShapeDrawingSession";
import type { EditorElementNode } from "@/features/editor/types/document";

const initialState = useEditorStore.getState();

function stubSvgRect(svg: SVGSVGElement, box: { left: number; top: number; width: number; height: number }) {
  vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
    ...box,
    right: box.left + box.width,
    bottom: box.top + box.height,
    x: box.left,
    y: box.top,
    toJSON: () => box,
  });
}

function Harness({ svgNode }: { svgNode: EditorElementNode }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { onPointerDown } = useSvgShapeDrawingSession(svgNode, svgRef);
  // Move/up/cancel are tracked via window-level listeners the hook installs
  // itself on pointerdown (see the hook's own top comment for why — native
  // setPointerCapture on the <svg> root was found to hang Chromium's
  // synthetic-input dispatch under real browser automation) — only
  // onPointerDown is ever wired to the element itself.
  return <svg ref={svgRef} viewBox="0 0 100 100" data-testid="svg" onPointerDown={onPointerDown} />;
}

function svgNode(overrides: Partial<EditorElementNode> = {}): EditorElementNode {
  return { id: "svg1", tag: "svg", ...overrides };
}

describe("useSvgShapeDrawingSession", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  // Sets SVG Edit Mode's own UI state directly rather than going through
  // enterSvgEditMode (which would materialize a starter Rectangle for any
  // node with no scene yet — a concern these drawing-session tests don't
  // care about and would otherwise leave an extra, unrelated object in
  // every scene).
  function setup(node: EditorElementNode) {
    useEditorStore.setState((state) => ({
      document: { ...state.document, children: [node] },
      // The module-level auto-exit subscription reverts svgEditingNodeId
      // the instant selection.primaryId doesn't match it — seed the outer
      // selection here too, exactly like enterSvgEditMode itself does.
      selection: { ids: [node.id], primaryId: node.id },
      svgEditingNodeId: node.id,
    }));
    const { container } = render(<Harness svgNode={node} />);
    const svg = container.querySelector('[data-testid="svg"]') as unknown as SVGSVGElement;
    stubSvgRect(svg, { left: 0, top: 0, width: 100, height: 100 });
    return svg;
  }

  it("Rectangle: drag creates a real rect, one history entry, returns to Select", () => {
    const svg = setup(svgNode());
    useEditorStore.getState().setActiveSvgTool("rect");
    const pastBefore = useEditorStore.getState().past.length;

    fireEvent.pointerDown(svg, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 50, clientY: 60, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 50, clientY: 60, pointerId: 1 });

    const scene = useEditorStore.getState().document.children![0].svgScene!;
    expect(scene.objects).toHaveLength(1);
    expect(scene.objects[0]).toMatchObject({ type: "rect", x: 10, y: 10, width: 40, height: 50 });
    expect(useEditorStore.getState().past.length).toBe(pastBefore + 1);
    expect(useEditorStore.getState().activeSvgTool).toBe("select");
    expect(useEditorStore.getState().selectedSvgObjectIds).toEqual([scene.objects[0].id]);
  });

  it("Rectangle: a tiny accidental drag is discarded — zero history, zero objects", () => {
    const svg = setup(svgNode());
    useEditorStore.getState().setActiveSvgTool("rect");
    const pastBefore = useEditorStore.getState().past.length;

    fireEvent.pointerDown(svg, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 11, clientY: 11, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 11, clientY: 11, pointerId: 1 });

    expect(useEditorStore.getState().document.children![0].svgScene?.objects ?? []).toHaveLength(0);
    expect(useEditorStore.getState().past.length).toBe(pastBefore);
    expect(useEditorStore.getState().selectedSvgObjectIds).toEqual([]);
  });

  it("Ellipse: drag creates a real ellipse (not degenerate despite having no 'width' field)", () => {
    const svg = setup(svgNode());
    useEditorStore.getState().setActiveSvgTool("ellipse");

    fireEvent.pointerDown(svg, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 50, clientY: 50, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 50, clientY: 50, pointerId: 1 });

    const scene = useEditorStore.getState().document.children![0].svgScene!;
    expect(scene.objects).toHaveLength(1);
    expect(scene.objects[0].type).toBe("ellipse");
  });

  it("Line: drag creates a real line with a visible default stroke, never a fill", () => {
    const svg = setup(svgNode());
    useEditorStore.getState().setActiveSvgTool("line");

    fireEvent.pointerDown(svg, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 40, clientY: 40, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 40, clientY: 40, pointerId: 1 });

    const scene = useEditorStore.getState().document.children![0].svgScene!;
    expect(scene.objects[0]).toMatchObject({ type: "line", x1: 10, y1: 10, x2: 40, y2: 40 });
    expect(scene.objects[0].fill).toBeUndefined();
    expect(scene.objects[0].stroke).toBeTruthy();
  });

  it("a new object inherits the SVG's own current fill/stroke as creation defaults", () => {
    const svg = setup(svgNode({ svgFill: "#ff0000" }));
    useEditorStore.getState().setActiveSvgTool("rect");

    fireEvent.pointerDown(svg, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 50, clientY: 50, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 50, clientY: 50, pointerId: 1 });

    expect(useEditorStore.getState().document.children![0].svgScene!.objects[0].fill).toBe("#ff0000");
  });

  it("Escape mid-drag cancels the whole gesture — zero history, zero objects", () => {
    const svg = setup(svgNode());
    useEditorStore.getState().setActiveSvgTool("rect");
    const pastBefore = useEditorStore.getState().past.length;

    fireEvent.pointerDown(svg, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 50, clientY: 50, pointerId: 1 });
    fireEvent.keyDown(window, { key: "Escape" });

    expect(useEditorStore.getState().document.children![0].svgScene?.objects ?? []).toHaveLength(0);
    expect(useEditorStore.getState().past.length).toBe(pastBefore);
  });

  it("ignores pointerdown entirely while the Select tool is active", () => {
    const svg = setup(svgNode());
    useEditorStore.getState().setActiveSvgTool("select");

    fireEvent.pointerDown(svg, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 50, clientY: 50, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 50, clientY: 50, pointerId: 1 });

    expect(useEditorStore.getState().document.children![0].svgScene?.objects ?? []).toHaveLength(0);
  });
});
