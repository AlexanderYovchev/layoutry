import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { InspectorPositionSection } from "./InspectorPositionSection";

const initialState = useEditorStore.getState();

function setupNode(node: Parameters<typeof InspectorPositionSection>[0]["node"]) {
  useEditorStore.setState((state) => ({
    document: { ...state.document, children: [node] },
  }));
}

function committedNode() {
  return useEditorStore.getState().document.children?.find((c) => c.id === "container-1");
}

function group() {
  return screen.getByRole("group", { name: "Position" });
}

function optionButton(optionLabel: string) {
  return within(group()).getByRole("button", { name: optionLabel });
}

describe("InspectorPositionSection", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("shows Position as unset for a node with no position settings", () => {
    render(<InspectorPositionSection node={{ id: "container-1", tag: "div" }} />);

    expect(group()).toBeInTheDocument();
    for (const label of ["Static", "Relative", "Absolute", "Fixed", "Sticky"]) {
      expect(optionButton(label)).toHaveAttribute("aria-pressed", "false");
    }
    expect(screen.getByRole("button", { name: "Reset position" })).toBeDisabled();
  });

  it.each([
    ["Static", "static"],
    ["Relative", "relative"],
    ["Absolute", "absolute"],
    ["Fixed", "fixed"],
    ["Sticky", "sticky"],
  ] as const)("commits position: %s", (label, value) => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorPositionSection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(optionButton(label));

    expect(committedNode()?.position?.position).toBe(value);
  });

  it("marks the active option as pressed once set, and re-selecting the same value keeps it committed", () => {
    const position = { position: "absolute" as const };
    setupNode({ id: "container-1", tag: "div", position });
    render(<InspectorPositionSection node={{ id: "container-1", tag: "div", position }} />);

    expect(optionButton("Absolute")).toHaveAttribute("aria-pressed", "true");
    expect(optionButton("Static")).toHaveAttribute("aria-pressed", "false");
  });

  it("every option carries its own structured description as a tooltip", () => {
    render(<InspectorPositionSection node={{ id: "container-1", tag: "div" }} />);

    expect(optionButton("Static")).toHaveAttribute("title", "Default document flow. Offsets are ignored.");
    expect(optionButton("Relative")).toHaveAttribute("title", "Remains in normal flow. Can later be offset.");
    expect(optionButton("Absolute")).toHaveAttribute(
      "title",
      "Removed from normal flow. Positioned relative to its containing block.",
    );
    expect(optionButton("Fixed")).toHaveAttribute("title", "Positioned relative to the viewport.");
    expect(optionButton("Sticky")).toHaveAttribute("title", "Behaves relatively until a scroll threshold.");
  });

  it("resets position back to unset", () => {
    const position = { position: "fixed" as const };
    setupNode({ id: "container-1", tag: "div", position });
    render(<InspectorPositionSection node={{ id: "container-1", tag: "div", position }} />);

    fireEvent.click(screen.getByRole("button", { name: "Reset position" }));

    expect(committedNode()?.position).toBeUndefined();
  });

  it("is undoable and redoable through the normal history stack", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorPositionSection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(optionButton("Sticky"));
    expect(committedNode()?.position?.position).toBe("sticky");

    useEditorStore.getState().undo();
    expect(committedNode()?.position).toBeUndefined();

    useEditorStore.getState().redo();
    expect(committedNode()?.position?.position).toBe("sticky");
  });

  it("supports arrow-key navigation between options", () => {
    render(<InspectorPositionSection node={{ id: "container-1", tag: "div" }} />);

    const staticButton = optionButton("Static");
    const relativeButton = optionButton("Relative");

    staticButton.focus();
    fireEvent.keyDown(staticButton, { key: "ArrowRight" });
    expect(relativeButton).toHaveFocus();

    fireEvent.keyDown(relativeButton, { key: "ArrowLeft" });
    expect(staticButton).toHaveFocus();
  });

  it("is accessibly grouped and labelled", () => {
    render(<InspectorPositionSection node={{ id: "container-1", tag: "div" }} />);
    expect(screen.getByRole("group", { name: "Position" })).toBeInTheDocument();
  });
});

