import { fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { useSvgObjectResizeSession } from "./useSvgObjectResizeSession";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { SvgRectObject } from "@/features/editor/types/svgScene";

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

function rectObject(overrides: Partial<SvgRectObject> = {}): SvgRectObject {
  return { id: "rect1", type: "rect", x: 10, y: 10, width: 20, height: 20, ...overrides };
}

function Harness({ svgNodeId, objectId }: { svgNodeId: string; objectId: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { getHandleHandlers } = useSvgObjectResizeSession(svgNodeId);
  // The anchor for the "se" handle held by these tests is the opposite
  // (nw) corner of the seeded rect1 object (x:10,y:10,width:20,height:20).
  const handlers = getHandleHandlers(objectId, "se", { x: 10, y: 10 });
  return (
    <svg ref={svgRef} viewBox="0 0 100 100" data-testid="svg">
      <circle data-testid="handle" cx={30} cy={30} r={2} {...handlers} />
    </svg>
  );
}

function setup(node: EditorElementNode) {
  useEditorStore.setState((state) => ({
    document: { ...state.document, children: [node] },
    // The module-level auto-exit subscription reverts svgEditingNodeId/
    // selectedSvgObjectIds the instant selection.primaryId doesn't match —
    // seed the outer selection here too, exactly like enterSvgEditMode.
    selection: { ids: [node.id], primaryId: node.id },
    svgEditingNodeId: node.id,
    selectedSvgObjectIds: ["rect1"],
    primarySvgObjectId: "rect1",
  }));
  const { container } = render(<Harness svgNodeId={node.id} objectId="rect1" />);
  const svg = container.querySelector('[data-testid="svg"]') as unknown as SVGSVGElement;
  const handle = container.querySelector('[data-testid="handle"]') as unknown as SVGElement;
  stubSvgRect(svg, { left: 0, top: 0, width: 100, height: 100 });
  return { svg, handle };
}

function svgNode(overrides: Partial<EditorElementNode> = {}): EditorElementNode {
  return { id: "svg1", tag: "svg", svgScene: { objects: [rectObject()] }, ...overrides };
}

describe("useSvgObjectResizeSession", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("Rectangle: dragging the se handle resizes it, one history entry", () => {
    const { handle } = setup(svgNode());
    const pastBefore = useEditorStore.getState().past.length;

    fireEvent.pointerDown(handle, { clientX: 30, clientY: 30, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 50, clientY: 60, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 50, clientY: 60, pointerId: 1 });

    const scene = useEditorStore.getState().document.children![0].svgScene!;
    expect(scene.objects[0]).toMatchObject({ x: 10, y: 10, width: 40, height: 50 });
    expect(useEditorStore.getState().past.length).toBe(pastBefore + 1);
  });

  it("a plain click on the handle with zero movement commits nothing — no spurious history entry", () => {
    const { handle } = setup(svgNode());
    const pastBefore = useEditorStore.getState().past.length;
    const objectBefore = useEditorStore.getState().document.children![0].svgScene!.objects[0];

    fireEvent.pointerDown(handle, { clientX: 30, clientY: 30, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 30, clientY: 30, pointerId: 1 });

    expect(useEditorStore.getState().past.length).toBe(pastBefore);
    expect(useEditorStore.getState().document.children![0].svgScene!.objects[0]).toEqual(objectBefore);
  });

  it("Escape mid-resize cancels the whole gesture and restores prior geometry", () => {
    const { handle } = setup(svgNode());
    const pastBefore = useEditorStore.getState().past.length;
    const objectBefore = useEditorStore.getState().document.children![0].svgScene!.objects[0];

    fireEvent.pointerDown(handle, { clientX: 30, clientY: 30, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 60, clientY: 60, pointerId: 1 });
    fireEvent.keyDown(window, { key: "Escape" });

    expect(useEditorStore.getState().past.length).toBe(pastBefore);
    expect(useEditorStore.getState().document.children![0].svgScene!.objects[0]).toEqual(objectBefore);
  });
});
