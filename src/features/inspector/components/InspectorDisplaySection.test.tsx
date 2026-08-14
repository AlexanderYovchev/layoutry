import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { InspectorDisplaySection } from "./InspectorDisplaySection";

const initialState = useEditorStore.getState();

function setupNode(node: Parameters<typeof InspectorDisplaySection>[0]["node"]) {
  useEditorStore.setState((state) => ({
    document: { ...state.document, children: [node] },
  }));
}

function committedNode() {
  return useEditorStore.getState().document.children?.find((c) => c.id === "container-1");
}

/** Several groups share an option label (e.g. "None" appears in Display, Pointer Events, and User Select) — scope every lookup to its own group so getByRole never matches more than one button. */
function optionButton(groupLabel: string, optionLabel: string) {
  return within(screen.getByRole("group", { name: groupLabel })).getByRole("button", { name: optionLabel });
}

describe("InspectorDisplaySection", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("shows every field as unset for a node with no display settings", () => {
    render(<InspectorDisplaySection node={{ id: "container-1", tag: "div" }} />);

    // A brand-new node has no overflow data at all, so overflowAxesEqual
    // defaults it to Linked mode — a single "Overflow" group, not the
    // Unlinked "Horizontal (X)"/"Vertical (Y)" pair (see the dedicated
    // Overflow describe block below for both modes).
    for (const label of ["Display", "Visibility", "Pointer Events", "Cursor", "Overflow", "User Select"]) {
      expect(screen.getByRole("group", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Reset display settings" })).toBeDisabled();
  });

  it("commits display", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorDisplaySection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(optionButton("Display", "None"));

    expect(committedNode()?.display?.display).toBe("none");
  });

  it("commits visibility independently of display", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorDisplaySection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(optionButton("Visibility", "Hidden"));

    expect(committedNode()?.display?.visibility).toBe("hidden");
    expect(committedNode()?.display?.display).toBeUndefined();
  });

  it("commits pointer events", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorDisplaySection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(optionButton("Pointer Events", "None"));

    expect(committedNode()?.display?.pointerEvents).toBe("none");
  });

  it("commits cursor", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorDisplaySection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(optionButton("Cursor", "Grab"));

    expect(committedNode()?.display?.cursor).toBe("grab");
  });

  it("commits user select", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorDisplaySection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(optionButton("User Select", "All"));

    expect(committedNode()?.display?.userSelect).toBe("all");
  });

  it("resets a single property without affecting the others", () => {
    const display = { display: "none" as const, cursor: "pointer" as const };
    setupNode({ id: "container-1", tag: "div", display });
    render(<InspectorDisplaySection node={{ id: "container-1", tag: "div", display }} />);

    fireEvent.click(screen.getByRole("button", { name: "Reset display" }));

    expect(committedNode()?.display?.display).toBeUndefined();
    expect(committedNode()?.display?.cursor).toBe("pointer");
  });

  it("Reset display settings clears every field at once", () => {
    const display = { display: "none" as const, cursor: "pointer" as const, visibility: "hidden" as const };
    setupNode({ id: "container-1", tag: "div", display });
    render(<InspectorDisplaySection node={{ id: "container-1", tag: "div", display }} />);

    fireEvent.click(screen.getByRole("button", { name: "Reset display settings" }));

    expect(committedNode()?.display).toBeUndefined();
  });

  it("is undoable and redoable through the normal history stack", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorDisplaySection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(optionButton("Display", "None"));
    expect(committedNode()?.display?.display).toBe("none");

    useEditorStore.getState().undo();
    expect(committedNode()?.display).toBeUndefined();

    useEditorStore.getState().redo();
    expect(committedNode()?.display?.display).toBe("none");
  });

  it("every enum field is accessibly grouped and labelled", () => {
    render(<InspectorDisplaySection node={{ id: "container-1", tag: "div" }} />);

    for (const label of ["Display", "Visibility", "Pointer Events", "Cursor", "Overflow", "User Select"]) {
      expect(screen.getByRole("group", { name: label })).toBeInTheDocument();
    }
  });
});