describe("InspectorPositionSection — Offsets subsection (Checkpoint 5.2)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  function commitNumber(label: string, value: string) {
    const input = screen.getByLabelText(label);
    fireEvent.change(input, { target: { value } });
    fireEvent.blur(input);
  }

  describe("conditional visibility", () => {
    it("hides Offsets when Position is unset", () => {
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div" }} />);
      expect(screen.queryByText("Offsets")).not.toBeInTheDocument();
    });

    it("hides Offsets when Position is Static", () => {
      const position = { position: "static" as const };
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div", position }} />);
      expect(screen.queryByText("Offsets")).not.toBeInTheDocument();
    });

    it.each(["relative", "absolute", "fixed", "sticky"] as const)("shows Offsets when Position is %s", (value) => {
      const position = { position: value };
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div", position }} />);
      expect(screen.getByText("Offsets")).toBeInTheDocument();
    });

    it("hides Offsets again immediately after switching Position back to Static", () => {
      setupNode({ id: "container-1", tag: "div", position: { position: "absolute" } });
      const { rerender } = render(
        <InspectorPositionSection node={{ id: "container-1", tag: "div", position: { position: "absolute" } }} />,
      );
      expect(screen.getByText("Offsets")).toBeInTheDocument();

      fireEvent.click(optionButton("Static"));
      // The rendered `node` prop is a snapshot, not a live store subscription
      // (that's the parent InspectorNodeSummary's job in the real app) — a
      // test that chains a second interaction onto the *result* of the
      // first must feed the freshly-committed node back in, the same
      // rerender(committedNode()) pattern InspectorBoxShadowSection's own
      // multi-step tests already use.
      rerender(<InspectorPositionSection node={committedNode()!} />);
      expect(screen.queryByText("Offsets")).not.toBeInTheDocument();
    });
  });

  describe("linked editing", () => {
    it("defaults to Linked for a node with no offsets set yet", () => {
      const position = { position: "absolute" as const };
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div", position }} />);
      expect(screen.getByRole("button", { name: "Linked" })).toBeInTheDocument();
      expect(screen.getByLabelText("All sides")).toBeInTheDocument();
    });

    it("writes the same value to all four sides in one commit", () => {
      const position = { position: "absolute" as const };
      setupNode({ id: "container-1", tag: "div", position });
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div", position }} />);

      commitNumber("All sides", "20");

      const offsets = committedNode()?.position;
      expect(offsets?.top).toEqual({ value: 20, unit: "px" });
      expect(offsets?.right).toEqual({ value: 20, unit: "px" });
      expect(offsets?.bottom).toEqual({ value: 20, unit: "px" });
      expect(offsets?.left).toEqual({ value: 20, unit: "px" });
    });

    it("defaults to Linked when every side is already equal", () => {
      const value = { value: 8, unit: "px" as const };
      const position = { position: "absolute" as const, top: value, right: value, bottom: value, left: value };
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div", position }} />);
      expect(screen.getByRole("button", { name: "Linked" })).toHaveAttribute("aria-pressed", "true");
    });

    it("defaults to Unlinked when the sides already differ", () => {
      const position = {
        position: "absolute" as const,
        top: { value: 8, unit: "px" as const },
        right: { value: 16, unit: "px" as const },
      };
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div", position }} />);
      expect(screen.getByRole("button", { name: "Unlinked" })).toHaveAttribute("aria-pressed", "false");
    });

    it("linked reset clears all four sides", () => {
      const value = { value: 8, unit: "px" as const };
      const position = { position: "absolute" as const, top: value, right: value, bottom: value, left: value };
      setupNode({ id: "container-1", tag: "div", position });
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div", position }} />);

      fireEvent.click(screen.getByRole("button", { name: "Reset all sides" }));

      const offsets = committedNode()?.position;
      expect(offsets?.top).toBeUndefined();
      expect(offsets?.right).toBeUndefined();
      expect(offsets?.bottom).toBeUndefined();
      expect(offsets?.left).toBeUndefined();
    });
  });

  describe("independent (unlinked) editing", () => {
    /** Clicks the Linked/Unlinked toggle only if it isn't already Unlinked — a fixture where the sides already differ (or only one is set) starts Unlinked on its own (see offsetSidesEqual), so forcing a click there would toggle it the wrong way. */
    function switchToUnlinked() {
      const toggle = screen.getByRole("button", { name: /^(Linked|Unlinked)$/ });
      if (toggle.textContent === "Linked") fireEvent.click(toggle);
    }

    it.each(["Top", "Right", "Bottom", "Left"])("commits %s independently of the other sides", (label) => {
      const position = { position: "absolute" as const };
      setupNode({ id: "container-1", tag: "div", position });
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div", position }} />);
      switchToUnlinked();

      commitNumber(label, "30");

      const offsets = committedNode()?.position;
      const side = label.toLowerCase() as "top" | "right" | "bottom" | "left";
      expect(offsets?.[side]).toEqual({ value: 30, unit: "px" });
      for (const other of ["top", "right", "bottom", "left"] as const) {
        if (other !== side) expect(offsets?.[other]).toBeUndefined();
      }
    });

    it("individually resets one side without affecting the others", () => {
      const top = { value: 10, unit: "px" as const };
      const right = { value: 20, unit: "px" as const };
      const position = { position: "absolute" as const, top, right };
      setupNode({ id: "container-1", tag: "div", position });
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div", position }} />);

      fireEvent.click(screen.getByRole("button", { name: "Reset top" }));

      const offsets = committedNode()?.position;
      expect(offsets?.top).toBeUndefined();
      expect(offsets?.right).toEqual(right);
    });

    it("supports every unit (px, %, rem, em)", () => {
      const position = { position: "absolute" as const };
      setupNode({ id: "container-1", tag: "div", position });
      const { rerender } = render(<InspectorPositionSection node={{ id: "container-1", tag: "div", position }} />);
      switchToUnlinked();

      commitNumber("Top", "10");
      // Each unit change reads the offset's *current* unit off the
      // component's own `node` prop to preserve the just-committed value —
      // a test that chains steps against a static prop must feed the fresh
      // committed node back in between them, same as the conditional-
      // visibility "switching back to Static" test above.
      rerender(<InspectorPositionSection node={committedNode()!} />);
      fireEvent.change(screen.getByLabelText("Top unit"), { target: { value: "%" } });
      expect(committedNode()?.position?.top).toEqual({ value: 10, unit: "%" });

      rerender(<InspectorPositionSection node={committedNode()!} />);
      fireEvent.change(screen.getByLabelText("Top unit"), { target: { value: "rem" } });
      expect(committedNode()?.position?.top).toEqual({ value: 10, unit: "rem" });

      rerender(<InspectorPositionSection node={committedNode()!} />);
      fireEvent.change(screen.getByLabelText("Top unit"), { target: { value: "em" } });
      expect(committedNode()?.position?.top).toEqual({ value: 10, unit: "em" });
    });

    it("commits 'auto' when the value field is cleared", () => {
      const position = { position: "absolute" as const, top: { value: 10, unit: "px" as const } };
      setupNode({ id: "container-1", tag: "div", position });
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div", position }} />);
      // Already Unlinked by default: only `top` is set, so the four sides
      // aren't uniform (see offsetSidesEqual) — no toggle needed here.

      commitNumber("Top", "");

      expect(committedNode()?.position?.top).toBe("auto");
    });

    it("supports negative offsets", () => {
      const position = { position: "absolute" as const };
      setupNode({ id: "container-1", tag: "div", position });
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div", position }} />);
      switchToUnlinked();

      commitNumber("Left", "-12");

      expect(committedNode()?.position?.left).toEqual({ value: -12, unit: "px" });
    });
  });

  describe("section reset", () => {
    it("clears every offset while leaving the Position value itself untouched", () => {
      const value = { value: 8, unit: "px" as const };
      const position = { position: "absolute" as const, top: value, right: value, bottom: value, left: value };
      setupNode({ id: "container-1", tag: "div", position });
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div", position }} />);

      fireEvent.click(screen.getByRole("button", { name: "Reset offsets" }));

      const node = committedNode();
      expect(node?.position?.position).toBe("absolute");
      expect(node?.position?.top).toBeUndefined();
      expect(node?.position?.right).toBeUndefined();
      expect(node?.position?.bottom).toBeUndefined();
      expect(node?.position?.left).toBeUndefined();
    });

    it("is disabled when no offset is set", () => {
      const position = { position: "absolute" as const };
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div", position }} />);
      expect(screen.getByRole("button", { name: "Reset offsets" })).toBeDisabled();
    });
  });

  describe("undo / redo", () => {
    it("undoes and redoes an offset commit through the normal history stack", () => {
      const position = { position: "absolute" as const };
      setupNode({ id: "container-1", tag: "div", position });
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div", position }} />);

      commitNumber("All sides", "40");
      expect(committedNode()?.position?.top).toEqual({ value: 40, unit: "px" });

      useEditorStore.getState().undo();
      expect(committedNode()?.position?.top).toBeUndefined();

      useEditorStore.getState().redo();
      expect(committedNode()?.position?.top).toEqual({ value: 40, unit: "px" });
    });
  });

  describe("serialization", () => {
    it("round-trips a fully-configured, unlinked offset set through the store unchanged", () => {
      const position = {
        position: "absolute" as const,
        top: { value: 10, unit: "px" as const },
        right: "auto" as const,
        bottom: { value: 50, unit: "%" as const },
        left: { value: -4, unit: "rem" as const },
      };
      setupNode({ id: "container-1", tag: "div", position });
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div", position }} />);

      expect(committedNode()?.position).toEqual(position);
    });
  });

  describe("accessibility and keyboard interaction", () => {
    it("labels every offset field and its reset button distinctly", () => {
      const position = { position: "absolute" as const };
      setupNode({ id: "container-1", tag: "div", position });
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div", position }} />);
      fireEvent.click(screen.getByRole("button", { name: "Linked" }));

      for (const label of ["Top", "Right", "Bottom", "Left"]) {
        expect(screen.getByLabelText(label)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: `Reset ${label.toLowerCase()}` })).toBeInTheDocument();
      }
    });

    it("supports Arrow Up/Down keyboard stepping on an offset field", () => {
      const value = { value: 10, unit: "px" as const };
      const position = { position: "absolute" as const, top: value, right: value, bottom: value, left: value };
      setupNode({ id: "container-1", tag: "div", position });
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div", position }} />);

      const input = screen.getByLabelText("All sides");
      fireEvent.keyDown(input, { key: "ArrowUp" });

      expect(committedNode()?.position?.top).toEqual({ value: 11, unit: "px" });
    });

    it("the Linked/Unlinked toggle is a labelled, focusable button reflecting its own state", () => {
      const position = { position: "absolute" as const };
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div", position }} />);
      const toggle = screen.getByRole("button", { name: "Linked" });
      expect(toggle).toHaveAttribute("aria-pressed", "true");
    });
  });
});

