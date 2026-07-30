import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InspectorColorFieldShell } from "./InspectorColorFieldShell";

describe("InspectorColorFieldShell", () => {
  it("shows an unset placeholder when value is null", () => {
    render(<InspectorColorFieldShell value={null} label="Background color" />);
    expect(screen.getByLabelText("Background color")).toHaveValue("");
    expect(screen.getByLabelText("Background color")).toHaveAttribute("placeholder", "Unset");
  });

  it("displays the color value as text", () => {
    render(<InspectorColorFieldShell value="#3366ff" label="Background color" />);
    expect(screen.getByLabelText("Background color")).toHaveValue("#3366ff");
  });

  it("calls onOpenPicker when the swatch is clicked", () => {
    const onOpenPicker = vi.fn();
    render(<InspectorColorFieldShell value="#3366ff" onOpenPicker={onOpenPicker} label="Background color" />);
    fireEvent.click(screen.getByRole("button", { name: /Background color swatch/ }));
    expect(onOpenPicker).toHaveBeenCalledTimes(1);
  });

  it("disables the swatch button when there is no picker to open", () => {
    render(<InspectorColorFieldShell value="#3366ff" label="Background color" />);
    expect(screen.getByRole("button", { name: /Background color swatch/ })).toBeDisabled();
  });

  it("reset is disabled when unset and enabled (and wired) when a value is present", () => {
    const onReset = vi.fn();
    const { rerender } = render(<InspectorColorFieldShell value={null} onReset={onReset} label="Background color" />);
    expect(screen.getByRole("button", { name: "Reset background color" })).toBeDisabled();

    rerender(<InspectorColorFieldShell value="#3366ff" onReset={onReset} label="Background color" />);
    const resetButton = screen.getByRole("button", { name: "Reset background color" });
    expect(resetButton).toBeEnabled();
    fireEvent.click(resetButton);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("stays read-only when onCommit is omitted", () => {
    render(<InspectorColorFieldShell value="#3366ff" label="Background color" />);
    expect(screen.getByLabelText("Background color")).toHaveAttribute("readonly");
  });

  it("commits the typed text on blur when onCommit is provided", () => {
    const onCommit = vi.fn();
    render(<InspectorColorFieldShell value="#3366ff" onCommit={onCommit} label="Text color" />);

    const input = screen.getByLabelText("Text color");
    expect(input).not.toHaveAttribute("readonly");
    fireEvent.change(input, { target: { value: "#ff0000" } });
    fireEvent.blur(input);

    expect(onCommit).toHaveBeenCalledWith("#ff0000");
  });

  it("commits on Enter and blurs the field", () => {
    const onCommit = vi.fn();
    render(<InspectorColorFieldShell value={null} onCommit={onCommit} label="Text color" />);

    const input = screen.getByLabelText("Text color");
    fireEvent.change(input, { target: { value: "rgba(0, 0, 0, 0.5)" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onCommit).toHaveBeenCalledWith("rgba(0, 0, 0, 0.5)");
  });

  it("reverts to the last committed value on Escape without calling onCommit", () => {
    const onCommit = vi.fn();
    render(<InspectorColorFieldShell value="#3366ff" onCommit={onCommit} label="Text color" />);

    const input = screen.getByLabelText("Text color");
    fireEvent.change(input, { target: { value: "garbage" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue("#3366ff");
  });

  it("discards an empty draft on blur instead of committing it", () => {
    const onCommit = vi.fn();
    render(<InspectorColorFieldShell value="#3366ff" onCommit={onCommit} label="Text color" />);

    const input = screen.getByLabelText("Text color");
    fireEvent.change(input, { target: { value: "  " } });
    fireEvent.blur(input);

    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue("#3366ff");
  });

  it("shows an invalid visual state (aria-invalid, red border) when an error is passed", () => {
    render(<InspectorColorFieldShell value="not-a-color" onCommit={vi.fn()} error="Enter a valid color" label="Text color" />);
    const input = screen.getByLabelText("Text color");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveClass("border-red-400");
  });
});
