import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { InspectorAspectRatioFields } from "./InspectorAspectRatioFields";
import type { EditorElementNode } from "@/features/editor/types/document";

const initialState = useEditorStore.getState();

function setupNode(node: EditorElementNode) {
  useEditorStore.setState((state) => ({
    document: { ...state.document, children: [node] },
  }));
}

function committedNode() {
  return useEditorStore.getState().document.children?.find((c) => c.id === "container-1");
}

function optionButton(optionLabel: string) {
  return within(screen.getByRole("group", { name: "Aspect Ratio" })).getByRole("button", { name: optionLabel });
}

describe("InspectorAspectRatioFields", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("renders a single Aspect Ratio control with no section wrapper of its own (Checkpoint 5.7 — composed inside InspectorSizeSection instead)", () => {
    render(<InspectorAspectRatioFields node={{ id: "container-1", tag: "div" }} />);

    expect(screen.getAllByRole("group", { name: "Aspect Ratio" })).toHaveLength(1);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("shows nothing selected, and Reset disabled, for a node with no aspect ratio", () => {
    render(<InspectorAspectRatioFields node={{ id: "container-1", tag: "div" }} />);

    for (const label of ["Auto", "Square", "Landscape", "Widescreen", "Portrait", "Custom"]) {
      expect(optionButton(label)).toHaveAttribute("aria-pressed", "false");
    }
    expect(screen.getByRole("button", { name: "Reset aspect ratio" })).toBeDisabled();
    expect(screen.queryByLabelText("Aspect ratio width")).not.toBeInTheDocument();
  });

  it("commits explicit Auto", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorAspectRatioFields node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(optionButton("Auto"));

    expect(committedNode()?.aspectRatio).toEqual({ mode: "auto" });
  });

  it.each([
    ["Square", { mode: "ratio", width: 1, height: 1 }],
    ["Landscape", { mode: "ratio", width: 4, height: 3 }],
    ["Widescreen", { mode: "ratio", width: 16, height: 9 }],
    ["Portrait", { mode: "ratio", width: 3, height: 4 }],
  ] as const)("commits the %s preset", (label, expected) => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorAspectRatioFields node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(optionButton(label));

    expect(committedNode()?.aspectRatio).toEqual(expected);
  });

  it("reveals Custom width/height fields when Custom is selected from Auto, seeding a default 1:1", () => {
    setupNode({ id: "container-1", tag: "div" });
    const { rerender } = render(<InspectorAspectRatioFields node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(optionButton("Custom"));

    expect(committedNode()?.aspectRatio).toEqual({ mode: "ratio", width: 1, height: 1 });
    rerender(<InspectorAspectRatioFields node={committedNode()!} />);
    expect(screen.getByLabelText("Aspect ratio width")).toHaveValue(1);
    expect(screen.getByLabelText("Aspect ratio height")).toHaveValue(1);
  });

  it("selecting Custom while already ratio-shaped only reveals the fields — no document commit", () => {
    const aspectRatio = { mode: "ratio" as const, width: 3, height: 2 };
    setupNode({ id: "container-1", tag: "div", aspectRatio });
    render(<InspectorAspectRatioFields node={{ id: "container-1", tag: "div", aspectRatio }} />);
    const historyLengthBefore = useEditorStore.getState().past.length;

    fireEvent.click(optionButton("Custom"));

    expect(committedNode()?.aspectRatio).toEqual(aspectRatio);
    expect(useEditorStore.getState().past.length).toBe(historyLengthBefore);
    expect(screen.getByLabelText("Aspect ratio width")).toHaveValue(3);
    expect(screen.getByLabelText("Aspect ratio height")).toHaveValue(2);
  });

  it("edits the custom numerator independently of the denominator", () => {
    const aspectRatio = { mode: "ratio" as const, width: 3, height: 2 };
    setupNode({ id: "container-1", tag: "div", aspectRatio });
    render(<InspectorAspectRatioFields node={{ id: "container-1", tag: "div", aspectRatio }} />);

    const widthField = screen.getByLabelText("Aspect ratio width");
    fireEvent.change(widthField, { target: { value: "5" } });
    fireEvent.blur(widthField);

    expect(committedNode()?.aspectRatio).toEqual({ mode: "ratio", width: 5, height: 2 });
  });

  it("edits the custom denominator independently of the numerator", () => {
    const aspectRatio = { mode: "ratio" as const, width: 3, height: 2 };
    setupNode({ id: "container-1", tag: "div", aspectRatio });
    render(<InspectorAspectRatioFields node={{ id: "container-1", tag: "div", aspectRatio }} />);

    const heightField = screen.getByLabelText("Aspect ratio height");
    fireEvent.change(heightField, { target: { value: "5" } });
    fireEvent.blur(heightField);

    expect(committedNode()?.aspectRatio).toEqual({ mode: "ratio", width: 3, height: 5 });
  });

  it("accepts a decimal custom ratio", () => {
    const aspectRatio = { mode: "ratio" as const, width: 3, height: 2 };
    setupNode({ id: "container-1", tag: "div", aspectRatio });
    render(<InspectorAspectRatioFields node={{ id: "container-1", tag: "div", aspectRatio }} />);

    const widthField = screen.getByLabelText("Aspect ratio width");
    fireEvent.change(widthField, { target: { value: "2.39" } });
    fireEvent.blur(widthField);

    expect(committedNode()?.aspectRatio).toEqual({ mode: "ratio", width: 2.39, height: 2 });
  });

  it("discards an invalid intermediate draft rather than corrupting the document", () => {
    const aspectRatio = { mode: "ratio" as const, width: 3, height: 2 };
    setupNode({ id: "container-1", tag: "div", aspectRatio });
    render(<InspectorAspectRatioFields node={{ id: "container-1", tag: "div", aspectRatio }} />);

    const widthField = screen.getByLabelText("Aspect ratio width");
    fireEvent.change(widthField, { target: { value: "not a number" } });
    fireEvent.blur(widthField);

    expect(committedNode()?.aspectRatio).toEqual(aspectRatio);
  });

  it("clamps a zero-or-negative custom entry up to a valid positive minimum rather than committing an invalid ratio", () => {
    const aspectRatio = { mode: "ratio" as const, width: 3, height: 2 };
    setupNode({ id: "container-1", tag: "div", aspectRatio });
    render(<InspectorAspectRatioFields node={{ id: "container-1", tag: "div", aspectRatio }} />);

    const widthField = screen.getByLabelText("Aspect ratio width");
    fireEvent.change(widthField, { target: { value: "-5" } });
    fireEvent.blur(widthField);

    expect(committedNode()?.aspectRatio?.mode).toBe("ratio");
    expect((committedNode()?.aspectRatio as { width: number }).width).toBeGreaterThan(0);
  });

  it("resets the aspect ratio field entirely", () => {
    setupNode({ id: "container-1", tag: "div", aspectRatio: { mode: "ratio", width: 16, height: 9 } });
    render(<InspectorAspectRatioFields node={{ id: "container-1", tag: "div", aspectRatio: { mode: "ratio", width: 16, height: 9 } }} />);

    fireEvent.click(screen.getByRole("button", { name: "Reset aspect ratio" }));

    expect(committedNode()?.aspectRatio).toBeUndefined();
  });

  it("is undoable and redoable through the normal history stack", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorAspectRatioFields node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(optionButton("Square"));
    expect(committedNode()?.aspectRatio).toEqual({ mode: "ratio", width: 1, height: 1 });

    useEditorStore.getState().undo();
    expect(committedNode()?.aspectRatio).toBeUndefined();

    useEditorStore.getState().redo();
    expect(committedNode()?.aspectRatio).toEqual({ mode: "ratio", width: 1, height: 1 });
  });

  it("round-trips through a serialized document unchanged", () => {
    const aspectRatio = { mode: "ratio" as const, width: 2.39, height: 1 };
    setupNode({ id: "container-1", tag: "div", aspectRatio });

    const serialized = JSON.stringify(useEditorStore.getState().document);
    const restored = JSON.parse(serialized);
    const restoredNode = restored.children.find((c: { id: string }) => c.id === "container-1");

    expect(restoredNode.aspectRatio).toEqual(aspectRatio);
  });

  it("recognizes an exact preset ratio without rewriting the stored value", () => {
    const aspectRatio = { mode: "ratio" as const, width: 16, height: 9 };
    setupNode({ id: "container-1", tag: "div", aspectRatio });
    render(<InspectorAspectRatioFields node={{ id: "container-1", tag: "div", aspectRatio }} />);

    expect(optionButton("Widescreen")).toHaveAttribute("aria-pressed", "true");
    expect(committedNode()?.aspectRatio).toEqual(aspectRatio);
  });

  it("recognizes a mathematically-equivalent preset ratio (8:6 as Landscape) without rewriting the stored value", () => {
    const aspectRatio = { mode: "ratio" as const, width: 8, height: 6 };
    setupNode({ id: "container-1", tag: "div", aspectRatio });
    render(<InspectorAspectRatioFields node={{ id: "container-1", tag: "div", aspectRatio }} />);

    expect(optionButton("Landscape")).toHaveAttribute("aria-pressed", "true");
    expect(committedNode()?.aspectRatio).toEqual(aspectRatio);
  });

  it("shows an arbitrary ratio (3:2) as Custom, with the real stored values in the fields", () => {
    const aspectRatio = { mode: "ratio" as const, width: 3, height: 2 };
    setupNode({ id: "container-1", tag: "div", aspectRatio });
    render(<InspectorAspectRatioFields node={{ id: "container-1", tag: "div", aspectRatio }} />);

    expect(optionButton("Custom")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Aspect ratio width")).toHaveValue(3);
    expect(screen.getByLabelText("Aspect ratio height")).toHaveValue(2);
  });

  it("every preset option carries help metadata accessible via title, not hover-only", () => {
    render(<InspectorAspectRatioFields node={{ id: "container-1", tag: "div" }} />);

    expect(optionButton("Square")).toHaveAttribute("title", expect.stringContaining("1:1"));
    expect(optionButton("Widescreen")).toHaveAttribute("title", expect.stringContaining("16:9"));
  });

  it("supports arrow-key navigation between preset options", () => {
    render(<InspectorAspectRatioFields node={{ id: "container-1", tag: "div" }} />);

    const auto = optionButton("Auto");
    auto.focus();
    fireEvent.keyDown(auto, { key: "ArrowRight" });

    expect(optionButton("Square")).toHaveFocus();
  });

  it("the row-level help icon is available without mouse-only interaction", () => {
    render(<InspectorAspectRatioFields node={{ id: "container-1", tag: "div" }} />);

    expect(
      screen.getByRole("button", { name: /Aspect ratio affects sizing when at least one dimension can adjust/ }),
    ).toBeInTheDocument();
  });

  it("re-derives Custom mode from the newly-selected node rather than carrying over the previous node's view state", () => {
    const custom = { id: "container-1", tag: "div", aspectRatio: { mode: "ratio" as const, width: 3, height: 2 } };
    const { rerender } = render(<InspectorAspectRatioFields node={custom} />);
    expect(optionButton("Custom")).toHaveAttribute("aria-pressed", "true");

    const square = { id: "container-2", tag: "div", aspectRatio: { mode: "ratio" as const, width: 1, height: 1 } };
    rerender(<InspectorAspectRatioFields node={square} />);

    expect(optionButton("Square")).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByLabelText("Aspect ratio width")).not.toBeInTheDocument();
  });

  it("re-syncs away from Custom when the same node's value changes externally (e.g. Undo) back to a named preset", () => {
    // Simulates an external mutation (Undo/Redo bypasses this component's
    // own commit path entirely) by rerendering the *same* node id with a
    // genuinely different aspectRatio object — this must snap the view
    // back to Widescreen, not keep showing stale Custom fields.
    const custom = { id: "container-1", tag: "div", aspectRatio: { mode: "ratio" as const, width: 3, height: 9 } };
    const { rerender } = render(<InspectorAspectRatioFields node={custom} />);
    expect(optionButton("Custom")).toHaveAttribute("aria-pressed", "true");

    const undoneToWidescreen = { id: "container-1", tag: "div", aspectRatio: { mode: "ratio" as const, width: 16, height: 9 } };
    rerender(<InspectorAspectRatioFields node={undoneToWidescreen} />);

    expect(optionButton("Widescreen")).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByLabelText("Aspect ratio width")).not.toBeInTheDocument();
  });

  it("entering Custom from Auto stays on Custom even though the seeded 1:1 default is mathematically the Square preset", () => {
    setupNode({ id: "container-1", tag: "div" });
    const { rerender } = render(<InspectorAspectRatioFields node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(optionButton("Custom"));
    rerender(<InspectorAspectRatioFields node={committedNode()!} />);

    expect(optionButton("Custom")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Aspect ratio width")).toHaveValue(1);
    expect(screen.getByLabelText("Aspect ratio height")).toHaveValue(1);
  });
});
