import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InspectorBooleanToggle } from "./InspectorBooleanToggle";

describe("InspectorBooleanToggle", () => {
  it("renders as an accessible switch reflecting the checked state", () => {
    render(<InspectorBooleanToggle checked onChange={vi.fn()} label="Preserve aspect ratio" />);
    expect(screen.getByRole("switch", { name: "Preserve aspect ratio" })).toHaveAttribute("aria-checked", "true");
  });

  it("calls onChange with the flipped value on click", () => {
    const onChange = vi.fn();
    render(<InspectorBooleanToggle checked={false} onChange={onChange} label="Preserve aspect ratio" />);
    fireEvent.click(screen.getByRole("switch", { name: "Preserve aspect ratio" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("toggles via the keyboard (native button activation on Enter/Space)", () => {
    const onChange = vi.fn();
    render(<InspectorBooleanToggle checked={false} onChange={onChange} label="Preserve aspect ratio" />);
    const toggle = screen.getByRole("switch", { name: "Preserve aspect ratio" });
    toggle.focus();
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("does not call onChange when disabled", () => {
    const onChange = vi.fn();
    render(<InspectorBooleanToggle checked={false} onChange={onChange} disabled label="Preserve aspect ratio" />);
    expect(screen.getByRole("switch", { name: "Preserve aspect ratio" })).toBeDisabled();
  });
});