describe("InspectorDisplaySection — Overflow subsection (Checkpoint 5.4)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("upgrades the existing Overflow control in place — no duplicate Overflow section exists", () => {
    render(<InspectorDisplaySection node={{ id: "container-1", tag: "div" }} />);

    // Exactly one accessible control group named "Overflow" (the segmented
    // row) — the subsection header span also reads "Overflow" in plain
    // text, which is fine (a label above its own control, same as every
    // other sub-section header in this file), but there must be only one
    // real *group*, and only one top-level "Display & Visibility" section.
    expect(screen.getAllByRole("group", { name: "Overflow" })).toHaveLength(1);
    expect(screen.getAllByText("Overflow")).toHaveLength(2);
  });

  it("defaults to Linked mode for a node with no overflow data", () => {
    render(<InspectorDisplaySection node={{ id: "container-1", tag: "div" }} />);

    expect(screen.getByRole("group", { name: "Overflow" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Horizontal (X)" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Vertical (Y)" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Linked" })).toBeInTheDocument();
  });

  it("defaults to Linked mode for a legacy (pre-5.4) document whose axes already match", () => {
    const display = { overflowX: "hidden" as const, overflowY: "hidden" as const };
    render(<InspectorDisplaySection node={{ id: "container-1", tag: "div", display }} />);

    expect(screen.getByRole("group", { name: "Overflow" })).toBeInTheDocument();
    expect(optionButton("Overflow", "Hidden")).toHaveAttribute("aria-pressed", "true");
  });

  it("defaults to Unlinked mode for a legacy (pre-5.4) document whose axes differ", () => {
    const display = { overflowX: "hidden" as const, overflowY: "auto" as const };
    render(<InspectorDisplaySection node={{ id: "container-1", tag: "div", display }} />);

    expect(screen.getByRole("group", { name: "Horizontal (X)" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Vertical (Y)" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Overflow" })).not.toBeInTheDocument();
    expect(optionButton("Horizontal (X)", "Hidden")).toHaveAttribute("aria-pressed", "true");
    expect(optionButton("Vertical (Y)", "Auto")).toHaveAttribute("aria-pressed", "true");
  });

  it("commits every supported value in Linked mode, including Clip", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorDisplaySection node={{ id: "container-1", tag: "div" }} />);

    for (const label of ["Visible", "Hidden", "Clip", "Auto", "Scroll"]) {
      fireEvent.click(optionButton("Overflow", label));
      expect(committedNode()?.display?.overflow).toBe(label.toLowerCase());
    }
  });

  it("Linked mode writes the unified overflow field and never overflowX/overflowY", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorDisplaySection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(optionButton("Overflow", "Hidden"));

    expect(committedNode()?.display?.overflow).toBe("hidden");
    expect(committedNode()?.display?.overflowX).toBeUndefined();
    expect(committedNode()?.display?.overflowY).toBeUndefined();
  });

  it("toggling to Unlinked mode does not write to the document (zero history entries)", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorDisplaySection node={{ id: "container-1", tag: "div" }} />);
    const historyLengthBefore = useEditorStore.getState().past.length;

    fireEvent.click(screen.getByRole("button", { name: "Linked" }));

    expect(screen.getByRole("group", { name: "Horizontal (X)" })).toBeInTheDocument();
    expect(committedNode()?.display).toBeUndefined();
    expect(useEditorStore.getState().past.length).toBe(historyLengthBefore);
  });

  it("edits X and Y independently in Unlinked mode, each as its own single commit", () => {
    setupNode({ id: "container-1", tag: "div" });
    const { rerender } = render(<InspectorDisplaySection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Linked" }));
    fireEvent.click(optionButton("Horizontal (X)", "Hidden"));

    expect(committedNode()?.display?.overflowX).toBe("hidden");
    expect(committedNode()?.display?.overflowY).toBeUndefined();
    expect(committedNode()?.display?.overflow).toBeUndefined();

    rerender(<InspectorDisplaySection node={committedNode()!} />);
    fireEvent.click(optionButton("Vertical (Y)", "Auto"));

    expect(committedNode()?.display?.overflowX).toBe("hidden");
    expect(committedNode()?.display?.overflowY).toBe("auto");
  });

  it("editing one axis while shorthand-backed seeds the untouched axis from the prior unified value", () => {
    const display = { overflow: "hidden" as const };
    setupNode({ id: "container-1", tag: "div", display });
    render(<InspectorDisplaySection node={{ id: "container-1", tag: "div", display }} />);

    fireEvent.click(screen.getByRole("button", { name: "Linked" }));
    fireEvent.click(optionButton("Horizontal (X)", "Auto"));

    expect(committedNode()?.display?.overflowX).toBe("auto");
    expect(committedNode()?.display?.overflowY).toBe("hidden");
    expect(committedNode()?.display?.overflow).toBeUndefined();
  });

  it("switching Unlinked -> Linked does not write to the document either (pure view toggle both ways)", () => {
    const display = { overflowX: "hidden" as const, overflowY: "auto" as const };
    setupNode({ id: "container-1", tag: "div", display });
    render(<InspectorDisplaySection node={{ id: "container-1", tag: "div", display }} />);
    const historyLengthBefore = useEditorStore.getState().past.length;

    fireEvent.click(screen.getByRole("button", { name: "Unlinked" }));

    expect(screen.getByRole("group", { name: "Overflow" })).toBeInTheDocument();
    expect(committedNode()?.display).toEqual(display);
    expect(useEditorStore.getState().past.length).toBe(historyLengthBefore);
  });

  it("resets X independently without affecting Y", () => {
    const display = { overflowX: "hidden" as const, overflowY: "auto" as const };
    setupNode({ id: "container-1", tag: "div", display });
    render(<InspectorDisplaySection node={{ id: "container-1", tag: "div", display }} />);

    fireEvent.click(screen.getByRole("button", { name: "Reset horizontal (x)" }));

    expect(committedNode()?.display?.overflowX).toBeUndefined();
    expect(committedNode()?.display?.overflowY).toBe("auto");
  });

  it("resets Y independently without affecting X", () => {
    const display = { overflowX: "hidden" as const, overflowY: "auto" as const };
    setupNode({ id: "container-1", tag: "div", display });
    render(<InspectorDisplaySection node={{ id: "container-1", tag: "div", display }} />);

    fireEvent.click(screen.getByRole("button", { name: "Reset vertical (y)" }));

    expect(committedNode()?.display?.overflowY).toBeUndefined();
    expect(committedNode()?.display?.overflowX).toBe("hidden");
  });

  it("Reset overflow clears both axes (and the shorthand) in one action, in either mode", () => {
    const display = { overflowX: "hidden" as const, overflowY: "auto" as const };
    setupNode({ id: "container-1", tag: "div", display });
    render(<InspectorDisplaySection node={{ id: "container-1", tag: "div", display }} />);

    fireEvent.click(screen.getByRole("button", { name: "Reset overflow" }));

    expect(committedNode()?.display?.overflow).toBeUndefined();
    expect(committedNode()?.display?.overflowX).toBeUndefined();
    expect(committedNode()?.display?.overflowY).toBeUndefined();
  });

  it("Reset overflow is disabled when nothing is set, and enabled once Linked mode has a value", () => {
    setupNode({ id: "container-1", tag: "div" });
    const { rerender } = render(<InspectorDisplaySection node={{ id: "container-1", tag: "div" }} />);

    expect(screen.getByRole("button", { name: "Reset overflow" })).toBeDisabled();

    fireEvent.click(optionButton("Overflow", "Scroll"));
    rerender(<InspectorDisplaySection node={committedNode()!} />);

    expect(screen.getByRole("button", { name: "Reset overflow" })).not.toBeDisabled();
  });

  it("is undoable and redoable through the normal history stack", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorDisplaySection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(optionButton("Overflow", "Hidden"));
    expect(committedNode()?.display?.overflow).toBe("hidden");

    useEditorStore.getState().undo();
    expect(committedNode()?.display).toBeUndefined();

    useEditorStore.getState().redo();
    expect(committedNode()?.display?.overflow).toBe("hidden");
  });

  it("round-trips through a serialized document unchanged", () => {
    const display = { overflowX: "hidden" as const, overflowY: "scroll" as const };
    setupNode({ id: "container-1", tag: "div", display });

    const serialized = JSON.stringify(useEditorStore.getState().document);
    const restored = JSON.parse(serialized);
    const restoredNode = restored.children.find((c: { id: string }) => c.id === "container-1");

    expect(restoredNode.display).toEqual(display);
  });

  it("every segmented option carries accessible help metadata distinguishing Hidden from Clip", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorDisplaySection node={{ id: "container-1", tag: "div" }} />);

    expect(optionButton("Overflow", "Hidden")).toHaveAttribute(
      "title",
      expect.stringContaining("Programmatic scrolling may still exist"),
    );
    expect(optionButton("Overflow", "Clip")).toHaveAttribute(
      "title",
      expect.stringContaining("without creating a scroll container"),
    );
  });

  it("supports arrow-key navigation between segmented options", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorDisplaySection node={{ id: "container-1", tag: "div" }} />);

    const visible = optionButton("Overflow", "Visible");
    visible.focus();
    fireEvent.keyDown(visible, { key: "ArrowRight" });

    expect(optionButton("Overflow", "Hidden")).toHaveFocus();
  });

  it("the Link toggle is keyboard-operable and exposes aria-pressed", () => {
    render(<InspectorDisplaySection node={{ id: "container-1", tag: "div" }} />);

    const toggle = screen.getByRole("button", { name: "Linked" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
  });
});
