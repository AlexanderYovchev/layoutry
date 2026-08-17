import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InspectorObjectPositionGrid } from "./InspectorObjectPositionGrid";

describe("InspectorObjectPositionGrid", () => {
  it("gives every cell a plain-language accessible name", () => {
    render(<InspectorObjectPositionGrid activeKey={undefined} onSelect={vi.fn()} />);

    for (const name of [
      "Position top left",
      "Position top center",
      "Position top right",
      "Position center left",
      "Position center",
      "Position center right",
      "Position bottom left",
      "Position bottom center",
      "Position bottom right",
    ]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("marks no cell as pressed when activeKey is undefined (a custom position)", () => {
    render(<InspectorObjectPositionGrid activeKey={undefined} onSelect={vi.fn()} />);
    for (const button of screen.getAllByRole("button")) {
      expect(button).toHaveAttribute("aria-pressed", "false");
    }
  });

  it("marks exactly the matching cell as pressed", () => {
    render(<InspectorObjectPositionGrid activeKey="bottom-right" onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Position bottom right" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Position center" })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onSelect with the clicked preset's key and x/y", () => {
    const onSelect = vi.fn();
    render(<InspectorObjectPositionGrid activeKey={undefined} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "Position top right" }));
    expect(onSelect).toHaveBeenCalledWith({ key: "top-right", x: 100, y: 0 });
  });

  it("moves focus across the grid with arrow keys", () => {
    render(<InspectorObjectPositionGrid activeKey={undefined} onSelect={vi.fn()} />);

    screen.getByRole("button", { name: "Position center" }).focus();
    fireEvent.keyDown(screen.getByRole("button", { name: "Position center" }), { key: "ArrowRight" });
    expect(screen.getByRole("button", { name: "Position center right" })).toHaveFocus();

    fireEvent.keyDown(screen.getByRole("button", { name: "Position center right" }), { key: "ArrowUp" });
    expect(screen.getByRole("button", { name: "Position top right" })).toHaveFocus();
  });

  it("disables every cell when disabled", () => {
    render(<InspectorObjectPositionGrid activeKey={undefined} onSelect={vi.fn()} disabled />);
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });

  it("renders the provided reset affordance", () => {
    render(
      <InspectorObjectPositionGrid
        activeKey="center"
        onSelect={vi.fn()}
        reset={<button aria-label="Reset object position">Reset</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Reset object position" })).toBeInTheDocument();
  });
});