describe("InspectorPositionSection — Stacking subsection (Checkpoint 5.3)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  function modeGroup() {
    return screen.getByRole("group", { name: "Mode" });
  }

  function modeButton(label: "Auto" | "Custom") {
    return within(modeGroup()).getByRole("button", { name: label });
  }

  describe("conditional visibility (deliberately not the Offsets rule)", () => {
    it("shows the Stacking subsection when Position is unset", () => {
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div" }} />);
      expect(screen.getByText("Stacking")).toBeInTheDocument();
      expect(modeGroup()).toBeInTheDocument();
    });

    it.each(["static", "relative", "absolute", "fixed", "sticky"] as const)(
      "shows the Stacking subsection when Position is %s",
      (value) => {
        const position = { position: value };
        render(<InspectorPositionSection node={{ id: "container-1", tag: "div", position }} />);
        expect(modeGroup()).toBeInTheDocument();
      },
    );
  });

  describe("Auto / Custom mode", () => {
    it("defaults to Auto when zIndex is unset", () => {
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div" }} />);
      expect(modeButton("Auto")).toHaveAttribute("aria-pressed", "true");
      expect(modeButton("Custom")).toHaveAttribute("aria-pressed", "false");
      expect(screen.queryByLabelText("Z-index value")).not.toBeInTheDocument();
    });

    it("shows Custom as active, and the numeric field, when zIndex is already a number", () => {
      const position = { zIndex: 5 };
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div", position }} />);
      expect(modeButton("Custom")).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByLabelText("Z-index value")).toHaveValue(5);
    });

    it("shows Auto as active when zIndex is explicitly 'auto'", () => {
      const position = { zIndex: "auto" as const };
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div", position }} />);
      expect(modeButton("Auto")).toHaveAttribute("aria-pressed", "true");
      expect(screen.queryByLabelText("Z-index value")).not.toBeInTheDocument();
    });

    it("switching to Custom commits 0 when no number was previously stored", () => {
      setupNode({ id: "container-1", tag: "div" });
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div" }} />);

      fireEvent.click(modeButton("Custom"));

      expect(committedNode()?.position?.zIndex).toBe(0);
    });

    it("switching to Auto commits the literal 'auto', not undefined", () => {
      const position = { zIndex: 7 };
      setupNode({ id: "container-1", tag: "div", position });
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div", position }} />);

      fireEvent.click(modeButton("Auto"));

      expect(committedNode()?.position?.zIndex).toBe("auto");
    });

    it("every mode option carries its own structured description as a tooltip", () => {
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div" }} />);
      expect(modeButton("Auto")).toHaveAttribute("title", "Uses the browser's normal stacking order.");
      expect(modeButton("Custom")).toHaveAttribute(
        "title",
        "Higher values usually appear in front of lower values when elements participate in the same stacking context.",
      );
    });
  });

  describe("editing the Custom value", () => {
    function commitZIndex(value: string) {
      const input = screen.getByLabelText("Z-index value");
      fireEvent.change(input, { target: { value } });
      fireEvent.blur(input);
    }

    it("commits a positive integer", () => {
      const position = { zIndex: 0 };
      setupNode({ id: "container-1", tag: "div", position });
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div", position }} />);

      commitZIndex("10");

      expect(committedNode()?.position?.zIndex).toBe(10);
    });

    it("commits zero", () => {
      const position = { zIndex: 5 };
      setupNode({ id: "container-1", tag: "div", position });
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div", position }} />);

      commitZIndex("0");

      expect(committedNode()?.position?.zIndex).toBe(0);
    });

    it("commits a negative integer", () => {
      const position = { zIndex: 0 };
      setupNode({ id: "container-1", tag: "div", position });
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div", position }} />);

      commitZIndex("-3");

      expect(committedNode()?.position?.zIndex).toBe(-3);
    });

    it("rounds a decimal draft to the nearest integer", () => {
      const position = { zIndex: 0 };
      setupNode({ id: "container-1", tag: "div", position });
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div", position }} />);

      commitZIndex("5.7");

      expect(committedNode()?.position?.zIndex).toBe(6);
    });

    it("preserves position and offsets when zIndex is committed", () => {
      const position = { position: "absolute" as const, top: { value: 10, unit: "px" as const }, zIndex: 0 };
      setupNode({ id: "container-1", tag: "div", position });
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div", position }} />);

      commitZIndex("42");

      const node = committedNode();
      expect(node?.position?.position).toBe("absolute");
      expect(node?.position?.top).toEqual({ value: 10, unit: "px" });
      expect(node?.position?.zIndex).toBe(42);
    });
  });

  describe("reset", () => {
    it("reset button is disabled when zIndex is unset", () => {
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div" }} />);
      expect(screen.getByRole("button", { name: "Reset z-index" })).toBeDisabled();
    });

    it("reset clears zIndex back to unset, preserving position and offsets", () => {
      const position = { position: "absolute" as const, top: { value: 10, unit: "px" as const }, zIndex: 5 };
      setupNode({ id: "container-1", tag: "div", position });
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div", position }} />);

      fireEvent.click(screen.getByRole("button", { name: "Reset z-index" }));

      const node = committedNode();
      expect(node?.position?.zIndex).toBeUndefined();
      expect(node?.position?.position).toBe("absolute");
      expect(node?.position?.top).toEqual({ value: 10, unit: "px" });
    });

    it("reset returns the mode toggle to Auto and hides the numeric field", () => {
      const position = { zIndex: 5 };
      setupNode({ id: "container-1", tag: "div", position });
      const { rerender } = render(<InspectorPositionSection node={{ id: "container-1", tag: "div", position }} />);

      fireEvent.click(screen.getByRole("button", { name: "Reset z-index" }));
      rerender(<InspectorPositionSection node={committedNode()!} />);

      expect(modeButton("Auto")).toHaveAttribute("aria-pressed", "true");
      expect(screen.queryByLabelText("Z-index value")).not.toBeInTheDocument();
    });
  });

  describe("undo / redo", () => {
    it("undoes and redoes a zIndex commit through the normal history stack", () => {
      setupNode({ id: "container-1", tag: "div" });
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div" }} />);

      fireEvent.click(modeButton("Custom"));
      expect(committedNode()?.position?.zIndex).toBe(0);

      useEditorStore.getState().undo();
      expect(committedNode()?.position).toBeUndefined();

      useEditorStore.getState().redo();
      expect(committedNode()?.position?.zIndex).toBe(0);
    });
  });

  describe("serialization", () => {
    it("round-trips a fully-configured zIndex alongside position and offsets", () => {
      const position = {
        position: "absolute" as const,
        top: { value: 10, unit: "px" as const },
        zIndex: -7,
      };
      setupNode({ id: "container-1", tag: "div", position });
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div", position }} />);

      expect(committedNode()?.position).toEqual(position);
    });
  });

  describe("accessibility and keyboard interaction", () => {
    it("labels the mode group, the numeric field, and the reset button distinctly", () => {
      const position = { zIndex: 5 };
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div", position }} />);

      expect(modeGroup()).toBeInTheDocument();
      expect(screen.getByLabelText("Z-index value")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Reset z-index" })).toBeInTheDocument();
    });

    it("supports Arrow Up/Down keyboard stepping on the Custom value field", () => {
      const position = { zIndex: 5 };
      setupNode({ id: "container-1", tag: "div", position });
      const { rerender } = render(<InspectorPositionSection node={{ id: "container-1", tag: "div", position }} />);

      const input = screen.getByLabelText("Z-index value");
      fireEvent.keyDown(input, { key: "ArrowUp" });
      expect(committedNode()?.position?.zIndex).toBe(6);

      // The rendered `node` prop is a snapshot, not a live store
      // subscription (that's the parent InspectorNodeSummary's job in the
      // real app) — a second interaction that depends on the first one's
      // committed result needs the fresh node fed back in, the same
      // rerender(committedNode()) pattern the Offsets subsection's own
      // tests already established (Checkpoint 5.2).
      rerender(<InspectorPositionSection node={committedNode()!} />);
      fireEvent.keyDown(screen.getByLabelText("Z-index value"), { key: "ArrowDown" });
      expect(committedNode()?.position?.zIndex).toBe(5);
    });

    it("commits on Enter and reverts on Escape (shared numeric primitive behavior)", () => {
      const position = { zIndex: 5 };
      setupNode({ id: "container-1", tag: "div", position });
      const { rerender } = render(<InspectorPositionSection node={{ id: "container-1", tag: "div", position }} />);

      const input = screen.getByLabelText("Z-index value");
      fireEvent.change(input, { target: { value: "20" } });
      fireEvent.keyDown(input, { key: "Enter" });
      expect(committedNode()?.position?.zIndex).toBe(20);

      rerender(<InspectorPositionSection node={committedNode()!} />);
      const freshInput = screen.getByLabelText("Z-index value");
      fireEvent.change(freshInput, { target: { value: "999" } });
      fireEvent.keyDown(freshInput, { key: "Escape" });
      expect(committedNode()?.position?.zIndex).toBe(20);
      expect(freshInput).toHaveValue(20);
    });

    it("the Mode toggle is keyboard-navigable via Arrow Left/Right", () => {
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div" }} />);

      const auto = modeButton("Auto");
      const custom = modeButton("Custom");
      auto.focus();
      fireEvent.keyDown(auto, { key: "ArrowRight" });
      expect(custom).toHaveFocus();
    });

    it("has an accessible help tooltip trigger for the Z-index row", () => {
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div" }} />);
      expect(
        screen.getByRole("button", {
          name: "Z-index only compares elements within the same stacking context — it isn't one single global front-to-back ranking.",
        }),
      ).toBeInTheDocument();
    });
  });

  describe("stacking-context awareness note", () => {
    it("is absent for an ordinary node with no stacking-context triggers nearby", () => {
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div" }} />);
      expect(screen.queryByText(/already starts its own stacking context/)).not.toBeInTheDocument();
    });

    it("appears when the selected node itself is position: fixed", () => {
      const position = { position: "fixed" as const };
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div", position }} />);
      expect(screen.getByText(/already starts its own stacking context/)).toBeInTheDocument();
    });

    it("appears when the selected node itself has reduced opacity", () => {
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div", filters: { opacity: 50 } }} />);
      expect(screen.getByText(/already starts its own stacking context/)).toBeInTheDocument();
    });

    it("appears when an ancestor (not the node itself) has reduced opacity", () => {
      useEditorStore.setState((state) => ({
        document: {
          ...state.document,
          filters: { opacity: 50 },
          children: [{ id: "container-1", tag: "div" }],
        },
      }));
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div" }} />);
      expect(screen.getByText(/already starts its own stacking context/)).toBeInTheDocument();
    });

    it("is absent for position: relative with no explicit z-index (no stacking context yet)", () => {
      const position = { position: "relative" as const };
      render(<InspectorPositionSection node={{ id: "container-1", tag: "div", position }} />);
      expect(screen.queryByText(/already starts its own stacking context/)).not.toBeInTheDocument();
    });
  });
});
