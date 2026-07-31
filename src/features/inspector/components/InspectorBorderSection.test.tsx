import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { InspectorBorderSection } from "./InspectorBorderSection";

const initialState = useEditorStore.getState();

function setupNode(node: Parameters<typeof InspectorBorderSection>[0]["node"]) {
  useEditorStore.setState((state) => ({
    document: { ...state.document, children: [node] },
  }));
}

function committedNode() {
  return useEditorStore.getState().document.children?.find((c) => c.id === "container-1");
}

describe("InspectorBorderSection", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("shows Width/Style/Color as unset for a node with no border", () => {
    render(<InspectorBorderSection node={{ id: "container-1", tag: "div" }} />);

    expect(screen.getByLabelText("Border width")).toHaveValue(0);
    expect(screen.getByRole("button", { name: "Solid" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByLabelText("Border color")).toHaveValue("");
    expect(screen.getByRole("button", { name: "All Sides" })).toHaveAttribute("aria-pressed", "true");
  });

  it("commits a border width to every side at once while in All Sides mode", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorBorderSection node={{ id: "container-1", tag: "div" }} />);

    const input = screen.getByLabelText("Border width");
    fireEvent.change(input, { target: { value: "3" } });
    fireEvent.blur(input);

    for (const side of ["top", "right", "bottom", "left"] as const) {
      expect(committedNode()?.border?.[side]?.width).toEqual({ value: 3, unit: "px" });
    }
  });

  it("rejects a negative border width with a clear validation message and does not commit", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorBorderSection node={{ id: "container-1", tag: "div" }} />);

    const input = screen.getByLabelText("Border width");
    fireEvent.change(input, { target: { value: "-2" } });
    fireEvent.blur(input);

    expect(screen.getByRole("alert")).toHaveTextContent("Border width can't be negative.");
    expect(committedNode()?.border).toBeUndefined();
  });

  it("accepts a zero border width as an explicit, valid value", () => {
    setupNode({ id: "container-1", tag: "div", border: { top: { width: { value: 4, unit: "px" } } } });
    render(<InspectorBorderSection node={{ id: "container-1", tag: "div", border: { top: { width: { value: 4, unit: "px" } } } }} />);

    const input = screen.getByLabelText("Border width");
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.blur(input);

    expect(committedNode()?.border?.top?.width).toEqual({ value: 0, unit: "px" });
  });

  it("commits a border style to every side at once while in All Sides mode", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorBorderSection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Dashed" }));

    for (const side of ["top", "right", "bottom", "left"] as const) {
      expect(committedNode()?.border?.[side]?.style).toBe("dashed");
    }
  });

  it("commits a valid hex border color to every side at once", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorBorderSection node={{ id: "container-1", tag: "div" }} />);

    const input = screen.getByLabelText("Border color");
    fireEvent.change(input, { target: { value: "#3366ff" } });
    fireEvent.blur(input);

    expect(committedNode()?.border?.top?.color).toBe("#3366ff");
    expect(committedNode()?.border?.left?.color).toBe("#3366ff");
  });

  it("rejects a malformed border color and does not commit", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorBorderSection node={{ id: "container-1", tag: "div" }} />);

    const input = screen.getByLabelText("Border color");
    fireEvent.change(input, { target: { value: "not-a-color" } });
    fireEvent.blur(input);

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a hex color (#RRGGBB) or an rgb()/rgba() value.");
    expect(committedNode()?.border).toBeUndefined();
  });

  it("resets border width across every side, preserving other fields", () => {
    const border = { top: { width: { value: 2, unit: "px" as const }, style: "solid" as const } };
    setupNode({ id: "container-1", tag: "div", border });
    render(<InspectorBorderSection node={{ id: "container-1", tag: "div", border }} />);

    fireEvent.click(screen.getByRole("button", { name: "Reset border width" }));

    expect(committedNode()?.border?.top?.width).toBeUndefined();
    expect(committedNode()?.border?.top?.style).toBe("solid");
  });

  it("switching to Individual Sides reveals the visual side selector", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorBorderSection node={{ id: "container-1", tag: "div" }} />);

    expect(screen.queryByRole("group", { name: "Border side" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Individual Sides" }));

    expect(screen.getByRole("group", { name: "Border side" })).toBeInTheDocument();
  });

  it("editing a field in Individual Sides mode affects only the selected side", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorBorderSection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Individual Sides" }));
    fireEvent.click(screen.getByLabelText("Right border"));

    fireEvent.click(screen.getByRole("button", { name: "Dotted" }));

    expect(committedNode()?.border?.right?.style).toBe("dotted");
    expect(committedNode()?.border?.top?.style).toBeUndefined();
    expect(committedNode()?.border?.left?.style).toBeUndefined();
  });

  it("shows the newly selected side's own values after switching sides", () => {
    const border = {
      top: { style: "solid" as const },
      left: { style: "dashed" as const },
    };
    setupNode({ id: "container-1", tag: "div", border });
    const { rerender } = render(<InspectorBorderSection node={{ id: "container-1", tag: "div", border }} />);

    fireEvent.click(screen.getByRole("button", { name: "Individual Sides" }));
    expect(screen.getByRole("button", { name: "Solid" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByLabelText("Left border"));
    rerender(<InspectorBorderSection node={{ id: "container-1", tag: "div", border }} />);
    expect(screen.getByRole("button", { name: "Dashed" })).toHaveAttribute("aria-pressed", "true");
  });

  it("applies the Thin preset (1px solid) to every side, preserving existing color", () => {
    const border = { top: { color: "#3366ff" } };
    setupNode({ id: "container-1", tag: "div", border });
    render(<InspectorBorderSection node={{ id: "container-1", tag: "div", border }} />);

    fireEvent.click(screen.getByRole("button", { name: "Thin preset" }));

    expect(committedNode()?.border?.top).toEqual({ color: "#3366ff", width: { value: 1, unit: "px" }, style: "solid" });
    expect(committedNode()?.border?.right).toEqual({ width: { value: 1, unit: "px" }, style: "solid" });
  });

  it("applies the None preset by clearing the border entirely", () => {
    const border = { top: { width: { value: 2, unit: "px" as const }, style: "solid" as const } };
    setupNode({ id: "container-1", tag: "div", border });
    render(<InspectorBorderSection node={{ id: "container-1", tag: "div", border }} />);

    fireEvent.click(screen.getByRole("button", { name: "None preset" }));

    expect(committedNode()?.border).toBeUndefined();
  });

  it("Reset Border clears the whole border and is disabled when nothing is set", () => {
    render(<InspectorBorderSection node={{ id: "container-1", tag: "div" }} />);
    expect(screen.getByRole("button", { name: "Reset border" })).toBeDisabled();
  });

  it("Reset Border is enabled and clears every side once any side is configured", () => {
    const border = { left: { style: "dotted" as const } };
    setupNode({ id: "container-1", tag: "div", border });
    render(<InspectorBorderSection node={{ id: "container-1", tag: "div", border }} />);

    fireEvent.click(screen.getByRole("button", { name: "Reset border" }));
    expect(committedNode()?.border).toBeUndefined();
  });

  it("is undoable and redoable through the normal history stack", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorBorderSection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Solid" }));
    expect(committedNode()?.border?.top?.style).toBe("solid");

    useEditorStore.getState().undo();
    expect(committedNode()?.border).toBeUndefined();

    useEditorStore.getState().redo();
    expect(committedNode()?.border?.top?.style).toBe("solid");
  });

  it("clears a stale validation error and resets mode/side selection when the selected node changes", () => {
    const { rerender } = render(<InspectorBorderSection node={{ id: "container-1", tag: "div" }} />);

    const input = screen.getByLabelText("Border width");
    fireEvent.change(input, { target: { value: "-2" } });
    fireEvent.blur(input);
    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Individual Sides" }));
    expect(screen.getByRole("group", { name: "Border side" })).toBeInTheDocument();

    rerender(<InspectorBorderSection node={{ id: "container-2", tag: "div" }} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All Sides" })).toHaveAttribute("aria-pressed", "true");
  });

  it("defaults to Individual Sides mode when a freshly-selected node's sides already differ", () => {
    const border = { top: { style: "solid" as const }, left: { style: "dashed" as const } };
    render(<InspectorBorderSection node={{ id: "container-1", tag: "div", border }} />);

    expect(screen.getByRole("button", { name: "Individual Sides" })).toHaveAttribute("aria-pressed", "true");
  });
});
