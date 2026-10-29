import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { selectHasUnsavedChanges, useEditorStore } from "@/features/editor/stores/useEditorStore";
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
    for (const name of ["None", "Underline", "Overline", "Line Through"]) {
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

  describe("Text Decoration (Checkpoint 1.15.6.10.3)", () => {
    it("commits a Text Decoration selection", () => {
      setupNode({ id: "heading-1", tag: "h1" });
      render(<InspectorTypographySection node={{ id: "heading-1", tag: "h1" }} />);

      fireEvent.click(screen.getByRole("button", { name: "Line Through" }));

      expect(committedNode()?.typography?.textDecorationLine).toBe("line-through");
    });

    it("commits 'None' as a real, distinct authored value — not the same as leaving it unset", () => {
      setupNode({ id: "heading-1", tag: "a", typography: { textDecorationLine: "underline" } });
      render(<InspectorTypographySection node={{ id: "heading-1", tag: "a", typography: { textDecorationLine: "underline" } }} />);

      fireEvent.click(screen.getByRole("button", { name: "None" }));

      expect(committedNode()?.typography?.textDecorationLine).toBe("none");
      expect(committedNode()?.typography?.textDecorationLine).not.toBeUndefined();
    });

    it("shows Underline as the active option for a Link with the factory's own starter decoration", () => {
      render(<InspectorTypographySection node={{ id: "heading-1", tag: "a", typography: { textDecorationLine: "underline" } }} />);
      expect(screen.getByRole("button", { name: "Underline" })).toHaveAttribute("aria-pressed", "true");
    });

    it("resets Text Decoration back to genuinely unset", () => {
      setupNode({ id: "heading-1", tag: "a", typography: { textDecorationLine: "underline" } });
      render(<InspectorTypographySection node={{ id: "heading-1", tag: "a", typography: { textDecorationLine: "underline" } }} />);

      fireEvent.click(screen.getByRole("button", { name: "Reset text decoration" }));

      expect(committedNode()?.typography?.textDecorationLine).toBeUndefined();
    });
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
    // The field's own display default is already 1.5 (see
    // InspectorTypographySection's `value={typography.lineHeight?.value ??
    // 1.5}`) — firing a single `change` to that identical string is a
    // jsdom/React no-op (React's controlled-input value tracker skips a
    // synthetic change event whose value matches the DOM's current value,
    // so onChange never actually fires). Routing through a genuinely
    // different intermediate value first reproduces a real user's
    // keystrokes reliably, still proving line-height 1.5 commits as an
    // explicit value even though it equals the unset default.
    fireEvent.change(input, { target: { value: "2" } });
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

  // BC-01.2 — Text color against the real store: history entries, Undo/
  // Redo, dirty state. The section is re-rendered from the store's node
  // (as InspectorNodeSummary does in the app), and every input is
  // focused first so Enter/Escape's .blur() dispatches a real blur.
  describe("Text color edit sessions against the real store (BC-01.2)", () => {
    function StoreBackedTypography({ nodeId }: { nodeId: string }) {
      const node = useEditorStore((state) => state.document.children?.find((child) => child.id === nodeId));
      return node ? <InspectorTypographySection node={node} /> : null;
    }

    function setupTwoNodes(headingColor?: string) {
      useEditorStore.setState((state) => {
        const document = {
          ...state.document,
          children: [
            { id: "heading-1", tag: "h1" as const, typography: headingColor ? { color: headingColor } : undefined },
            { id: "paragraph-1", tag: "p" as const },
          ],
        };
        return { document, persistedDocument: document, past: [], future: [] };
      });
    }

    const nodeById = (id: string) => useEditorStore.getState().document.children?.find((child) => child.id === id);
    const historyLength = () => useEditorStore.getState().past.length;

    it("Escape discards a changed color: document, history and dirty state untouched", () => {
      setupTwoNodes("#3366ff");
      render(<StoreBackedTypography nodeId="heading-1" />);
      const documentBefore = useEditorStore.getState().document;

      const input = screen.getByLabelText("Text color");
      act(() => input.focus());
      fireEvent.change(input, { target: { value: "#00ff00" } });
      fireEvent.keyDown(input, { key: "Escape" });

      expect(useEditorStore.getState().document).toBe(documentBefore);
      expect(historyLength()).toBe(0);
      expect(selectHasUnsavedChanges(useEditorStore.getState())).toBe(false);
      expect(input).toHaveValue("#3366ff");
    });

    it("Enter commits once: one Undo restores the old color, one Redo reapplies the new one", () => {
      setupTwoNodes("#3366ff");
      render(<StoreBackedTypography nodeId="heading-1" />);

      const input = screen.getByLabelText("Text color");
      act(() => input.focus());
      fireEvent.change(input, { target: { value: "#ff0000" } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(historyLength()).toBe(1);
      expect(nodeById("heading-1")?.typography?.color).toBe("#ff0000");

      act(() => useEditorStore.getState().undo());
      expect(nodeById("heading-1")?.typography?.color).toBe("#3366ff");
      expect(input).toHaveValue("#3366ff");

      act(() => useEditorStore.getState().redo());
      expect(nodeById("heading-1")?.typography?.color).toBe("#ff0000");
      expect(input).toHaveValue("#ff0000");
    });

    it("a plain blur after editing commits exactly one history entry", () => {
      setupTwoNodes();
      render(<StoreBackedTypography nodeId="heading-1" />);

      const input = screen.getByLabelText("Text color");
      act(() => input.focus());
      fireEvent.change(input, { target: { value: "rgb(10, 20, 30)" } });
      act(() => input.blur());

      expect(historyLength()).toBe(1);
      expect(nodeById("heading-1")?.typography?.color).toBe("rgb(10, 20, 30)");
    });

    it("focus and blur with no edit: no history, no document change, project stays clean (set color)", () => {
      setupTwoNodes("#3366ff");
      render(<StoreBackedTypography nodeId="heading-1" />);
      const documentBefore = useEditorStore.getState().document;

      const input = screen.getByLabelText("Text color");
      act(() => input.focus());
      act(() => input.blur());
      act(() => input.focus());
      fireEvent.keyDown(input, { key: "Enter" });

      expect(useEditorStore.getState().document).toBe(documentBefore);
      expect(historyLength()).toBe(0);
      expect(selectHasUnsavedChanges(useEditorStore.getState())).toBe(false);
    });

    it("an unset color stays unset after a no-op focus/blur and after an emptied draft", () => {
      setupTwoNodes();
      render(<StoreBackedTypography nodeId="heading-1" />);

      const input = screen.getByLabelText("Text color");
      act(() => input.focus());
      act(() => input.blur());
      act(() => input.focus());
      fireEvent.change(input, { target: { value: "#1" } });
      fireEvent.change(input, { target: { value: "" } });
      act(() => input.blur());

      expect(nodeById("heading-1")?.typography?.color).toBeUndefined();
      expect(historyLength()).toBe(0);
      expect(input).toHaveValue("");
    });

    it("an invalid color shows the error and leaves the document and history untouched", () => {
      setupTwoNodes("#3366ff");
      render(<StoreBackedTypography nodeId="heading-1" />);
      const documentBefore = useEditorStore.getState().document;

      const input = screen.getByLabelText("Text color");
      act(() => input.focus());
      fireEvent.change(input, { target: { value: "#12" } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(useEditorStore.getState().document).toBe(documentBefore);
      expect(historyLength()).toBe(0);
      expect(screen.getByText("Enter a hex color (#RRGGBB) or an rgb()/rgba() value.")).toBeInTheDocument();
    });

    it("a selection change after the edit's blur commits to the ORIGINAL element only (the app's real event order: mousedown blurs before the click selects)", () => {
      setupTwoNodes();
      const { rerender } = render(<StoreBackedTypography nodeId="heading-1" />);

      const input = screen.getByLabelText("Text color");
      act(() => input.focus());
      fireEvent.change(input, { target: { value: "#ff0000" } });
      act(() => input.blur());
      rerender(<StoreBackedTypography nodeId="paragraph-1" />);

      expect(nodeById("heading-1")?.typography?.color).toBe("#ff0000");
      expect(nodeById("paragraph-1")?.typography).toBeUndefined();
      expect(screen.getByLabelText("Text color")).toHaveValue("");
      expect(historyLength()).toBe(1);
    });
  });
});
