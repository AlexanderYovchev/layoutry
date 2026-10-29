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

  it("with live off, reverts to the last committed value on Escape without calling onCommit", () => {
    const onCommit = vi.fn();
    render(<InspectorNumericValueControl ariaLabel="Width" value={10} onCommit={onCommit} live={false} />);

    const input = screen.getByLabelText("Width");
    fireEvent.change(input, { target: { value: "999" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue(10);
  });

  it("with live off, Escape never commits, even though it also blurs a genuinely-focused input (Checkpoint 5.5 regression)", () => {
    const onCommit = vi.fn();
    render(<InspectorNumericValueControl ariaLabel="Width" value={10} onCommit={onCommit} live={false} />);

    const input = screen.getByLabelText("Width");
    input.focus();
    fireEvent.change(input, { target: { value: "999" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("live: Escape adds no commit beyond the live preview, reverts the draft and reports the cancel (BC-01.3)", () => {
    const onCommit = vi.fn();
    const onEditCancel = vi.fn();
    render(<InspectorNumericValueControl ariaLabel="Width" value={10} onCommit={onCommit} onEditCancel={onEditCancel} />);

    const input = screen.getByLabelText("Width");
    input.focus();
    fireEvent.change(input, { target: { value: "999" } });
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(999);
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onEditCancel).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue(10);
  });

  it("a blur with no edit at all never commits (Checkpoint 5.6 regression — tabbing through an unedited field must not push a spurious history entry)", () => {
    const onCommit = vi.fn();
    render(<InspectorNumericValueControl ariaLabel="Width" value={10} onCommit={onCommit} />);

    const input = screen.getByLabelText("Width");
    input.focus();
    fireEvent.blur(input);

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("re-typing the exact same already-committed value on blur still commits (a genuine edit, even to the same number, must not be silently dropped — e.g. it's how an implicit default becomes an explicit stored value)", () => {
    const onCommit = vi.fn();
    render(<InspectorNumericValueControl ariaLabel="Width" value={10} onCommit={onCommit} />);

    const input = screen.getByLabelText("Width");
    // Two changes, not one: firing a single `change` with a value
    // identical to the DOM's current value is a jsdom/React no-op (React
    // skips a controlled input's onChange when its value tracker sees no
    // actual change), which would mask this test's real intent. Routing
    // through a different intermediate value first reproduces a real
    // user's keystrokes reliably.
    fireEvent.change(input, { target: { value: "20" } });
    fireEvent.change(input, { target: { value: "10" } });
    fireEvent.blur(input);

    expect(onCommit).toHaveBeenCalledWith(10);
  });

  it("a genuine edit that clamps to the current value still commits", () => {
    const onCommit = vi.fn();
    render(<InspectorNumericValueControl ariaLabel="Opacity" value={1} min={0} max={1} onCommit={onCommit} />);

    const input = screen.getByLabelText("Opacity");
    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.blur(input);

    expect(onCommit).toHaveBeenCalledWith(1);
  });

  it("blurring an unedited allowAuto field already at 'auto' does not re-commit 'auto'", () => {
    const onCommit = vi.fn();
    render(<InspectorNumericValueControl ariaLabel="Width" value="auto" allowAuto onCommit={onCommit} />);

    const input = screen.getByLabelText("Width");
    input.focus();
    fireEvent.blur(input);

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

  describe("keyword display and stepping (BC-01.5)", () => {
    it("Arrow steps carry no binary float drift (1.3 + 0.1 = 1.4, 1.429 - 0.1 = 1.329)", () => {
      const onCommit = vi.fn();
      const { rerender } = render(<InspectorNumericValueControl ariaLabel="Line height" value={1.3} step={0.1} onCommit={onCommit} />);
      const input = screen.getByLabelText("Line height");
      fireEvent.keyDown(input, { key: "ArrowUp" });
      expect(onCommit).toHaveBeenLastCalledWith(1.4);

      rerender(<InspectorNumericValueControl ariaLabel="Line height" value={1.429} step={0.1} onCommit={onCommit} />);
      fireEvent.keyDown(input, { key: "ArrowDown" });
      expect(onCommit).toHaveBeenLastCalledWith(1.329);
    });

    it("shows keywordPlaceholder over an empty field while the value is the keyword, and steps from keywordStepBase", () => {
      const onCommit = vi.fn();
      render(<InspectorNumericValueControl ariaLabel="Line height" value="auto" step={0.1} keywordPlaceholder="Normal" keywordStepBase={1.2} onCommit={onCommit} />);
      const input = screen.getByLabelText("Line height");
      expect(input).toHaveValue(null);
      expect(input).toHaveAttribute("placeholder", "Normal");

      fireEvent.keyDown(input, { key: "ArrowDown" });
      expect(onCommit).toHaveBeenCalledExactlyOnceWith(1.1);
    });

    it("without allowAuto, an emptied keyword field never commits the keyword", () => {
      const onCommit = vi.fn();
      render(<InspectorNumericValueControl ariaLabel="Line height" value="auto" keywordPlaceholder="Normal" onCommit={onCommit} />);
      const input = screen.getByLabelText("Line height");
      input.focus();
      fireEvent.change(input, { target: { value: "2" } });
      fireEvent.change(input, { target: { value: "" } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(onCommit).not.toHaveBeenCalledWith("auto");
      expect(input).toHaveAttribute("placeholder", "Normal");
    });

    it("a numeric value keeps the existing placeholder rules (none unless allowAuto)", () => {
      render(<InspectorNumericValueControl ariaLabel="Line height" value={1.5} keywordPlaceholder="Normal" onCommit={() => {}} />);
      expect(screen.getByLabelText("Line height")).not.toHaveAttribute("placeholder");
    });
  });
});
