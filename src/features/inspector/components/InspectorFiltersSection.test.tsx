import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { InspectorFiltersSection } from "./InspectorFiltersSection";

const initialState = useEditorStore.getState();

function setupNode(node: Parameters<typeof InspectorFiltersSection>[0]["node"]) {
  useEditorStore.setState((state) => ({
    document: { ...state.document, children: [node] },
  }));
}

function committedNode() {
  return useEditorStore.getState().document.children?.find((c) => c.id === "container-1");
}

describe("InspectorFiltersSection", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("shows every field as unset for a node with no filters", () => {
    render(<InspectorFiltersSection node={{ id: "container-1", tag: "div" }} />);

    // Opacity/Brightness/Contrast/Saturation display their true CSS-neutral
    // 100% when unset (Checkpoint 1.12.1 fix) — Grayscale/Invert/Sepia's
    // neutral genuinely is 0%, and Blur/Hue Rotate are unrelated units.
    expect(screen.getByLabelText("Opacity")).toHaveValue(100);
    expect(screen.getByLabelText("Brightness")).toHaveValue(100);
    expect(screen.getByLabelText("Contrast")).toHaveValue(100);
    expect(screen.getByLabelText("Saturation")).toHaveValue(100);
    expect(screen.getByLabelText("Grayscale")).toHaveValue(0);
    expect(screen.getByLabelText("Invert")).toHaveValue(0);
    expect(screen.getByLabelText("Sepia")).toHaveValue(0);
    expect(screen.getByLabelText("Blur")).toHaveValue(0);
    expect(screen.getByLabelText("Hue Rotate")).toHaveValue(0);
    expect(screen.getByRole("button", { name: "Reset effects" })).toBeDisabled();
  });

  it("commits opacity", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorFiltersSection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.change(screen.getByLabelText("Opacity"), { target: { value: "60" } });
    fireEvent.blur(screen.getByLabelText("Opacity"));

    expect(committedNode()?.filters?.opacity).toBe(60);
  });

  it("rejects an opacity outside 0-100 with a validation message and does not commit", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorFiltersSection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.change(screen.getByLabelText("Opacity"), { target: { value: "150" } });
    fireEvent.blur(screen.getByLabelText("Opacity"));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a value between 0 and 100.");
    expect(committedNode()?.filters?.opacity).toBeUndefined();
  });

  it("commits blur with its own unit", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorFiltersSection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.change(screen.getByLabelText("Blur"), { target: { value: "8" } });
    fireEvent.blur(screen.getByLabelText("Blur"));

    expect(committedNode()?.filters?.blur).toEqual({ value: 8, unit: "px" });
  });

  it("rejects a negative blur with a validation message and does not commit", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorFiltersSection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.change(screen.getByLabelText("Blur"), { target: { value: "-4" } });
    fireEvent.blur(screen.getByLabelText("Blur"));

    expect(screen.getByRole("alert")).toHaveTextContent("Blur can't be negative.");
    expect(committedNode()?.filters?.blur).toBeUndefined();
  });

  it("switches blur's unit", () => {
    const filters = { blur: { value: 8, unit: "px" as const } };
    setupNode({ id: "container-1", tag: "div", filters });
    render(<InspectorFiltersSection node={{ id: "container-1", tag: "div", filters }} />);

    fireEvent.change(screen.getByLabelText("Blur unit"), { target: { value: "rem" } });

    expect(committedNode()?.filters?.blur).toEqual({ value: 8, unit: "rem" });
  });

  it("accepts brightness/contrast/saturate above 100 with no fixed upper bound", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorFiltersSection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.change(screen.getByLabelText("Brightness"), { target: { value: "500" } });
    fireEvent.blur(screen.getByLabelText("Brightness"));

    expect(committedNode()?.filters?.brightness).toBe(500);
  });

  it("rejects a negative brightness with a validation message", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorFiltersSection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.change(screen.getByLabelText("Brightness"), { target: { value: "-10" } });
    fireEvent.blur(screen.getByLabelText("Brightness"));

    expect(screen.getByRole("alert")).toHaveTextContent("Brightness can't be negative.");
    expect(committedNode()?.filters?.brightness).toBeUndefined();
  });

  it("rejects a grayscale value above 100", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorFiltersSection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.change(screen.getByLabelText("Grayscale"), { target: { value: "150" } });
    fireEvent.blur(screen.getByLabelText("Grayscale"));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a value between 0 and 100.");
    expect(committedNode()?.filters?.grayscale).toBeUndefined();
  });

  it("commits invert", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorFiltersSection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.change(screen.getByLabelText("Invert"), { target: { value: "40" } });
    fireEvent.blur(screen.getByLabelText("Invert"));

    expect(committedNode()?.filters?.invert).toBe(40);
  });

  it("commits sepia", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorFiltersSection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.change(screen.getByLabelText("Sepia"), { target: { value: "20" } });
    fireEvent.blur(screen.getByLabelText("Sepia"));

    expect(committedNode()?.filters?.sepia).toBe(20);
  });

  it("normalizes a hue-rotate angle outside 0-360 rather than rejecting it", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorFiltersSection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.change(screen.getByLabelText("Hue Rotate"), { target: { value: "370" } });
    fireEvent.blur(screen.getByLabelText("Hue Rotate"));

    expect(committedNode()?.filters?.hueRotate).toBe(10);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("resets a single property without affecting the others", () => {
    const filters = { opacity: 60, brightness: 150 };
    setupNode({ id: "container-1", tag: "div", filters });
    render(<InspectorFiltersSection node={{ id: "container-1", tag: "div", filters }} />);

    fireEvent.click(screen.getByRole("button", { name: "Reset opacity" }));

    expect(committedNode()?.filters?.opacity).toBeUndefined();
    expect(committedNode()?.filters?.brightness).toBe(150);
  });

  it("Reset Opacity displays the true CSS-neutral 100%, not 0%, once the parent re-renders with the committed node (Checkpoint 1.12.1 regression)", () => {
    const filters = { opacity: 60 };
    setupNode({ id: "container-1", tag: "div", filters });
    const { rerender } = render(<InspectorFiltersSection node={{ id: "container-1", tag: "div", filters }} />);

    fireEvent.click(screen.getByRole("button", { name: "Reset opacity" }));
    expect(committedNode()?.filters?.opacity).toBeUndefined();

    // This component is purely props-driven (see its own doc comment) —
    // it never re-reads the store itself, so the caller (InspectorPanel)
    // is what feeds it the post-commit node. Simulate that hand-off here.
    rerender(<InspectorFiltersSection node={committedNode()!} />);
    expect(screen.getByLabelText("Opacity")).toHaveValue(100);
  });

  it("Reset Effects clears every filter at once", () => {
    const filters = { opacity: 60, brightness: 150, blur: { value: 4, unit: "px" as const } };
    setupNode({ id: "container-1", tag: "div", filters });
    render(<InspectorFiltersSection node={{ id: "container-1", tag: "div", filters }} />);

    fireEvent.click(screen.getByRole("button", { name: "Reset effects" }));

    expect(committedNode()?.filters).toBeUndefined();
  });

  it("is undoable and redoable through the normal history stack", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorFiltersSection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.change(screen.getByLabelText("Opacity"), { target: { value: "70" } });
    fireEvent.blur(screen.getByLabelText("Opacity"));
    expect(committedNode()?.filters?.opacity).toBe(70);

    useEditorStore.getState().undo();
    expect(committedNode()?.filters).toBeUndefined();

    useEditorStore.getState().redo();
    expect(committedNode()?.filters?.opacity).toBe(70);
  });

  it("clears a stale validation error when the selected node changes", () => {
    const { rerender } = render(<InspectorFiltersSection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.change(screen.getByLabelText("Opacity"), { target: { value: "150" } });
    fireEvent.blur(screen.getByLabelText("Opacity"));
    expect(screen.getByRole("alert")).toBeInTheDocument();

    rerender(<InspectorFiltersSection node={{ id: "container-2", tag: "div" }} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("every numeric field is accessibly labelled", () => {
    render(<InspectorFiltersSection node={{ id: "container-1", tag: "div" }} />);

    for (const label of ["Opacity", "Brightness", "Contrast", "Saturation", "Hue Rotate", "Blur", "Grayscale", "Invert", "Sepia"]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });
});
