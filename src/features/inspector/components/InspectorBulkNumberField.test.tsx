import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InspectorBulkNumberField } from "./InspectorBulkNumberField";
import type { SharedValue } from "@/features/inspector/types/sharedValue";

describe("InspectorBulkNumberField (Checkpoint 1.15.2)", () => {
  it("shows the shared value when every selected node agrees", () => {
    render(<InspectorBulkNumberField ariaLabel="Font size" shared={{ kind: "same", value: 16 }} onCommit={() => {}} />);
    expect(screen.getByLabelText("Font size")).toHaveValue(16);
  });

  it("shows an empty draft with a Mixed placeholder when the selection disagrees", () => {
    render(<InspectorBulkNumberField ariaLabel="Font size" shared={{ kind: "mixed" }} onCommit={() => {}} />);
    const input = screen.getByLabelText("Font size");
    expect(input).toHaveValue(null);
    expect(input).toHaveAttribute("placeholder", "Mixed");
  });

  it("committing a new value on blur calls onCommit with the parsed number", () => {
    const onCommit = vi.fn();
    render(<InspectorBulkNumberField ariaLabel="Font size" shared={{ kind: "mixed" }} onCommit={onCommit} />);
    const input = screen.getByLabelText("Font size");
    fireEvent.change(input, { target: { value: "18" } });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith(18);
  });

  it("Enter commits once, and the resulting blur does not double-commit", () => {
    const onCommit = vi.fn();
    render(<InspectorBulkNumberField ariaLabel="Font size" shared={{ kind: "mixed" }} onCommit={onCommit} />);
    const input = screen.getByLabelText("Font size");
    fireEvent.change(input, { target: { value: "18" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("blurring an untouched field never commits", () => {
    const onCommit = vi.fn();
    render(<InspectorBulkNumberField ariaLabel="Font size" shared={{ kind: "same", value: 16 }} onCommit={onCommit} />);
    const input = screen.getByLabelText("Font size");
    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("Escape reverts the draft without committing", () => {
    const onCommit = vi.fn();
    render(<InspectorBulkNumberField ariaLabel="Font size" shared={{ kind: "same", value: 16 }} onCommit={onCommit} />);
    const input = screen.getByLabelText("Font size");
    fireEvent.change(input, { target: { value: "99" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue(16);
  });

  it("clamps a committed value to min/max", () => {
    const onCommit = vi.fn();
    render(<InspectorBulkNumberField ariaLabel="Opacity" shared={{ kind: "same", value: 50 }} onCommit={onCommit} min={0} max={100} />);
    const input = screen.getByLabelText("Opacity");
    fireEvent.change(input, { target: { value: "500" } });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith(100);
  });

  it("re-syncs the draft when the shared value prop changes externally (e.g. selection changed)", () => {
    const { rerender } = render(<InspectorBulkNumberField ariaLabel="Font size" shared={{ kind: "same", value: 16 } as SharedValue<number>} onCommit={() => {}} />);
    rerender(<InspectorBulkNumberField ariaLabel="Font size" shared={{ kind: "mixed" }} onCommit={() => {}} />);
    expect(screen.getByLabelText("Font size")).toHaveValue(null);
  });
});
