import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { InspectorBulkBorderSection } from "./InspectorBulkBorderSection";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";

const initialState = useEditorStore.getState();

function setupDocument(nodes: EditorElementNode[]) {
  useEditorStore.setState((state) => ({ document: { ...state.document, children: nodes } }));
}

function committedNode(id: string) {
  return useEditorStore.getState().document.children?.find((c) => c.id === id);
}

describe("InspectorBulkBorderSection (Checkpoint 1.15.2)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("committing a Width writes it to all four sides of every selected node", () => {
    const nodes: EditorElementNode[] = [
      { id: "div-1", tag: "div" },
      { id: "div-2", tag: "div" },
    ];
    setupDocument(nodes);
    render(<InspectorBulkBorderSection nodes={nodes} />);

    fireEvent.change(screen.getByLabelText("Border width"), { target: { value: "2" } });
    fireEvent.blur(screen.getByLabelText("Border width"));

    for (const id of ["div-1", "div-2"]) {
      const border = committedNode(id)?.border;
      expect(border?.top?.width).toEqual({ value: 2, unit: "px" });
      expect(border?.right?.width).toEqual({ value: 2, unit: "px" });
      expect(border?.bottom?.width).toEqual({ value: 2, unit: "px" });
      expect(border?.left?.width).toEqual({ value: 2, unit: "px" });
    }
  });

  it("selecting a Style option applies it across the selection", () => {
    const nodes: EditorElementNode[] = [
      { id: "div-1", tag: "div" },
      { id: "div-2", tag: "div" },
    ];
    setupDocument(nodes);
    render(<InspectorBulkBorderSection nodes={nodes} />);

    fireEvent.click(screen.getByRole("button", { name: "Dashed" }));

    expect(committedNode("div-1")?.border?.top?.style).toBe("dashed");
    expect(committedNode("div-2")?.border?.top?.style).toBe("dashed");
  });

  it("committing a Color applies it across the selection, preserving each node's existing width", () => {
    const nodes: EditorElementNode[] = [
      { id: "div-1", tag: "div", border: { top: { width: { value: 3, unit: "px" } }, right: { width: { value: 3, unit: "px" } }, bottom: { width: { value: 3, unit: "px" } }, left: { width: { value: 3, unit: "px" } } } },
    ];
    setupDocument(nodes);
    render(<InspectorBulkBorderSection nodes={nodes} />);

    const colorInput = screen.getByLabelText("Border color");
    fireEvent.change(colorInput, { target: { value: "#00ff00" } });
    fireEvent.blur(colorInput);

    const border = committedNode("div-1")?.border;
    expect(border?.top?.color).toBe("#00ff00");
    expect(border?.top?.width).toEqual({ value: 3, unit: "px" }); // preserved
  });

  it("applying a shared border edit across the selection is one history entry, undoable together", () => {
    const nodes: EditorElementNode[] = [
      { id: "div-1", tag: "div" },
      { id: "div-2", tag: "div" },
    ];
    setupDocument(nodes);
    render(<InspectorBulkBorderSection nodes={nodes} />);

    const pastBefore = useEditorStore.getState().past.length;
    fireEvent.change(screen.getByLabelText("Border width"), { target: { value: "2" } });
    fireEvent.blur(screen.getByLabelText("Border width"));
    expect(useEditorStore.getState().past.length).toBe(pastBefore + 1);

    useEditorStore.getState().undo();
    expect(committedNode("div-1")?.border).toBeUndefined();
    expect(committedNode("div-2")?.border).toBeUndefined();
  });
});
