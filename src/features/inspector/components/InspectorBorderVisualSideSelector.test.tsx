import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InspectorBorderVisualSideSelector } from "./InspectorBorderVisualSideSelector";

describe("InspectorBorderVisualSideSelector", () => {
  it("renders one button per side with a plain-language accessible name", () => {
    render(<InspectorBorderVisualSideSelector value="top" onSelect={vi.fn()} configuredSides={new Set()} />);
    expect(screen.getByLabelText("Top border")).toBeInTheDocument();
    expect(screen.getByLabelText("Right border")).toBeInTheDocument();
    expect(screen.getByLabelText("Bottom border")).toBeInTheDocument();
    expect(screen.getByLabelText("Left border")).toBeInTheDocument();
  });

  it("marks only the currently selected side as pressed", () => {
    render(<InspectorBorderVisualSideSelector value="right" onSelect={vi.fn()} configuredSides={new Set()} />);
    expect(screen.getByLabelText("Right border")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Top border")).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onSelect with the clicked side", () => {
    const onSelect = vi.fn();
    render(<InspectorBorderVisualSideSelector value="top" onSelect={onSelect} configuredSides={new Set()} />);
    fireEvent.click(screen.getByLabelText("Bottom border"));
    expect(onSelect).toHaveBeenCalledWith("bottom");
  });

  it("moves focus to the geometrically corresponding side on arrow keys", () => {
    render(<InspectorBorderVisualSideSelector value="top" onSelect={vi.fn()} configuredSides={new Set()} />);
    screen.getByLabelText("Top border").focus();
    fireEvent.keyDown(screen.getByLabelText("Top border"), { key: "ArrowRight" });
    expect(screen.getByLabelText("Right border")).toHaveFocus();

    fireEvent.keyDown(screen.getByLabelText("Right border"), { key: "ArrowDown" });
    expect(screen.getByLabelText("Bottom border")).toHaveFocus();

    fireEvent.keyDown(screen.getByLabelText("Bottom border"), { key: "ArrowLeft" });
    expect(screen.getByLabelText("Left border")).toHaveFocus();

    fireEvent.keyDown(screen.getByLabelText("Left border"), { key: "ArrowUp" });
    expect(screen.getByLabelText("Top border")).toHaveFocus();
  });

  it("disables every button when disabled", () => {
    render(<InspectorBorderVisualSideSelector value="top" onSelect={vi.fn()} configuredSides={new Set()} disabled />);
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });

  it("visually distinguishes a configured side without affecting its accessible name", () => {
    render(
      <InspectorBorderVisualSideSelector value="top" onSelect={vi.fn()} configuredSides={new Set(["left"])} />,
    );
    expect(screen.getByLabelText("Left border")).toBeInTheDocument();
  });
});
