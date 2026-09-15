import { fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { useSvgObjectMoveSession } from "./useSvgObjectMoveSession";
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

function Harness({ svgNodeId }: { svgNodeId: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { getObjectHandlers } = useSvgObjectMoveSession(svgNodeId);
  return (
    <svg ref={svgRef} viewBox="0 0 100 100" data-testid="svg">
      <rect data-testid="rect1" x={10} y={10} width={20} height={20} {...getObjectHandlers("rect1")} />
      <rect data-testid="rect2" x={50} y={50} width={20} height={20} {...getObjectHandlers("rect2")} />
    </svg>
  );
}

function svgNode(overrides: Partial<EditorElementNode> = {}): EditorElementNode {
  return {
    id: "svg1",
    tag: "svg",
    svgScene: { objects: [rectObject(), rectObject({ id: "rect2", x: 50, y: 50 })] },
    ...overrides,
  };
}

function setup(node: EditorElementNode, selectedSvgObjectIds: string[] = ["rect1"]) {
  useEditorStore.setState((state) => ({
    document: { ...state.document, children: [node] },
    // The module-level auto-exit subscription immediately calls
    // exitSvgEditMode() (wiping selectedSvgObjectIds/svgEditingNodeId back
    // to empty) whenever selection.primaryId !== svgEditingNodeId — so the
    // outer document selection must be seeded to match svgEditingNodeId in
    // the SAME setState call, exactly like enterSvgEditMode itself does.
    selection: { ids: [node.id], primaryId: node.id },
    svgEditingNodeId: node.id,
    selectedSvgObjectIds,
    primarySvgObjectId: selectedSvgObjectIds[0] ?? null,
  }));
  const { container } = render(<Harness svgNodeId={node.id} />);
  const svg = container.querySelector('[data-testid="svg"]') as unknown as SVGSVGElement;
  stubSvgRect(svg, { left: 0, top: 0, width: 100, height: 100 });
  return {
    svg,
    rect1: container.querySelector('[data-testid="rect1"]') as unknown as SVGElement,
    rect2: container.querySelector('[data-testid="rect2"]') as unknown as SVGElement,
  };
}

describe("useSvgObjectMoveSession", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("dragging a selected object translates it, one history entry", () => {
    const { rect1 } = setup(svgNode());
    const pastBefore = useEditorStore.getState().past.length;

    fireEvent.pointerDown(rect1, { clientX: 15, clientY: 15, pointerId: 1 });
    fireEvent.pointerMove(rect1, { clientX: 25, clientY: 30, pointerId: 1 });
    fireEvent.pointerUp(rect1, { clientX: 25, clientY: 30, pointerId: 1 });

    const scene = useEditorStore.getState().document.children![0].svgScene!;
    expect(scene.objects[0]).toMatchObject({ x: 20, y: 25 });
    expect(useEditorStore.getState().past.length).toBe(pastBefore + 1);
  });

  it("a plain click on an object with zero movement is a pure selection change — no history entry", () => {
    const { rect2 } = setup(svgNode(), ["rect1"]);
    const pastBefore = useEditorStore.getState().past.length;

    fireEvent.pointerDown(rect2, { clientX: 60, clientY: 60, pointerId: 1 });
    fireEvent.pointerUp(rect2, { clientX: 60, clientY: 60, pointerId: 1 });

    expect(useEditorStore.getState().past.length).toBe(pastBefore);
    expect(useEditorStore.getState().selectedSvgObjectIds).toEqual(["rect2"]);
  });

  it("Shift+click adds to the selection instead of replacing it", () => {
    const { rect2 } = setup(svgNode(), ["rect1"]);

    fireEvent.pointerDown(rect2, { clientX: 60, clientY: 60, pointerId: 1, shiftKey: true });
    fireEvent.pointerUp(rect2, { clientX: 60, clientY: 60, pointerId: 1, shiftKey: true });

    expect(useEditorStore.getState().selectedSvgObjectIds.sort()).toEqual(["rect1", "rect2"]);
  });

  it("Ctrl/Cmd+click toggles membership", () => {
    const { rect1 } = setup(svgNode(), ["rect1", "rect2"]);

    fireEvent.pointerDown(rect1, { clientX: 15, clientY: 15, pointerId: 1, ctrlKey: true });
    fireEvent.pointerUp(rect1, { clientX: 15, clientY: 15, pointerId: 1, ctrlKey: true });

    expect(useEditorStore.getState().selectedSvgObjectIds).toEqual(["rect2"]);
  });

  it("dragging a multi-selection moves every selected object together in one history entry", () => {
    const { rect1 } = setup(svgNode(), ["rect1", "rect2"]);
    const pastBefore = useEditorStore.getState().past.length;

    fireEvent.pointerDown(rect1, { clientX: 15, clientY: 15, pointerId: 1 });
    fireEvent.pointerMove(rect1, { clientX: 20, clientY: 15, pointerId: 1 });
    fireEvent.pointerUp(rect1, { clientX: 20, clientY: 15, pointerId: 1 });

    const scene = useEditorStore.getState().document.children![0].svgScene!;
    expect(scene.objects[0]).toMatchObject({ x: 15 });
    expect(scene.objects[1]).toMatchObject({ x: 55 });
    expect(useEditorStore.getState().past.length).toBe(pastBefore + 1);
  });

  it("Escape mid-drag cancels the whole gesture and restores prior geometry", () => {
    const { rect1 } = setup(svgNode());
    const pastBefore = useEditorStore.getState().past.length;
    const objectBefore = useEditorStore.getState().document.children![0].svgScene!.objects[0];

    fireEvent.pointerDown(rect1, { clientX: 15, clientY: 15, pointerId: 1 });
    fireEvent.pointerMove(rect1, { clientX: 40, clientY: 40, pointerId: 1 });
    fireEvent.keyDown(window, { key: "Escape" });

    expect(useEditorStore.getState().past.length).toBe(pastBefore);
    expect(useEditorStore.getState().document.children![0].svgScene!.objects[0]).toEqual(objectBefore);
  });
});
