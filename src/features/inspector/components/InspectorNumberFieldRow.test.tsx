import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InspectorNumberFieldRow } from "./InspectorNumberFieldRow";

describe("InspectorNumberFieldRow", () => {
  it("renders the rounded value as the input's initial content", () => {
    render(<InspectorNumberFieldRow label="X" value={16.4} onCommit={vi.fn()} />);
    expect(screen.getByLabelText("X")).toHaveValue(16);
  });

  it("commits the parsed value on blur", () => {
    const onCommit = vi.fn();
    render(<InspectorNumberFieldRow label="X" value={16} onCommit={onCommit} />);

    const input = screen.getByLabelText("X");
    fireEvent.change(input, { target: { value: "42" } });
    fireEvent.blur(input);

    expect(onCommit).toHaveBeenCalledWith(42);
  });

  it("commits on Enter and blurs the field", () => {
    const onCommit = vi.fn();
    render(<InspectorNumberFieldRow label="Width" value={100} onCommit={onCommit} />);

    const input = screen.getByLabelText("Width");
    fireEvent.change(input, { target: { value: "200" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onCommit).toHaveBeenCalledWith(200);
  });

  it("reverts to the last committed value on Escape without calling onCommit", () => {
    const onCommit = vi.fn();
    render(<InspectorNumberFieldRow label="Y" value={10} onCommit={onCommit} />);

    const input = screen.getByLabelText("Y");
    fireEvent.change(input, { target: { value: "999" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue(10);
  });

  it("discards an invalid (non-numeric) draft on blur instead of committing NaN", () => {
    const onCommit = vi.fn();
    render(<InspectorNumberFieldRow label="Height" value={80} onCommit={onCommit} />);

    const input = screen.getByLabelText("Height");
    fireEvent.change(input, { target: { value: "not-a-number" } });
    fireEvent.blur(input);

    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue(80);
  });

  it("syncs the displayed value when the external value changes (e.g. a live drag)", () => {
    const { rerender } = render(<InspectorNumberFieldRow label="X" value={10} onCommit={vi.fn()} />);
    rerender(<InspectorNumberFieldRow label="X" value={55} onCommit={vi.fn()} />);

    expect(screen.getByLabelText("X")).toHaveValue(55);
  });
});
