import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InspectorBackgroundPositionGrid } from "./InspectorBackgroundPositionGrid";

describe("InspectorBackgroundPositionGrid", () => {
  it("gives every cell a plain-language accessible name", () => {
    render(<InspectorBackgroundPositionGrid value={undefined} onSelect={vi.fn()} />);

    for (const name of [
      "Top left",
      "Top center",
      "Top right",
      "Center left",
      "Center",
      "Center right",
      "Bottom left",
      "Bottom center",
      "Bottom right",
    ]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("marks no cell as pressed when the position is unset", () => {
    render(<InspectorBackgroundPositionGrid value={undefined} onSelect={vi.fn()} />);
    for (const button of screen.getAllByRole("button")) {
      expect(button).toHaveAttribute("aria-pressed", "false");
    }
  });

  it("marks exactly the matching cell as pressed", () => {
    render(<InspectorBackgroundPositionGrid value="bottom-right" onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Bottom right" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Center" })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onSelect with the clicked position", () => {
    const onSelect = vi.fn();
    render(<InspectorBackgroundPositionGrid value={undefined} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "Top right" }));
    expect(onSelect).toHaveBeenCalledWith("top-right");
  });

  it("moves focus across the grid with arrow keys", () => {
    render(<InspectorBackgroundPositionGrid value={undefined} onSelect={vi.fn()} />);

    screen.getByRole("button", { name: "Center" }).focus();
    fireEvent.keyDown(screen.getByRole("button", { name: "Center" }), { key: "ArrowRight" });
    expect(screen.getByRole("button", { name: "Center right" })).toHaveFocus();

    fireEvent.keyDown(screen.getByRole("button", { name: "Center right" }), { key: "ArrowUp" });
    expect(screen.getByRole("button", { name: "Top right" })).toHaveFocus();
  });

  it("disables every cell when disabled", () => {
    render(<InspectorBackgroundPositionGrid value={undefined} onSelect={vi.fn()} disabled />);
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });

  it("renders the provided reset affordance", () => {
    render(
      <InspectorBackgroundPositionGrid
        value="center"
        onSelect={vi.fn()}
        reset={<button aria-label="Reset position">Reset</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Reset position" })).toBeInTheDocument();
  });
});
