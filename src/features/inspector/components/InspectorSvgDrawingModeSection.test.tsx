import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { InspectorSvgDrawingModeSection } from "./InspectorSvgDrawingModeSection";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";

const initialState = useEditorStore.getState();

describe("InspectorSvgDrawingModeSection", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("shows Select as the active tool by default", () => {
    render(<InspectorSvgDrawingModeSection />);
    expect(screen.getByRole("button", { name: "Select" })).toHaveAttribute("aria-pressed", "true");
  });

  it("clicking a tool option sets it as the active SVG drawing tool", () => {
    render(<InspectorSvgDrawingModeSection />);

    fireEvent.click(screen.getByRole("button", { name: "Rectangle" }));

    expect(useEditorStore.getState().activeSvgTool).toBe("rect");
    expect(screen.getByRole("button", { name: "Rectangle" })).toHaveAttribute("aria-pressed", "true");
  });

  it("every drawing tool option is selectable", () => {
    render(<InspectorSvgDrawingModeSection />);
    const cases: Array<[string, string]> = [
      ["Ellipse", "ellipse"],
      ["Line", "line"],
      ["Polygon", "polygon"],
      ["Pen", "pen"],
      ["Select", "select"],
    ];
    for (const [label, tool] of cases) {
      fireEvent.click(screen.getByRole("button", { name: label }));
      expect(useEditorStore.getState().activeSvgTool).toBe(tool);
    }
  });

  it("clicking Done exits SVG Drawing Mode", () => {
    useEditorStore.setState({ svgEditingNodeId: "svg1", selectedSvgObjectIds: ["r1"] });
    render(<InspectorSvgDrawingModeSection />);

    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(useEditorStore.getState().svgEditingNodeId).toBeNull();
    expect(useEditorStore.getState().selectedSvgObjectIds).toEqual([]);
  });
});
