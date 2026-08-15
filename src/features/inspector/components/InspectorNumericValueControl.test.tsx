import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InspectorNumericValueControl } from "./InspectorNumericValueControl";

describe("InspectorNumericValueControl", () => {
  it("commits the parsed value on blur", () => {
    const onCommit = vi.fn();
    render(<InspectorNumericValueControl ariaLabel="Width" value={10} onCommit={onCommit} />);

    const input = screen.getByLabelText("Width");
    fireEvent.change(input, { target: { value: "42" } });
    fireEvent.blur(input);

    expect(onCommit).toHaveBeenCalledWith(42);
  });

  it("commits on Enter and blurs the field", () => {
    const onCommit = vi.fn();
    render(<InspectorNumericValueControl ariaLabel="Width" value={10} onCommit={onCommit} />);

    const input = screen.getByLabelText("Width");
    fireEvent.change(input, { target: { value: "200" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onCommit).toHaveBeenCalledWith(200);
  });

  it("Enter commits exactly once, even though it also blurs a genuinely-focused input (Checkpoint 5.5 regression — the blur must not fire a second, duplicate commit)", () => {
    const onCommit = vi.fn();
    render(<InspectorNumericValueControl ariaLabel="Width" value={10} onCommit={onCommit} />);

    const input = screen.getByLabelText("Width");
    // A real focus (not just a synthetic keyDown at an unfocused element)
    // is what makes the Enter handler's own event.currentTarget.blur()
    // call dispatch a genuine blur event in jsdom too — reproducing the
    // exact real-browser condition this regression only shows up under.
    input.focus();
    fireEvent.change(input, { target: { value: "200" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(200);
  });

  it("reverts to the last committed value on Escape without calling onCommit", () => {
    const onCommit = vi.fn();
    render(<InspectorNumericValueControl ariaLabel="Width" value={10} onCommit={onCommit} />);

    const input = screen.getByLabelText("Width");
    fireEvent.change(input, { target: { value: "999" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue(10);
  });

  it("Escape never commits, even though it also blurs a genuinely-focused input (Checkpoint 5.5 regression)", () => {
    const onCommit = vi.fn();
    render(<InspectorNumericValueControl ariaLabel="Width" value={10} onCommit={onCommit} />);

    const input = screen.getByLabelText("Width");
    input.focus();
    fireEvent.change(input, { target: { value: "999" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("a plain blur (no preceding Enter/Escape) still commits normally", () => {
    const onCommit = vi.fn();
    render(<InspectorNumericValueControl ariaLabel="Width" value={10} onCommit={onCommit} />);

    const input = screen.getByLabelText("Width");
    input.focus();
    fireEvent.change(input, { target: { value: "77" } });
    fireEvent.blur(input);

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(77);
  });

  it("discards an invalid draft on blur instead of committing NaN", () => {
    const onCommit = vi.fn();
    render(<InspectorNumericValueControl ariaLabel="Height" value={80} onCommit={onCommit} />);

    const input = screen.getByLabelText("Height");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.blur(input);

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("clamps a committed value to min/max", () => {
    const onCommit = vi.fn();
    render(<InspectorNumericValueControl ariaLabel="Opacity" value={0.5} min={0} max={1} onCommit={onCommit} />);

    const input = screen.getByLabelText("Opacity");
    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.blur(input);

    expect(onCommit).toHaveBeenCalledWith(1);
  });

  it("increments by step on ArrowUp and decrements on ArrowDown", () => {
    const onCommit = vi.fn();
    render(<InspectorNumericValueControl ariaLabel="Width" value={10} step={2} onCommit={onCommit} />);

    const input = screen.getByLabelText("Width");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(onCommit).toHaveBeenLastCalledWith(12);

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(onCommit).toHaveBeenLastCalledWith(8);
  });

  it("uses the large step when Shift is held", () => {
    const onCommit = vi.fn();
    render(<InspectorNumericValueControl ariaLabel="Width" value={10} step={1} largeStep={20} onCommit={onCommit} />);

    fireEvent.keyDown(screen.getByLabelText("Width"), { key: "ArrowUp", shiftKey: true });
    expect(onCommit).toHaveBeenCalledWith(30);
  });

  it("commits 'auto' when the draft is cleared and allowAuto is set", () => {
    const onCommit = vi.fn();
    render(<InspectorNumericValueControl ariaLabel="Width" value={100} allowAuto onCommit={onCommit} />);

    const input = screen.getByLabelText("Width");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);

    expect(onCommit).toHaveBeenCalledWith("auto");
  });

  it("renders an empty field for the 'auto' value", () => {
    render(<InspectorNumericValueControl ariaLabel="Width" value="auto" allowAuto onCommit={vi.fn()} />);
    expect(screen.getByLabelText("Width")).toHaveValue(null);
  });

  it("syncs the displayed value when the external value changes", () => {
    const { rerender } = render(<InspectorNumericValueControl ariaLabel="Width" value={10} onCommit={vi.fn()} />);
    rerender(<InspectorNumericValueControl ariaLabel="Width" value={55} onCommit={vi.fn()} />);
    expect(screen.getByLabelText("Width")).toHaveValue(55);
  });

  it("disabled prevents editing and never calls onCommit", () => {
    const onCommit = vi.fn();
    render(<InspectorNumericValueControl ariaLabel="Width" value={10} disabled onCommit={onCommit} />);
    expect(screen.getByLabelText("Width")).toBeDisabled();
  });

  it("renders only the allowed unit as plain text when a single unit is configured", () => {
    render(
      <InspectorNumericValueControl
        ariaLabel="Margin"
        value={10}
        unit="px"
        allowedUnits={["px"]}
        onCommit={vi.fn()}
      />,
    );
    expect(screen.getByText("px")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("renders a real unit selector and calls onUnitChange without altering the numeric value", () => {
    const onCommit = vi.fn();
    const onUnitChange = vi.fn();
    render(
      <InspectorNumericValueControl
        ariaLabel="Width"
        value={50}
        unit="px"
        allowedUnits={["px", "%", "rem"]}
        onUnitChange={onUnitChange}
        onCommit={onCommit}
      />,
    );

    fireEvent.change(screen.getByLabelText("Width unit"), { target: { value: "%" } });
    expect(onUnitChange).toHaveBeenCalledWith("%");
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Width")).toHaveValue(50);
  });
});
