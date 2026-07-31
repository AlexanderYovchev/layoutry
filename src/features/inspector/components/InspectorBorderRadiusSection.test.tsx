import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { InspectorBorderRadiusSection } from "./InspectorBorderRadiusSection";

const initialState = useEditorStore.getState();

function setupNode(node: Parameters<typeof InspectorBorderRadiusSection>[0]["node"]) {
  useEditorStore.setState((state) => ({
    document: { ...state.document, children: [node] },
  }));
}

function committedNode() {
  return useEditorStore.getState().document.children?.find((c) => c.id === "container-1");
}

describe("InspectorBorderRadiusSection", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("shows Radius as unset and Corners as Unified for a node with no radius", () => {
    render(<InspectorBorderRadiusSection node={{ id: "container-1", tag: "div" }} />);

    expect(screen.getByLabelText("Border radius")).toHaveValue(0);
    expect(screen.getByRole("button", { name: "Unified" })).toHaveAttribute("aria-pressed", "true");
  });

  it("commits a radius to every corner at once while in Unified mode", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorBorderRadiusSection node={{ id: "container-1", tag: "div" }} />);

    const input = screen.getByLabelText("Border radius");
    fireEvent.change(input, { target: { value: "8" } });
    fireEvent.blur(input);

    for (const corner of ["topLeft", "topRight", "bottomRight", "bottomLeft"] as const) {
      expect(committedNode()?.borderRadius?.[corner]).toEqual({ value: 8, unit: "px" });
    }
  });

  it("rejects a negative radius with a clear validation message and does not commit", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorBorderRadiusSection node={{ id: "container-1", tag: "div" }} />);

    const input = screen.getByLabelText("Border radius");
    fireEvent.change(input, { target: { value: "-4" } });
    fireEvent.blur(input);

    expect(screen.getByRole("alert")).toHaveTextContent("Border radius can't be negative.");
    expect(committedNode()?.borderRadius).toBeUndefined();
  });

  it("accepts a zero radius as an explicit, valid value", () => {
    const borderRadius = { topLeft: { value: 8, unit: "px" as const } };
    setupNode({ id: "container-1", tag: "div", borderRadius });
    render(<InspectorBorderRadiusSection node={{ id: "container-1", tag: "div", borderRadius }} />);

    const input = screen.getByLabelText("Border radius");
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.blur(input);

    expect(committedNode()?.borderRadius?.topLeft).toEqual({ value: 0, unit: "px" });
  });

  it("commits a percentage radius by switching the unit of an already-set value", () => {
    const borderRadius = { topLeft: { value: 50, unit: "px" as const } };
    setupNode({ id: "container-1", tag: "div", borderRadius });
    render(<InspectorBorderRadiusSection node={{ id: "container-1", tag: "div", borderRadius }} />);

    fireEvent.change(screen.getByLabelText("Border radius unit"), { target: { value: "%" } });

    expect(committedNode()?.borderRadius?.topLeft).toEqual({ value: 50, unit: "%" });
  });

  it("resets radius across every corner", () => {
    const borderRadius = { topLeft: { value: 8, unit: "px" as const }, topRight: { value: 8, unit: "px" as const }, bottomRight: { value: 8, unit: "px" as const }, bottomLeft: { value: 8, unit: "px" as const } };
    setupNode({ id: "container-1", tag: "div", borderRadius });
    render(<InspectorBorderRadiusSection node={{ id: "container-1", tag: "div", borderRadius }} />);

    fireEvent.click(screen.getByRole("button", { name: "Reset radius" }));

    expect(committedNode()?.borderRadius).toBeUndefined();
  });

  it("switching to Individual Corners reveals the visual corner selector", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorBorderRadiusSection node={{ id: "container-1", tag: "div" }} />);

    expect(screen.queryByRole("group", { name: "Border radius corner" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Individual Corners" }));

    expect(screen.getByRole("group", { name: "Border radius corner" })).toBeInTheDocument();
  });

  it("editing radius in Individual Corners mode affects only the selected corner", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorBorderRadiusSection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Individual Corners" }));
    fireEvent.click(screen.getByLabelText("Bottom right corner"));

    const input = screen.getByLabelText("Border radius");
    fireEvent.change(input, { target: { value: "12" } });
    fireEvent.blur(input);

    expect(committedNode()?.borderRadius?.bottomRight).toEqual({ value: 12, unit: "px" });
    expect(committedNode()?.borderRadius?.topLeft).toBeUndefined();
  });

  it("shows the newly selected corner's own value after switching corners", () => {
    const borderRadius = { topLeft: { value: 4, unit: "px" as const }, bottomLeft: { value: 12, unit: "px" as const } };
    setupNode({ id: "container-1", tag: "div", borderRadius });
    const { rerender } = render(<InspectorBorderRadiusSection node={{ id: "container-1", tag: "div", borderRadius }} />);

    fireEvent.click(screen.getByRole("button", { name: "Individual Corners" }));
    expect(screen.getByLabelText("Border radius")).toHaveValue(4);

    fireEvent.click(screen.getByLabelText("Bottom left corner"));
    rerender(<InspectorBorderRadiusSection node={{ id: "container-1", tag: "div", borderRadius }} />);
    expect(screen.getByLabelText("Border radius")).toHaveValue(12);
  });

  it("applies the Small preset (4px) to every corner", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorBorderRadiusSection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Small radius preset" }));

    expect(committedNode()?.borderRadius?.topLeft).toEqual({ value: 4, unit: "px" });
    expect(committedNode()?.borderRadius?.bottomRight).toEqual({ value: 4, unit: "px" });
  });

  it("applies the Pill preset as a large fixed pixel value", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorBorderRadiusSection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Pill radius preset" }));

    expect(committedNode()?.borderRadius?.topLeft).toEqual({ value: 9999, unit: "px" });
  });

  it("applies the Circle preset as 50% on every corner", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorBorderRadiusSection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Circle radius preset" }));

    expect(committedNode()?.borderRadius?.topLeft).toEqual({ value: 50, unit: "%" });
    expect(committedNode()?.borderRadius?.bottomLeft).toEqual({ value: 50, unit: "%" });
  });

  it("applies the None preset by clearing the radius entirely", () => {
    const borderRadius = { topLeft: { value: 8, unit: "px" as const } };
    setupNode({ id: "container-1", tag: "div", borderRadius });
    render(<InspectorBorderRadiusSection node={{ id: "container-1", tag: "div", borderRadius }} />);

    fireEvent.click(screen.getByRole("button", { name: "None radius preset" }));

    expect(committedNode()?.borderRadius).toBeUndefined();
  });

  it("Reset Border Radius is disabled when nothing is set, and clears everything once something is", () => {
    const first = render(<InspectorBorderRadiusSection node={{ id: "container-1", tag: "div" }} />);
    expect(screen.getByRole("button", { name: "Reset border radius" })).toBeDisabled();
    first.unmount();

    const borderRadius = { topLeft: { value: 4, unit: "px" as const } };
    setupNode({ id: "container-1", tag: "div", borderRadius });
    render(<InspectorBorderRadiusSection node={{ id: "container-1", tag: "div", borderRadius }} />);
    fireEvent.click(screen.getByRole("button", { name: "Reset border radius" }));
    expect(committedNode()?.borderRadius).toBeUndefined();
  });

  it("is undoable and redoable through the normal history stack", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorBorderRadiusSection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Small radius preset" }));
    expect(committedNode()?.borderRadius?.topLeft).toEqual({ value: 4, unit: "px" });

    useEditorStore.getState().undo();
    expect(committedNode()?.borderRadius).toBeUndefined();

    useEditorStore.getState().redo();
    expect(committedNode()?.borderRadius?.topLeft).toEqual({ value: 4, unit: "px" });
  });

  it("clears a stale validation error and resets mode/corner selection when the selected node changes", () => {
    const { rerender } = render(<InspectorBorderRadiusSection node={{ id: "container-1", tag: "div" }} />);

    const input = screen.getByLabelText("Border radius");
    fireEvent.change(input, { target: { value: "-4" } });
    fireEvent.blur(input);
    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Individual Corners" }));
    expect(screen.getByRole("group", { name: "Border radius corner" })).toBeInTheDocument();

    rerender(<InspectorBorderRadiusSection node={{ id: "container-2", tag: "div" }} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unified" })).toHaveAttribute("aria-pressed", "true");
  });

  it("defaults to Individual Corners mode when a freshly-selected node's corners already differ", () => {
    const borderRadius = { topLeft: { value: 4, unit: "px" as const }, bottomLeft: { value: 12, unit: "px" as const } };
    render(<InspectorBorderRadiusSection node={{ id: "container-1", tag: "div", borderRadius }} />);

    expect(screen.getByRole("button", { name: "Individual Corners" })).toHaveAttribute("aria-pressed", "true");
  });
});
