import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { MAX_SHADOW_LAYERS } from "@/features/editor/types/boxShadow";
import { InspectorBoxShadowSection } from "./InspectorBoxShadowSection";

const initialState = useEditorStore.getState();

function setupNode(node: Parameters<typeof InspectorBoxShadowSection>[0]["node"]) {
  useEditorStore.setState((state) => ({
    document: { ...state.document, children: [node] },
  }));
}

function committedNode() {
  return useEditorStore.getState().document.children?.find((c) => c.id === "container-1");
}

describe("InspectorBoxShadowSection", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("shows an Add Shadow action for a node with no shadow layers", () => {
    render(<InspectorBoxShadowSection node={{ id: "container-1", tag: "div" }} />);

    expect(screen.getByRole("button", { name: "Add Shadow" })).toBeInTheDocument();
    expect(screen.queryByText(/^Layers/)).not.toBeInTheDocument();
  });

  it("adds a fully-configured default layer and selects it", () => {
    setupNode({ id: "container-1", tag: "div" });
    const { rerender } = render(<InspectorBoxShadowSection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Add Shadow" }));

    expect(committedNode()?.boxShadow).toHaveLength(1);
    expect(committedNode()?.boxShadow?.[0].enabled).toBe(true);

    // The Layers list renders from the `node` prop, not the store directly
    // (same convention every other Inspector section already follows) —
    // in the real app InspectorNodeSummary re-renders with a fresh node
    // on every store change; a standalone test must do that explicitly.
    // See this project's "Inspector local-state staleness" memory.
    rerender(<InspectorBoxShadowSection node={committedNode()!} />);

    expect(screen.getByRole("button", { name: "Select Shadow 1" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Offset Y")).toHaveValue(4);
  });

  it("commits a valid color to the selected layer", () => {
    const boxShadow = [{ id: "shadow-1", enabled: true, inset: false }];
    setupNode({ id: "container-1", tag: "div", boxShadow });
    render(<InspectorBoxShadowSection node={{ id: "container-1", tag: "div", boxShadow }} />);

    fireEvent.change(screen.getByLabelText("Shadow color"), { target: { value: "#3366ff" } });
    fireEvent.blur(screen.getByLabelText("Shadow color"));

    expect(committedNode()?.boxShadow?.[0].color).toBe("#3366ff");
  });

  it("rejects an invalid color with a validation message and does not commit", () => {
    const boxShadow = [{ id: "shadow-1", enabled: true, inset: false }];
    setupNode({ id: "container-1", tag: "div", boxShadow });
    render(<InspectorBoxShadowSection node={{ id: "container-1", tag: "div", boxShadow }} />);

    fireEvent.change(screen.getByLabelText("Shadow color"), { target: { value: "not-a-color" } });
    fireEvent.blur(screen.getByLabelText("Shadow color"));

    expect(screen.getByRole("alert")).toHaveTextContent(/hex color/);
    expect(committedNode()?.boxShadow?.[0].color).toBeUndefined();
  });

  it("rejects a negative blur with a validation message and does not commit", () => {
    const boxShadow = [{ id: "shadow-1", enabled: true, inset: false }];
    setupNode({ id: "container-1", tag: "div", boxShadow });
    render(<InspectorBoxShadowSection node={{ id: "container-1", tag: "div", boxShadow }} />);

    fireEvent.change(screen.getByLabelText("Blur"), { target: { value: "-2" } });
    fireEvent.blur(screen.getByLabelText("Blur"));

    expect(screen.getByRole("alert")).toHaveTextContent("Blur can't be negative.");
    expect(committedNode()?.boxShadow?.[0].blur).toBeUndefined();
  });

  it("accepts a negative offset as a valid value", () => {
    const boxShadow = [{ id: "shadow-1", enabled: true, inset: false }];
    setupNode({ id: "container-1", tag: "div", boxShadow });
    render(<InspectorBoxShadowSection node={{ id: "container-1", tag: "div", boxShadow }} />);

    fireEvent.change(screen.getByLabelText("Offset X"), { target: { value: "-6" } });
    fireEvent.blur(screen.getByLabelText("Offset X"));

    expect(committedNode()?.boxShadow?.[0].offsetX).toEqual({ value: -6, unit: "px" });
  });

  it("switches a geometry field's unit", () => {
    const boxShadow = [{ id: "shadow-1", enabled: true, inset: false, blur: { value: 8, unit: "px" as const } }];
    setupNode({ id: "container-1", tag: "div", boxShadow });
    render(<InspectorBoxShadowSection node={{ id: "container-1", tag: "div", boxShadow }} />);

    fireEvent.change(screen.getByLabelText("Blur unit"), { target: { value: "rem" } });

    expect(committedNode()?.boxShadow?.[0].blur).toEqual({ value: 8, unit: "rem" });
  });

  it("toggles inset on the selected layer", () => {
    const boxShadow = [{ id: "shadow-1", enabled: true, inset: false }];
    setupNode({ id: "container-1", tag: "div", boxShadow });
    render(<InspectorBoxShadowSection node={{ id: "container-1", tag: "div", boxShadow }} />);

    fireEvent.click(screen.getByRole("switch", { name: "Inset shadow" }));

    expect(committedNode()?.boxShadow?.[0].inset).toBe(true);
  });

  it("Reset Geometry clears every geometry field but preserves color", () => {
    const boxShadow = [
      {
        id: "shadow-1",
        enabled: true,
        inset: false,
        offsetX: { value: 1, unit: "px" as const },
        offsetY: { value: 2, unit: "px" as const },
        blur: { value: 3, unit: "px" as const },
        spread: { value: 4, unit: "px" as const },
        color: "#3366ff",
      },
    ];
    setupNode({ id: "container-1", tag: "div", boxShadow });
    render(<InspectorBoxShadowSection node={{ id: "container-1", tag: "div", boxShadow }} />);

    fireEvent.click(screen.getByRole("button", { name: "Reset geometry" }));

    const layer = committedNode()?.boxShadow?.[0];
    expect(layer?.offsetX).toBeUndefined();
    expect(layer?.offsetY).toBeUndefined();
    expect(layer?.blur).toBeUndefined();
    expect(layer?.spread).toBeUndefined();
    expect(layer?.color).toBe("#3366ff");
  });

  it("Reset Selected Layer clears geometry and color together", () => {
    const boxShadow = [
      {
        id: "shadow-1",
        enabled: true,
        inset: false,
        offsetY: { value: 4, unit: "px" as const },
        color: "#3366ff",
      },
    ];
    setupNode({ id: "container-1", tag: "div", boxShadow });
    render(<InspectorBoxShadowSection node={{ id: "container-1", tag: "div", boxShadow }} />);

    fireEvent.click(screen.getByRole("button", { name: "Reset Selected Layer" }));

    const layer = committedNode()?.boxShadow?.[0];
    expect(layer?.offsetY).toBeUndefined();
    expect(layer?.color).toBeUndefined();
    // The layer itself still exists in the list — "reset" is not "delete".
    expect(committedNode()?.boxShadow).toHaveLength(1);
  });

  it("duplicates a layer via the list row and selects the new clone", () => {
    const boxShadow = [{ id: "shadow-1", enabled: true, inset: false, color: "#ff0000" }];
    setupNode({ id: "container-1", tag: "div", boxShadow });
    const { rerender } = render(<InspectorBoxShadowSection node={{ id: "container-1", tag: "div", boxShadow }} />);

    fireEvent.click(screen.getByRole("button", { name: "Duplicate Shadow 1" }));

    expect(committedNode()?.boxShadow).toHaveLength(2);
    expect(committedNode()?.boxShadow?.[1].id).not.toBe("shadow-1");
    expect(committedNode()?.boxShadow?.[1].color).toBe("#ff0000");

    rerender(<InspectorBoxShadowSection node={committedNode()!} />);
    expect(screen.getByRole("button", { name: "Select Shadow 2" })).toHaveAttribute("aria-pressed", "true");
  });

  it("deletes a layer via the list row and falls back the selection", () => {
    const boxShadow = [
      { id: "shadow-1", enabled: true, inset: false, color: "#ff0000" },
      { id: "shadow-2", enabled: true, inset: false, color: "#00ff00" },
    ];
    setupNode({ id: "container-1", tag: "div", boxShadow });
    render(<InspectorBoxShadowSection node={{ id: "container-1", tag: "div", boxShadow }} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete Shadow 1" }));

    expect(committedNode()?.boxShadow).toHaveLength(1);
    expect(committedNode()?.boxShadow?.[0].id).toBe("shadow-2");
  });

  it("toggles a layer's enabled state via the list row switch", () => {
    const boxShadow = [{ id: "shadow-1", enabled: true, inset: false }];
    setupNode({ id: "container-1", tag: "div", boxShadow });
    render(<InspectorBoxShadowSection node={{ id: "container-1", tag: "div", boxShadow }} />);

    fireEvent.click(screen.getByRole("switch", { name: "Shadow 1 enabled" }));

    expect(committedNode()?.boxShadow?.[0].enabled).toBe(false);
  });

  it("applies a preset as a single fresh layer, replacing whatever existed", () => {
    const boxShadow = [{ id: "shadow-1", enabled: true, inset: false, color: "#ff0000" }];
    setupNode({ id: "container-1", tag: "div", boxShadow });
    render(<InspectorBoxShadowSection node={{ id: "container-1", tag: "div", boxShadow }} />);

    fireEvent.click(screen.getByRole("button", { name: "Medium shadow preset" }));

    expect(committedNode()?.boxShadow).toHaveLength(1);
    expect(committedNode()?.boxShadow?.[0].id).not.toBe("shadow-1");
    expect(committedNode()?.boxShadow?.[0].offsetY).toEqual({ value: 4, unit: "px" });
  });

  it("applies the Inner Shadow preset as an inset layer", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorBoxShadowSection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Inner Shadow shadow preset" }));

    expect(committedNode()?.boxShadow?.[0].inset).toBe(true);
  });

  it("Reset Shadow is disabled when nothing is set, and clears every layer once something is", () => {
    const first = render(<InspectorBoxShadowSection node={{ id: "container-1", tag: "div" }} />);
    expect(screen.getByRole("button", { name: "Reset shadow" })).toBeDisabled();
    first.unmount();

    const boxShadow = [{ id: "shadow-1", enabled: true, inset: false }];
    setupNode({ id: "container-1", tag: "div", boxShadow });
    render(<InspectorBoxShadowSection node={{ id: "container-1", tag: "div", boxShadow }} />);
    fireEvent.click(screen.getByRole("button", { name: "Reset shadow" }));

    expect(committedNode()?.boxShadow).toBeUndefined();
  });

  it("disables Add shadow layer once MAX_SHADOW_LAYERS is reached", () => {
    const boxShadow = Array.from({ length: MAX_SHADOW_LAYERS }, (_, i) => ({
      id: `shadow-${i}`,
      enabled: true,
      inset: false,
    }));
    setupNode({ id: "container-1", tag: "div", boxShadow });
    render(<InspectorBoxShadowSection node={{ id: "container-1", tag: "div", boxShadow }} />);

    expect(screen.getByRole("button", { name: "Add shadow layer" })).toBeDisabled();
  });

  it("is undoable and redoable through the normal history stack", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorBoxShadowSection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Small shadow preset" }));
    expect(committedNode()?.boxShadow).toHaveLength(1);

    useEditorStore.getState().undo();
    expect(committedNode()?.boxShadow).toBeUndefined();

    useEditorStore.getState().redo();
    expect(committedNode()?.boxShadow).toHaveLength(1);
  });

  it("clears a stale validation error and resets layer selection when the selected node changes", () => {
    const boxShadow = [{ id: "shadow-1", enabled: true, inset: false }];
    const { rerender } = render(<InspectorBoxShadowSection node={{ id: "container-1", tag: "div", boxShadow }} />);

    fireEvent.change(screen.getByLabelText("Blur"), { target: { value: "-2" } });
    fireEvent.blur(screen.getByLabelText("Blur"));
    expect(screen.getByRole("alert")).toBeInTheDocument();

    rerender(<InspectorBoxShadowSection node={{ id: "container-2", tag: "div" }} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Shadow" })).toBeInTheDocument();
  });
});
