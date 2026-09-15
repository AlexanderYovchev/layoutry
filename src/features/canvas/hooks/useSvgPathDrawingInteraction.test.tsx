import { fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { useSvgPathDrawingInteraction } from "./useSvgPathDrawingInteraction";
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

function Harness() {
  const svgRef = useRef<SVGSVGElement>(null);
  const { onClick, onDoubleClick } = useSvgPathDrawingInteraction(svgRef);
  return <svg ref={svgRef} viewBox="0 0 100 100" data-testid="svg" onClick={onClick} onDoubleClick={onDoubleClick} />;
}

function svgNode(overrides: Partial<EditorElementNode> = {}): EditorElementNode {
  return { id: "svg1", tag: "svg", ...overrides };
}

function setup(node: EditorElementNode) {
  useEditorStore.setState((state) => ({
    document: { ...state.document, children: [node] },
    selection: { ids: [node.id], primaryId: node.id },
    svgEditingNodeId: node.id,
  }));
  const { container } = render(<Harness />);
  const svg = container.querySelector('[data-testid="svg"]') as unknown as SVGSVGElement;
  stubSvgRect(svg, { left: 0, top: 0, width: 100, height: 100 });
  return svg;
}

describe("useSvgPathDrawingInteraction", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("Polygon: clicking 4 times accumulates a draft, finishing (double-click) commits one polygon in one history entry", () => {
    const svg = setup(svgNode());
    useEditorStore.getState().setActiveSvgTool("polygon");
    const pastBefore = useEditorStore.getState().past.length;

    fireEvent.click(svg, { clientX: 10, clientY: 10, detail: 1 });
    expect(useEditorStore.getState().svgDraft?.points).toHaveLength(1);

    fireEvent.click(svg, { clientX: 50, clientY: 10, detail: 1 });
    fireEvent.click(svg, { clientX: 50, clientY: 50, detail: 1 });
    fireEvent.click(svg, { clientX: 10, clientY: 50, detail: 1 });
    expect(useEditorStore.getState().svgDraft?.points).toHaveLength(4);

    fireEvent.doubleClick(svg, { clientX: 10, clientY: 50 });

    const scene = useEditorStore.getState().document.children![0].svgScene!;
    expect(scene.objects).toHaveLength(1);
    expect(scene.objects[0].type).toBe("polygon");
    expect(useEditorStore.getState().svgDraft).toBeNull();
    expect(useEditorStore.getState().past.length).toBe(pastBefore + 1);
    expect(useEditorStore.getState().activeSvgTool).toBe("select");
  });

  it("the second 'click' event of a finishing double-click does not add an unwanted extra point", () => {
    const svg = setup(svgNode());
    useEditorStore.getState().setActiveSvgTool("polygon");

    fireEvent.click(svg, { clientX: 10, clientY: 10, detail: 1 });
    fireEvent.click(svg, { clientX: 50, clientY: 10, detail: 1 });
    fireEvent.click(svg, { clientX: 50, clientY: 50, detail: 1 });
    // The native sequence for a finishing double-click: click(detail=1)
    // already fired above for the third point, then click(detail=2) +
    // dblclick fire together for the same physical second press.
    fireEvent.click(svg, { clientX: 50, clientY: 50, detail: 2 });
    fireEvent.doubleClick(svg, { clientX: 50, clientY: 50 });

    const scene = useEditorStore.getState().document.children![0].svgScene!;
    expect(scene.objects[0].type).toBe("polygon");
    if (scene.objects[0].type === "polygon") {
      expect(scene.objects[0].points).toHaveLength(3);
    }
  });

  it("Pen: clicking twice then finishing commits a path with M/L commands, never a raw 'd' string in the store", () => {
    const svg = setup(svgNode());
    useEditorStore.getState().setActiveSvgTool("pen");

    fireEvent.click(svg, { clientX: 10, clientY: 10, detail: 1 });
    fireEvent.click(svg, { clientX: 50, clientY: 50, detail: 1 });
    fireEvent.doubleClick(svg, { clientX: 50, clientY: 50 });

    const scene = useEditorStore.getState().document.children![0].svgScene!;
    expect(scene.objects[0].type).toBe("path");
    if (scene.objects[0].type === "path") {
      expect(scene.objects[0].commands).toEqual([
        { kind: "M", x: 10, y: 10 },
        { kind: "L", x: 50, y: 50 },
      ]);
    }
  });

  it("Escape cancels an unfinished draft without committing anything", () => {
    const svg = setup(svgNode());
    useEditorStore.getState().setActiveSvgTool("polygon");
    const pastBefore = useEditorStore.getState().past.length;

    fireEvent.click(svg, { clientX: 10, clientY: 10, detail: 1 });
    fireEvent.click(svg, { clientX: 50, clientY: 10, detail: 1 });
    useEditorStore.getState().cancelSvgDraft();

    expect(useEditorStore.getState().svgDraft).toBeNull();
    expect(useEditorStore.getState().document.children![0].svgScene?.objects ?? []).toHaveLength(0);
    expect(useEditorStore.getState().past.length).toBe(pastBefore);
  });

  it("ignores clicks while the Select tool is active", () => {
    const svg = setup(svgNode());
    useEditorStore.getState().setActiveSvgTool("select");

    fireEvent.click(svg, { clientX: 10, clientY: 10, detail: 1 });

    expect(useEditorStore.getState().svgDraft).toBeNull();
  });

  it("double-click with no in-progress draft does nothing", () => {
    const svg = setup(svgNode());
    useEditorStore.getState().setActiveSvgTool("polygon");
    const pastBefore = useEditorStore.getState().past.length;

    fireEvent.doubleClick(svg, { clientX: 10, clientY: 10 });

    expect(useEditorStore.getState().past.length).toBe(pastBefore);
    expect(useEditorStore.getState().document.children![0].svgScene?.objects ?? []).toHaveLength(0);
  });
});
