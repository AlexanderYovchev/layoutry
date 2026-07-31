import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InspectorBorderRadiusCornerSelector } from "./InspectorBorderRadiusCornerSelector";

describe("InspectorBorderRadiusCornerSelector", () => {
  it("renders one button per corner with a plain-language accessible name", () => {
    render(<InspectorBorderRadiusCornerSelector value="topLeft" onSelect={vi.fn()} configuredCorners={new Set()} />);
    expect(screen.getByLabelText("Top left corner")).toBeInTheDocument();
    expect(screen.getByLabelText("Top right corner")).toBeInTheDocument();
    expect(screen.getByLabelText("Bottom right corner")).toBeInTheDocument();
    expect(screen.getByLabelText("Bottom left corner")).toBeInTheDocument();
  });

  it("marks only the currently selected corner as pressed", () => {
    render(<InspectorBorderRadiusCornerSelector value="bottomRight" onSelect={vi.fn()} configuredCorners={new Set()} />);
    expect(screen.getByLabelText("Bottom right corner")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Top left corner")).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onSelect with the clicked corner", () => {
    const onSelect = vi.fn();
    render(<InspectorBorderRadiusCornerSelector value="topLeft" onSelect={onSelect} configuredCorners={new Set()} />);
    fireEvent.click(screen.getByLabelText("Bottom left corner"));
    expect(onSelect).toHaveBeenCalledWith("bottomLeft");
  });

  it("moves focus across the 2x2 grid with arrow keys, following actual geometry", () => {
    render(<InspectorBorderRadiusCornerSelector value="topLeft" onSelect={vi.fn()} configuredCorners={new Set()} />);
    screen.getByLabelText("Top left corner").focus();

    fireEvent.keyDown(screen.getByLabelText("Top left corner"), { key: "ArrowRight" });
    expect(screen.getByLabelText("Top right corner")).toHaveFocus();

    fireEvent.keyDown(screen.getByLabelText("Top right corner"), { key: "ArrowDown" });
    expect(screen.getByLabelText("Bottom right corner")).toHaveFocus();

    fireEvent.keyDown(screen.getByLabelText("Bottom right corner"), { key: "ArrowLeft" });
    expect(screen.getByLabelText("Bottom left corner")).toHaveFocus();

    fireEvent.keyDown(screen.getByLabelText("Bottom left corner"), { key: "ArrowUp" });
    expect(screen.getByLabelText("Top left corner")).toHaveFocus();
  });

  it("staying in the same row/column on a redundant arrow press keeps focus put", () => {
    render(<InspectorBorderRadiusCornerSelector value="topLeft" onSelect={vi.fn()} configuredCorners={new Set()} />);
    screen.getByLabelText("Top left corner").focus();
    fireEvent.keyDown(screen.getByLabelText("Top left corner"), { key: "ArrowUp" });
    expect(screen.getByLabelText("Top left corner")).toHaveFocus();
    fireEvent.keyDown(screen.getByLabelText("Top left corner"), { key: "ArrowLeft" });
    expect(screen.getByLabelText("Top left corner")).toHaveFocus();
  });

  it("disables every button when disabled", () => {
    render(<InspectorBorderRadiusCornerSelector value="topLeft" onSelect={vi.fn()} configuredCorners={new Set()} disabled />);
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });
});
