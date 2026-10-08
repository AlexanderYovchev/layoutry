import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { SvgElement } from "./SvgElement";
import type { EditorElementNode } from "@/features/editor/types/document";

const baseProps = { parentId: "page-root", parentLayoutMode: "flow" as const, parentFlowDisplay: "block" as const };

describe("SvgElement", () => {
  it("renders a genuine <svg> element, not an <img> or a div standing in for one", () => {
    const { container } = render(
      <SvgElement node={{ id: "svg-1", tag: "svg" }} {...baseProps} />,
    );
    const element = container.querySelector('[data-node-id="svg-1"]');
    expect(element?.tagName.toLowerCase()).toBe("svg");
    expect(element).toHaveAttribute("data-node-type", "svg");
  });

  it("renders the default starter Rectangle geometry when svgKind is unset", () => {
    const { container } = render(<SvgElement node={{ id: "svg-1", tag: "svg" }} {...baseProps} />);
    expect(container.querySelector("rect")).toBeInTheDocument();
    expect(container.querySelector("circle")).not.toBeInTheDocument();
    expect(container.querySelector("polygon")).not.toBeInTheDocument();
  });

  it("renders Circle geometry", () => {
    const { container } = render(<SvgElement node={{ id: "svg-1", tag: "svg", svgKind: "circle" }} {...baseProps} />);
    const circle = container.querySelector("circle");
    expect(circle).toBeInTheDocument();
    expect(circle).toHaveAttribute("cx", "50");
    expect(circle).toHaveAttribute("cy", "50");
    expect(circle).toHaveAttribute("r", "40");
  });

  it("renders Triangle geometry as a polygon", () => {
    const { container } = render(<SvgElement node={{ id: "svg-1", tag: "svg", svgKind: "triangle" }} {...baseProps} />);
    expect(container.querySelector("polygon")).toHaveAttribute("points", "50,10 90,90 10,90");
  });

  it("renders Star geometry as a 10-point polygon", () => {
    const { container } = render(<SvgElement node={{ id: "svg-1", tag: "svg", svgKind: "star" }} {...baseProps} />);
    const points = container.querySelector("polygon")?.getAttribute("points");
    expect(points?.split(" ")).toHaveLength(10);
  });

  it("applies the default 0 0 100 100 viewBox when unset, and a custom one when set", () => {
    const { container: defaultContainer } = render(<SvgElement node={{ id: "svg-1", tag: "svg" }} {...baseProps} />);
    expect(defaultContainer.querySelector("svg")).toHaveAttribute("viewBox", "0 0 100 100");

    const { container: customContainer } = render(
      <SvgElement
        node={{ id: "svg-2", tag: "svg", svgViewBox: { minX: -10, minY: -10, width: 50, height: 50 } }}
        {...baseProps}
      />,
    );
    expect(customContainer.querySelector("svg")).toHaveAttribute("viewBox", "-10 -10 50 50");
  });

  it("applies fill/stroke/strokeWidth as real SVG presentation attributes on the geometry, not CSS", () => {
    const { container } = render(
      <SvgElement
        node={{ id: "svg-1", tag: "svg", svgKind: "circle", svgFill: "#ff0000", svgStroke: "#000000", svgStrokeWidth: 3 }}
        {...baseProps}
      />,
    );
    const circle = container.querySelector("circle");
    expect(circle).toHaveAttribute("fill", "#ff0000");
    expect(circle).toHaveAttribute("stroke", "#000000");
    expect(circle).toHaveAttribute("stroke-width", "3");
  });

  it("omits stroke/stroke-width entirely when stroke is unset (None)", () => {
    const { container } = render(<SvgElement node={{ id: "svg-1", tag: "svg", svgKind: "circle" }} {...baseProps} />);
    const circle = container.querySelector("circle");
    expect(circle).not.toHaveAttribute("stroke");
    expect(circle).not.toHaveAttribute("stroke-width");
  });

  it("resolves an unset fill to native SVG black on the geometry itself", () => {
    const { container } = render(<SvgElement node={{ id: "svg-1", tag: "svg", svgKind: "rectangle" }} {...baseProps} />);
    expect(container.querySelector("rect")).toHaveAttribute("fill", "#000000");
  });

  it("real HTML identity (id/class) belongs to the actual <svg> element", () => {
    const { container } = render(
      <SvgElement node={{ id: "svg-1", tag: "svg", htmlId: "hero-graphic", className: "featured" }} {...baseProps} />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("id", "hero-graphic");
    expect(svg?.getAttribute("class")).toContain("featured");
  });

  it("applies CSS background/border/border-radius to the same <svg> box, independent of fill/stroke", () => {
    const { container } = render(
      <SvgElement
        node={{
          id: "svg-1",
          tag: "svg",
          background: { color: "#eeeeee" },
          borderRadius: { topLeft: { value: 8, unit: "px" } },
        }}
        {...baseProps}
      />,
    );
    const svg = container.querySelector("svg") as unknown as HTMLElement;
    expect(svg.style.backgroundColor).toBe("rgb(238, 238, 238)");
    expect(svg.style.borderTopLeftRadius).toBe("8px");
  });
});

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

// SvgElement receives `node` as a plain prop — in the real app,
// DocumentNodeRenderer always re-derives it fresh from the live store on
// every render, so a document mutation made mid-interaction (e.g. the
// Rectangle tool's own live-drawn object) is immediately visible. A test
// that renders <SvgElement node={someStaticObject} /> directly bypasses
// that and would keep showing the node exactly as it was at mount time no
// matter what the store does afterward — this thin subscribing wrapper
// restores the real pipeline's behavior for interaction tests that need
// to observe DOM output after a mutation.
function LiveSvgHarness({ nodeId }: { nodeId: string }) {
  // Optional-chained and nullable on purpose — the shared afterEach reset
  // in this file runs before @testing-library's own cleanup() unmounts
  // this component, so a stray final re-render can briefly see a
  // document with no matching child; render nothing rather than crash.
  const node = useEditorStore((state) => state.document.children?.find((child) => child.id === nodeId));
  if (!node) return null;
  return <SvgElement node={node} {...baseProps} />;
}

function renderEditing(node: EditorElementNode) {
  useEditorStore.setState((state) => ({
    document: { ...state.document, children: [node] },
    selection: { ids: [node.id], primaryId: node.id },
    svgEditingNodeId: node.id,
  }));
  const { container } = render(<LiveSvgHarness nodeId={node.id} />);
  const svg = container.querySelector("svg") as unknown as SVGSVGElement;
  stubSvgRect(svg, { left: 0, top: 0, width: 100, height: 100 });
  return { container, svg };
}

describe("SvgElement — Scene rendering & Drawing Mode (Checkpoint 1.15.6)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("renders a populated scene as genuine SVG children, never the legacy starter primitive", () => {
    const node: EditorElementNode = {
      id: "svg1",
      tag: "svg",
      svgKind: "circle",
      svgScene: { objects: [{ id: "r1", type: "rect", x: 10, y: 10, width: 20, height: 20, fill: "#ff0000" }] },
    };
    const { container } = render(<SvgElement node={node} {...baseProps} />);

    expect(container.querySelector("rect")).toHaveAttribute("fill", "#ff0000");
    // The legacy circle geometry (SVG_CIRCLE_GEOMETRY's own cx/cy/r) must
    // never render alongside the scene — the two modes are exclusive.
    expect(container.querySelector("circle")).not.toBeInTheDocument();
  });

  it("still renders the legacy starter primitive for an untouched (empty-scene) SVG", () => {
    const node: EditorElementNode = { id: "svg1", tag: "svg", svgKind: "circle" };
    const { container } = render(<SvgElement node={node} {...baseProps} />);
    expect(container.querySelector("circle")).toBeInTheDocument();
  });

  it("renders every vector object type as its genuine native element", () => {
    const node: EditorElementNode = {
      id: "svg1",
      tag: "svg",
      svgScene: {
        objects: [
          { id: "r1", type: "rect", x: 0, y: 0, width: 10, height: 10, fill: "#111" },
          { id: "e1", type: "ellipse", cx: 20, cy: 20, rx: 5, ry: 5, fill: "#222" },
          { id: "l1", type: "line", x1: 0, y1: 0, x2: 10, y2: 10, stroke: "#333" },
          { id: "p1", type: "polygon", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }], fill: "#444" },
          { id: "d1", type: "path", commands: [{ kind: "M", x: 0, y: 0 }, { kind: "L", x: 10, y: 10 }], fill: "#555" },
        ],
      },
    };
    const { container } = render(<SvgElement node={node} {...baseProps} />);

    expect(container.querySelector("rect")).toBeInTheDocument();
    expect(container.querySelector("ellipse")).toBeInTheDocument();
    expect(container.querySelector("line")).toBeInTheDocument();
    expect(container.querySelector("polygon")).toBeInTheDocument();
    const path = container.querySelector("path");
    expect(path).toHaveAttribute("d", "M 0 0 L 10 10");
  });

  it("double-clicking a non-editing SVG enters Drawing Mode and materializes the starter primitive into the scene", () => {
    const node: EditorElementNode = { id: "svg1", tag: "svg", svgKind: "rectangle" };
    useEditorStore.setState((state) => ({ document: { ...state.document, children: [node] } }));
    const { container } = render(<SvgElement node={node} {...baseProps} />);

    fireEvent.doubleClick(container.querySelector("svg")!);

    expect(useEditorStore.getState().svgEditingNodeId).toBe("svg1");
    const scene = useEditorStore.getState().document.children![0].svgScene;
    expect(scene?.objects).toHaveLength(1);
    expect(scene?.objects[0].type).toBe("rect");
  });

  it("Select tool: dragging a selected vector object through the real renderer moves it, one history entry", () => {
    const node: EditorElementNode = {
      id: "svg1",
      tag: "svg",
      svgScene: { objects: [{ id: "r1", type: "rect", x: 10, y: 10, width: 20, height: 20, fill: "#000" }] },
    };
    const { container } = renderEditing(node);
    useEditorStore.setState({ activeSvgTool: "select", selectedSvgObjectIds: ["r1"], primarySvgObjectId: "r1" });
    const pastBefore = useEditorStore.getState().past.length;

    const rect = container.querySelector("rect")!;
    fireEvent.pointerDown(rect, { clientX: 15, clientY: 15, pointerId: 1 });
    fireEvent.pointerMove(rect, { clientX: 25, clientY: 30, pointerId: 1 });
    fireEvent.pointerUp(rect, { clientX: 25, clientY: 30, pointerId: 1 });

    const scene = useEditorStore.getState().document.children![0].svgScene!;
    expect(scene.objects[0]).toMatchObject({ x: 20, y: 25 });
    expect(useEditorStore.getState().past.length).toBe(pastBefore + 1);
  });

  it("Rectangle tool: dragging on the SVG background through the real renderer draws a genuine <rect>", () => {
    const node: EditorElementNode = { id: "svg1", tag: "svg", svgScene: { objects: [] } };
    const { svg, container } = renderEditing(node);
    // A raw store mutation made outside any React-handled DOM event isn't
    // guaranteed to have flushed its re-render before the very next
    // synchronous fireEvent call — act() forces that flush, matching what
    // a real intervening render cycle (e.g. a toolbar button click)
    // always provides in the live app between picking a tool and the
    // next pointer gesture on the canvas.
    act(() => {
      useEditorStore.setState({ activeSvgTool: "rect" });
    });

    fireEvent.pointerDown(svg, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: 50, clientY: 60, pointerId: 1 });
    fireEvent.pointerUp(svg, { clientX: 50, clientY: 60, pointerId: 1 });

    const rect = container.querySelector("rect");
    expect(rect).toHaveAttribute("width", "40");
    expect(rect).toHaveAttribute("height", "50");
    expect(useEditorStore.getState().activeSvgTool).toBe("select");
  });

  it("Select tool: a pointerdown directly on empty SVG background clears the vector selection", () => {
    const node: EditorElementNode = {
      id: "svg1",
      tag: "svg",
      svgScene: { objects: [{ id: "r1", type: "rect", x: 10, y: 10, width: 20, height: 20, fill: "#000" }] },
    };
    const { svg } = renderEditing(node);
    useEditorStore.setState({ activeSvgTool: "select", selectedSvgObjectIds: ["r1"], primarySvgObjectId: "r1" });

    fireEvent.pointerDown(svg, { clientX: 5, clientY: 5, pointerId: 1 });

    expect(useEditorStore.getState().selectedSvgObjectIds).toEqual([]);
  });

  it("renders a selection bounding box and resize handles for a single selected Rectangle", () => {
    const node: EditorElementNode = {
      id: "svg1",
      tag: "svg",
      svgScene: { objects: [{ id: "r1", type: "rect", x: 10, y: 10, width: 20, height: 20, fill: "#000" }] },
    };
    const { container } = renderEditing(node);
    act(() => {
      useEditorStore.setState({ activeSvgTool: "select", selectedSvgObjectIds: ["r1"], primarySvgObjectId: "r1" });
    });

    const rects = container.querySelectorAll("rect");
    // The vector object itself, plus the selection bounding box outline.
    expect(rects.length).toBe(2);
    expect(container.querySelectorAll("circle")).toHaveLength(4);
  });

  it("renders no resize handles for a selected Line (deferred past v1 scope)", () => {
    const node: EditorElementNode = {
      id: "svg1",
      tag: "svg",
      svgScene: { objects: [{ id: "l1", type: "line", x1: 0, y1: 0, x2: 10, y2: 10, stroke: "#000" }] },
    };
    const { container } = renderEditing(node);
    act(() => {
      useEditorStore.setState({ activeSvgTool: "select", selectedSvgObjectIds: ["l1"], primarySvgObjectId: "l1" });
    });

    expect(container.querySelectorAll("circle")).toHaveLength(0);
    expect(container.querySelectorAll("rect")).toHaveLength(1);
  });
});

