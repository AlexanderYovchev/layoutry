import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { InspectorShapeSection } from "./InspectorShapeSection";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";

const initialState = useEditorStore.getState();

describe("InspectorShapeSection", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("shows Rectangle as pressed for an unset shape", () => {
    render(<InspectorShapeSection node={{ id: "a", tag: "div" }} />);
    expect(screen.getByRole("button", { name: "Rectangle" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the stored preset as pressed", () => {
    render(<InspectorShapeSection node={{ id: "a", tag: "div", shape: "hexagon" }} />);
    expect(screen.getByRole("button", { name: "Hexagon" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Rectangle" })).toHaveAttribute("aria-pressed", "false");
  });

  it("clicking a preset commits it to the document, one history entry", () => {
    useEditorStore.setState((state) => ({ document: { ...state.document, children: [{ id: "a", tag: "div" }] } }));
    const pastBefore = useEditorStore.getState().past.length;
    render(<InspectorShapeSection node={{ id: "a", tag: "div" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Circle" }));

    expect(useEditorStore.getState().document.children![0].shape).toBe("circle");
    expect(useEditorStore.getState().past.length).toBe(pastBefore + 1);
  });

  it("shows the helper copy about clip-path and child clipping", () => {
    render(<InspectorShapeSection node={{ id: "a", tag: "div" }} />);
    expect(
      screen.getByText("Shapes use CSS clip-path and may clip child content outside the visible area."),
    ).toBeInTheDocument();
  });

  it("the reset button is disabled for Rectangle and enabled otherwise, and resets to Rectangle", () => {
    useEditorStore.setState((state) => ({
      document: { ...state.document, children: [{ id: "a", tag: "div", shape: "star" as const }] },
    }));
    render(<InspectorShapeSection node={{ id: "a", tag: "div", shape: "star" }} />);

    const reset = screen.getByRole("button", { name: "Reset shape" });
    expect(reset).not.toBeDisabled();
    fireEvent.click(reset);
    expect(useEditorStore.getState().document.children![0].shape).toBeUndefined();
  });
});
