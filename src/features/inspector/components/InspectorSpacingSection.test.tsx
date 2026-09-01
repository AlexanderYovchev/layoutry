import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { selectionFromSingle } from "@/features/editor/types/selection";
import { InspectorSpacingSection } from "./InspectorSpacingSection";

const initialState = useEditorStore.getState();

describe("InspectorSpacingSection", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("shows zero for margin and padding when the node has no spacing set", () => {
    render(<InspectorSpacingSection node={{ id: "n1", tag: "div" }} />);
    expect(screen.getByLabelText("Margin (all sides)")).toHaveValue(0);
    expect(screen.getByLabelText("Padding (all sides)")).toHaveValue(0);
  });

  it("starts linked when all four sides already share the same value", () => {
    render(
      <InspectorSpacingSection
        node={{
          id: "n1",
          tag: "div",
          spacing: {
            margin: { top: 8, right: 8, bottom: 8, left: 8 },
            padding: { top: 0, right: 0, bottom: 0, left: 0 },
          },
        }}
      />,
    );
    expect(screen.getByLabelText("Margin (all sides)")).toHaveValue(8);
  });

  it("starts unlinked when sides differ, showing four independent fields", () => {
    render(
      <InspectorSpacingSection
        node={{
          id: "n1",
          tag: "div",
          spacing: {
            margin: { top: 4, right: 8, bottom: 4, left: 8 },
            padding: { top: 0, right: 0, bottom: 0, left: 0 },
          },
        }}
      />,
    );
    // Margin group is unlinked (mixed values) — Top/Right/Bottom/Left all present.
    expect(screen.getAllByLabelText("Top")[0]).toHaveValue(4);
    expect(screen.getAllByLabelText("Right")[0]).toHaveValue(8);
  });

  it("commits margin via setElementMargin when the linked field is edited", () => {
    useEditorStore.setState((state) => ({
      document: { ...state.document, children: [{ id: "n1", tag: "div", children: [] }] },
    }));

    render(<InspectorSpacingSection node={{ id: "n1", tag: "div" }} />);
    const input = screen.getByLabelText("Margin (all sides)");
    fireEvent.change(input, { target: { value: "12" } });
    fireEvent.blur(input);

    const node = useEditorStore.getState().document.children?.find((c) => c.id === "n1");
    expect(node?.spacing?.margin).toEqual({ top: 12, right: 12, bottom: 12, left: 12 });
  });

  it("commits padding via setElementPadding when the linked field is edited", () => {
    useEditorStore.setState((state) => ({
      document: { ...state.document, children: [{ id: "n1", tag: "div", children: [] }] },
    }));

    render(<InspectorSpacingSection node={{ id: "n1", tag: "div" }} />);
    const input = screen.getByLabelText("Padding (all sides)");
    fireEvent.change(input, { target: { value: "24" } });
    fireEvent.blur(input);

    const node = useEditorStore.getState().document.children?.find((c) => c.id === "n1");
    expect(node?.spacing?.padding).toEqual({ top: 24, right: 24, bottom: 24, left: 24 });
  });

  it("switching to Unlinked and editing one side leaves the others untouched", () => {
    useEditorStore.setState((state) => ({
      document: {
        ...state.document,
        children: [
          {
            id: "n1",
            tag: "div",
            children: [],
            spacing: {
              margin: { top: 0, right: 0, bottom: 0, left: 0 },
              padding: { top: 10, right: 10, bottom: 10, left: 10 },
            },
          },
        ],
      },
    }));

    render(
      <InspectorSpacingSection
        node={{
          id: "n1",
          tag: "div",
          spacing: {
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
            padding: { top: 10, right: 10, bottom: 10, left: 10 },
          },
        }}
      />,
    );

    // Padding starts linked (all sides 10) — unlink it, then edit only Top.
    const unlinkButtons = screen.getAllByRole("button", { name: "Linked" });
    fireEvent.click(unlinkButtons[1]); // [0] margin, [1] padding

    const topInput = screen.getAllByLabelText("Top")[0];
    fireEvent.change(topInput, { target: { value: "40" } });
    fireEvent.blur(topInput);

    const node = useEditorStore.getState().document.children?.find((c) => c.id === "n1");
    expect(node?.spacing?.padding).toEqual({ top: 40, right: 10, bottom: 10, left: 10 });
  });

  it("clamps a negative padding value to 0 on commit", () => {
    useEditorStore.setState((state) => ({
      document: { ...state.document, children: [{ id: "n1", tag: "div", children: [] }] },
    }));

    render(<InspectorSpacingSection node={{ id: "n1", tag: "div" }} />);
    const input = screen.getByLabelText("Padding (all sides)");
    fireEvent.change(input, { target: { value: "-50" } });
    fireEvent.blur(input);

    const node = useEditorStore.getState().document.children?.find((c) => c.id === "n1");
    expect(node?.spacing?.padding).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it("re-derives the linked/unlinked toggle when the selected node changes to a different sibling (regression: selection-change staleness, Checkpoint 3.5.1)", () => {
    const { rerender } = render(<InspectorSpacingSection node={{ id: "a", tag: "div" }} />);

    expect(screen.getByLabelText("Padding (all sides)")).toBeInTheDocument();

    rerender(
      <InspectorSpacingSection
        node={{
          id: "b",
          tag: "div",
          spacing: {
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
            padding: { top: 4, right: 8, bottom: 4, left: 8 },
          },
        }}
      />,
    );

    // Node b's padding sides differ (unlinked) — the linked "all sides"
    // field must not still be shown from node a's linked shape.
    expect(screen.queryByLabelText("Padding (all sides)")).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("Top")[0]).toHaveValue(4);
    expect(screen.getAllByLabelText("Right")[0]).toHaveValue(8);
  });

  it("disables the reset button for a group that is already at the zero default", () => {
    render(<InspectorSpacingSection node={{ id: "n1", tag: "div" }} />);
    expect(screen.getByRole("button", { name: "Reset margin" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reset padding" })).toBeDisabled();
  });

  it("reset removes the explicit margin by committing the model's own zero default, through the same setElementMargin command (undoable)", () => {
    useEditorStore.setState((state) => ({
      document: {
        ...state.document,
        children: [
          {
            id: "n1",
            tag: "div",
            children: [],
            spacing: {
              margin: { top: 8, right: 8, bottom: 8, left: 8 },
              padding: { top: 0, right: 0, bottom: 0, left: 0 },
            },
          },
        ],
      },
    }));

    render(
      <InspectorSpacingSection
        node={{
          id: "n1",
          tag: "div",
          spacing: {
            margin: { top: 8, right: 8, bottom: 8, left: 8 },
            padding: { top: 0, right: 0, bottom: 0, left: 0 },
          },
        }}
      />,
    );
    const resetMargin = screen.getByRole("button", { name: "Reset margin" });
    expect(resetMargin).toBeEnabled();
    fireEvent.click(resetMargin);

    const node = useEditorStore.getState().document.children?.find((c) => c.id === "n1");
    expect(node?.spacing?.margin).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });

    // Undoable through the normal history stack — reset is a plain
    // setElementMargin commit, not a special bypass.
    useEditorStore.getState().undo();
    const afterUndo = useEditorStore.getState().document.children?.find((c) => c.id === "n1");
    expect(afterUndo?.spacing?.margin).toEqual({ top: 8, right: 8, bottom: 8, left: 8 });

    useEditorStore.getState().redo();
    const afterRedo = useEditorStore.getState().document.children?.find((c) => c.id === "n1");
    expect(afterRedo?.spacing?.margin).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it("keeps the same node selected across an undo/redo round trip of a spacing commit", () => {
    useEditorStore.setState((state) => ({
      document: { ...state.document, children: [{ id: "n1", tag: "div", children: [] }] },
      selection: selectionFromSingle("n1"),
    }));

    render(<InspectorSpacingSection node={{ id: "n1", tag: "div" }} />);
    const input = screen.getByLabelText("Margin (all sides)");
    fireEvent.change(input, { target: { value: "16" } });
    fireEvent.blur(input);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().selection.primaryId).toBe("n1");

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().selection.primaryId).toBe("n1");
  });
});
