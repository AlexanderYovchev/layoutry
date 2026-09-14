import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { InspectorBulkShapeSection } from "./InspectorBulkShapeSection";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";

const initialState = useEditorStore.getState();

describe("InspectorBulkShapeSection", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("shows the shared preset as pressed when every node agrees", () => {
    render(
      <InspectorBulkShapeSection
        nodes={[
          { id: "a", tag: "div", shape: "circle" },
          { id: "b", tag: "div", shape: "circle" },
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: "Circle" })).toHaveAttribute("aria-pressed", "true");
  });

  it("marks no preset as pressed when the selection has mixed shapes", () => {
    render(
      <InspectorBulkShapeSection
        nodes={[
          { id: "a", tag: "div", shape: "circle" },
          { id: "b", tag: "div", shape: "hexagon" },
        ]}
      />,
    );
    const grid = screen.getByRole("group", { name: "Shape" });
    for (const button of within(grid).getAllByRole("button")) {
      expect(button).toHaveAttribute("aria-pressed", "false");
    }
  });

  it("selecting a preset applies it to every selected node in one history entry", () => {
    useEditorStore.setState((state) => ({
      document: {
        ...state.document,
        children: [
          { id: "a", tag: "div", shape: "circle" as const },
          { id: "b", tag: "div", shape: "hexagon" as const },
        ],
      },
    }));
    const pastBefore = useEditorStore.getState().past.length;
    render(
      <InspectorBulkShapeSection
        nodes={[
          { id: "a", tag: "div", shape: "circle" },
          { id: "b", tag: "div", shape: "hexagon" },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Triangle" }));

    const children = useEditorStore.getState().document.children!;
    expect(children[0].shape).toBe("triangle");
    expect(children[1].shape).toBe("triangle");
    expect(useEditorStore.getState().past.length).toBe(pastBefore + 1);
  });
});
