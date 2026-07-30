import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { InspectorTypographySection } from "./InspectorTypographySection";

const initialState = useEditorStore.getState();

function setupNode(node: Parameters<typeof InspectorTypographySection>[0]["node"]) {
  useEditorStore.setState((state) => ({
    document: { ...state.document, children: [node] },
  }));
}

function committedNode() {
  return useEditorStore.getState().document.children?.find((c) => c.id === "heading-1");
}

describe("InspectorTypographySection", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("shows every field as unset for a node with no typography", () => {
    render(<InspectorTypographySection node={{ id: "heading-1", tag: "h1" }} />);

    expect(screen.getByRole("combobox", { name: "Font" })).toHaveValue("");
    expect(screen.getByLabelText("Font size")).toHaveValue(16);
    expect(screen.getByLabelText("Text color")).toHaveValue("");
    // No Weight/Style/Align option is falsely highlighted when unset — each
    // tag's own real default differs (an h1 already renders at font-weight
    // 600, not a hardcoded "Regular"), so none of them should show
    // aria-pressed=true until a value is genuinely, explicitly set.
    for (const name of ["Thin", "Extra Light", "Light", "Regular", "Medium", "Semi Bold", "Bold", "Extra Bold", "Black"]) {
      expect(screen.getByRole("button", { name })).toHaveAttribute("aria-pressed", "false");
    }
    for (const name of ["Normal", "Italic", "Oblique"]) {
      expect(screen.getByRole("button", { name })).toHaveAttribute("aria-pressed", "false");
    }
    for (const name of ["Left", "Center", "Right", "Justify"]) {
      expect(screen.getByRole("button", { name })).toHaveAttribute("aria-pressed", "false");
    }
  });

  it("commits a Font Family selection through setElementTypography", () => {
    setupNode({ id: "heading-1", tag: "h1" });
    render(<InspectorTypographySection node={{ id: "heading-1", tag: "h1" }} />);

    fireEvent.focus(screen.getByRole("combobox", { name: "Font" }));
    fireEvent.click(screen.getByRole("option", { name: "Georgia" }));

    expect(committedNode()?.typography?.fontFamily).toBe('Georgia, "Times New Roman", serif');
  });

  it("commits Font Size with its unit", () => {
    setupNode({ id: "heading-1", tag: "h1" });
    render(<InspectorTypographySection node={{ id: "heading-1", tag: "h1" }} />);

    const input = screen.getByLabelText("Font size");
    fireEvent.change(input, { target: { value: "32" } });
    fireEvent.blur(input);

    expect(committedNode()?.typography?.fontSize).toEqual({ value: 32, unit: "px" });
  });

  it("changes the Font Size unit without altering the numeric value", () => {
    setupNode({ id: "heading-1", tag: "h1", typography: { fontSize: { value: 2, unit: "rem" } } });
    render(<InspectorTypographySection node={{ id: "heading-1", tag: "h1", typography: { fontSize: { value: 2, unit: "rem" } } }} />);

    fireEvent.change(screen.getByLabelText("Font size unit"), { target: { value: "em" } });

    expect(committedNode()?.typography?.fontSize).toEqual({ value: 2, unit: "em" });
  });

  it("rejects a zero or negative font size with a clear validation message and does not commit", () => {
    setupNode({ id: "heading-1", tag: "h1" });
    render(<InspectorTypographySection node={{ id: "heading-1", tag: "h1" }} />);

    const input = screen.getByLabelText("Font size");
    fireEvent.change(input, { target: { value: "-10" } });
    fireEvent.blur(input);

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a font size greater than 0.");
    expect(committedNode()?.typography?.fontSize).toBeUndefined();
  });

  it("resets Font Size, removing the explicit value rather than writing a guessed default", () => {
    setupNode({ id: "heading-1", tag: "h1", typography: { fontSize: { value: 32, unit: "px" } } });
    render(<InspectorTypographySection node={{ id: "heading-1", tag: "h1", typography: { fontSize: { value: 32, unit: "px" } } }} />);

    fireEvent.click(screen.getByRole("button", { name: "Reset font size" }));

    expect(committedNode()?.typography?.fontSize).toBeUndefined();
    expect(committedNode()?.typography).toBeUndefined();
  });

  it("commits a Font Weight selection by its numeric value", () => {
    setupNode({ id: "heading-1", tag: "h1" });
    render(<InspectorTypographySection node={{ id: "heading-1", tag: "h1" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Bold" }));

    expect(committedNode()?.typography?.fontWeight).toBe(700);
  });

  it("commits a Font Style selection", () => {
    setupNode({ id: "heading-1", tag: "h1" });
    render(<InspectorTypographySection node={{ id: "heading-1", tag: "h1" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Italic" }));

    expect(committedNode()?.typography?.fontStyle).toBe("italic");
  });

  it("commits a valid hex Text Color", () => {
    setupNode({ id: "heading-1", tag: "h1" });
    render(<InspectorTypographySection node={{ id: "heading-1", tag: "h1" }} />);

    const input = screen.getByLabelText("Text color");
    fireEvent.change(input, { target: { value: "#ff0000" } });
    fireEvent.blur(input);

    expect(committedNode()?.typography?.color).toBe("#ff0000");
  });

  it("commits a valid rgba() Text Color", () => {
    setupNode({ id: "heading-1", tag: "h1" });
    render(<InspectorTypographySection node={{ id: "heading-1", tag: "h1" }} />);

    const input = screen.getByLabelText("Text color");
    fireEvent.change(input, { target: { value: "rgba(0, 128, 255, 0.5)" } });
    fireEvent.blur(input);

    expect(committedNode()?.typography?.color).toBe("rgba(0, 128, 255, 0.5)");
  });

  it("rejects a malformed Text Color with a clear validation message and does not commit or crash", () => {
    setupNode({ id: "heading-1", tag: "h1" });
    render(<InspectorTypographySection node={{ id: "heading-1", tag: "h1" }} />);

    const input = screen.getByLabelText("Text color");
    fireEvent.change(input, { target: { value: "not-a-color" } });
    fireEvent.blur(input);

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a hex color (#RRGGBB) or an rgb()/rgba() value.");
    expect(committedNode()?.typography?.color).toBeUndefined();
  });

  it("commits a Text Alignment selection", () => {
    setupNode({ id: "heading-1", tag: "h1" });
    render(<InspectorTypographySection node={{ id: "heading-1", tag: "h1" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Center" }));

    expect(committedNode()?.typography?.textAlign).toBe("center");
  });

  it("commits a unitless Line Height", () => {
    setupNode({ id: "heading-1", tag: "h1" });
    render(<InspectorTypographySection node={{ id: "heading-1", tag: "h1" }} />);

    const input = screen.getByLabelText("Line height");
    fireEvent.change(input, { target: { value: "1.5" } });
    fireEvent.blur(input);

    expect(committedNode()?.typography?.lineHeight).toEqual({ value: 1.5, unit: "unitless" });
  });

  it("rejects a negative Line Height", () => {
    setupNode({ id: "heading-1", tag: "h1" });
    render(<InspectorTypographySection node={{ id: "heading-1", tag: "h1" }} />);

    const input = screen.getByLabelText("Line height");
    fireEvent.change(input, { target: { value: "-1" } });
    fireEvent.blur(input);

    expect(screen.getByText("Line height can't be negative.")).toBeInTheDocument();
    expect(committedNode()?.typography?.lineHeight).toBeUndefined();
  });

  it("commits a negative Letter Spacing value", () => {
    setupNode({ id: "heading-1", tag: "h1" });
    render(<InspectorTypographySection node={{ id: "heading-1", tag: "h1" }} />);

    const input = screen.getByLabelText("Letter spacing");
    fireEvent.change(input, { target: { value: "-0.5" } });
    fireEvent.blur(input);

    expect(committedNode()?.typography?.letterSpacing).toEqual({ value: -0.5, unit: "px" });
  });

  it("is undoable and redoable through the normal history stack", () => {
    setupNode({ id: "heading-1", tag: "h1" });
    render(<InspectorTypographySection node={{ id: "heading-1", tag: "h1" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Bold" }));
    expect(committedNode()?.typography?.fontWeight).toBe(700);

    useEditorStore.getState().undo();
    expect(committedNode()?.typography?.fontWeight).toBeUndefined();

    useEditorStore.getState().redo();
    expect(committedNode()?.typography?.fontWeight).toBe(700);
  });

  it("clears a stale validation error when the selected node changes", () => {
    const { rerender } = render(<InspectorTypographySection node={{ id: "heading-1", tag: "h1" }} />);

    const input = screen.getByLabelText("Font size");
    fireEvent.change(input, { target: { value: "-10" } });
    fireEvent.blur(input);
    expect(screen.getByRole("alert")).toBeInTheDocument();

    rerender(<InspectorTypographySection node={{ id: "heading-2", tag: "h1" }} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
