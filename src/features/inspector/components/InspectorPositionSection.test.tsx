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