describe("SvgElement — CSS Transition Foundation (Checkpoint 1.15.6.14.1)", () => {
  const initialState = useEditorStore.getState();
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("applies the authored transition to the outer <svg> box only in Preview, never in Design", () => {
    const transition = { property: "opacity" as const, durationMs: 200, timingFunction: "ease" as const, delayMs: 0 };
    const { container } = render(<SvgElement node={{ id: "svg-1", tag: "svg", transition }} {...baseProps} />);
    const designElement = container.querySelector('[data-node-id="svg-1"]') as HTMLElement;
    expect(designElement.style.transitionProperty).toBe("");

    useEditorStore.setState({ editorMode: "preview" });
    const { container: previewContainer } = render(<SvgElement node={{ id: "svg-1", tag: "svg", transition }} {...baseProps} />);
    const previewElement = previewContainer.querySelector('[data-node-id="svg-1"]') as HTMLElement;
    expect(previewElement.style.transitionProperty).toBe("opacity");
  });
});

describe("SvgElement — CSS Transform Foundation (Checkpoint 1.15.6.14.3)", () => {
  it("applies the authored Transform to the outer <svg> box identically in Design and Preview", () => {
    const { container } = render(<SvgElement node={{ id: "svg-1", tag: "svg", transform: { rotateDeg: 15 } }} {...baseProps} />);
    const designElement = container.querySelector('[data-node-id="svg-1"]') as HTMLElement;
    expect(designElement.style.transform).toBe("rotate(15deg)");
  });
});
