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
});
