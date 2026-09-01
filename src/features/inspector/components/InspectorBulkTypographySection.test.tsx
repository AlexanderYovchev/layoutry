import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { InspectorBulkTypographySection } from "./InspectorBulkTypographySection";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";

const initialState = useEditorStore.getState();

function setupDocument(nodes: EditorElementNode[]) {
  useEditorStore.setState((state) => ({ document: { ...state.document, children: nodes } }));
}

function committedNode(id: string) {
  return useEditorStore.getState().document.children?.find((c) => c.id === id);
}

describe("InspectorBulkTypographySection (Checkpoint 1.15.2)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("shows the shared font size when every selected node agrees", () => {
    const nodes: EditorElementNode[] = [
      { id: "p-1", tag: "p", typography: { fontSize: { value: 16, unit: "px" } } },
      { id: "p-2", tag: "p", typography: { fontSize: { value: 16, unit: "px" } } },
    ];
    setupDocument(nodes);
    render(<InspectorBulkTypographySection nodes={nodes} />);
    expect(screen.getByLabelText("Font size")).toHaveValue(16);
  });

  it("shows Mixed when selected nodes disagree", () => {
    const nodes: EditorElementNode[] = [
      { id: "p-1", tag: "p", typography: { fontSize: { value: 16, unit: "px" } } },
      { id: "p-2", tag: "p", typography: { fontSize: { value: 20, unit: "px" } } },
    ];
    setupDocument(nodes);
    render(<InspectorBulkTypographySection nodes={nodes} />);
    expect(screen.getByLabelText("Font size")).toHaveAttribute("placeholder", "Mixed");
  });

  it("committing a new font size applies it to every selected node in one action", () => {
    const nodes: EditorElementNode[] = [
      { id: "p-1", tag: "p", typography: { fontSize: { value: 16, unit: "px" } } },
      { id: "p-2", tag: "p", typography: { fontSize: { value: 20, unit: "px" } } },
    ];
    setupDocument(nodes);
    render(<InspectorBulkTypographySection nodes={nodes} />);

    const input = screen.getByLabelText("Font size");
    fireEvent.change(input, { target: { value: "18" } });
    fireEvent.blur(input);

    expect(committedNode("p-1")?.typography?.fontSize).toEqual({ value: 18, unit: "px" });
    expect(committedNode("p-2")?.typography?.fontSize).toEqual({ value: 18, unit: "px" });
  });

  it("committing one field preserves each node's own other typography fields", () => {
    const nodes: EditorElementNode[] = [
      { id: "p-1", tag: "p", typography: { fontSize: { value: 16, unit: "px" }, fontWeight: 700 } },
      { id: "p-2", tag: "p", typography: { fontSize: { value: 20, unit: "px" }, color: "#ff0000" } },
    ];
    setupDocument(nodes);
    render(<InspectorBulkTypographySection nodes={nodes} />);

    fireEvent.change(screen.getByLabelText("Font size"), { target: { value: "18" } });
    fireEvent.blur(screen.getByLabelText("Font size"));

    expect(committedNode("p-1")?.typography?.fontWeight).toBe(700);
    expect(committedNode("p-2")?.typography?.color).toBe("#ff0000");
  });

  it("applying a shared font size across the selection is exactly one history entry", () => {
    const nodes: EditorElementNode[] = [
      { id: "p-1", tag: "p" },
      { id: "p-2", tag: "p" },
      { id: "p-3", tag: "p" },
    ];
    setupDocument(nodes);
    render(<InspectorBulkTypographySection nodes={nodes} />);

    const pastLengthBefore = useEditorStore.getState().past.length;
    fireEvent.change(screen.getByLabelText("Font size"), { target: { value: "18" } });
    fireEvent.blur(screen.getByLabelText("Font size"));

    expect(useEditorStore.getState().past.length).toBe(pastLengthBefore + 1);
    expect(committedNode("p-1")?.typography?.fontSize).toEqual({ value: 18, unit: "px" });
    expect(committedNode("p-2")?.typography?.fontSize).toEqual({ value: 18, unit: "px" });
    expect(committedNode("p-3")?.typography?.fontSize).toEqual({ value: 18, unit: "px" });

    useEditorStore.getState().undo();
    expect(committedNode("p-1")?.typography?.fontSize).toBeUndefined();
    expect(committedNode("p-3")?.typography?.fontSize).toBeUndefined();
  });

  it("selecting a Weight option applies it to every selected node", () => {
    const nodes: EditorElementNode[] = [
      { id: "p-1", tag: "p" },
      { id: "p-2", tag: "p" },
    ];
    setupDocument(nodes);
    render(<InspectorBulkTypographySection nodes={nodes} />);

    fireEvent.click(screen.getByRole("button", { name: "Bold" }));

    expect(committedNode("p-1")?.typography?.fontWeight).toBe(700);
    expect(committedNode("p-2")?.typography?.fontWeight).toBe(700);
  });
});
