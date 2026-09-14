import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InspectorShapeGrid } from "./InspectorShapeGrid";
import { SHAPE_PRESETS } from "@/features/editor/types/shape";

describe("InspectorShapeGrid", () => {
  it("gives every preset a plain-language accessible name, Rectangle included", () => {
    render(<InspectorShapeGrid activePreset={undefined} onSelect={vi.fn()} />);
    for (const preset of SHAPE_PRESETS) {
      expect(screen.getByRole("button", { name: preset.label })).toBeInTheDocument();
    }
  });

  it("marks no cell as pressed when activePreset is undefined (mixed selection)", () => {
    render(<InspectorShapeGrid activePreset={undefined} onSelect={vi.fn()} />);
    for (const button of screen.getAllByRole("button")) {
      expect(button).toHaveAttribute("aria-pressed", "false");
    }
  });

  it("marks exactly the matching preset as pressed", () => {
    render(<InspectorShapeGrid activePreset="hexagon" onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Hexagon" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Circle" })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onSelect with the clicked preset's id", () => {
    const onSelect = vi.fn();
    render(<InspectorShapeGrid activePreset={undefined} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Star" }));
    expect(onSelect).toHaveBeenCalledWith("star");
  });

  it("moves focus across the grid with arrow keys, clamping at the ragged last row", () => {
    render(<InspectorShapeGrid activePreset={undefined} onSelect={vi.fn()} />);

    screen.getByRole("button", { name: "Rectangle" }).focus();
    fireEvent.keyDown(screen.getByRole("button", { name: "Rectangle" }), { key: "ArrowRight" });
    expect(screen.getByRole("button", { name: "Circle" })).toHaveFocus();

    // Last preset (Trapezoid, index 10) has no cell below it (11 items / 4 cols) — ArrowDown clamps in place.
    screen.getByRole("button", { name: "Trapezoid" }).focus();
    fireEvent.keyDown(screen.getByRole("button", { name: "Trapezoid" }), { key: "ArrowDown" });
    expect(screen.getByRole("button", { name: "Trapezoid" })).toHaveFocus();
  });

  it("disables every cell when disabled", () => {
    render(<InspectorShapeGrid activePreset={undefined} onSelect={vi.fn()} disabled />);
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });

  it("renders the provided reset affordance", () => {
    render(
      <InspectorShapeGrid
        activePreset="circle"
        onSelect={vi.fn()}
        reset={<button aria-label="Reset shape">Reset</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Reset shape" })).toBeInTheDocument();
  });

  it("each cell's swatch clip-path matches the central preset mapping exactly (preview == Canvas behavior)", () => {
    const { container } = render(<InspectorShapeGrid activePreset={undefined} onSelect={vi.fn()} />);
    for (const preset of SHAPE_PRESETS) {
      const button = screen.getByRole("button", { name: preset.label });
      const swatch = button.querySelector("span[aria-hidden]") as HTMLElement;
      expect(swatch.style.clipPath).toBe(preset.clipPath ?? "");
    }
    expect(container).toBeInTheDocument();
  });
});
