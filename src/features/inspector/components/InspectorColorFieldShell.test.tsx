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

  it("renders a static, disabled preview swatch when onCommit is omitted (no picker to open)", () => {
    render(<InspectorColorFieldShell value="#3366ff" label="Background color" />);
    expect(screen.getByRole("button", { name: /Background color preview/ })).toBeDisabled();
    expect(screen.queryByLabelText("Choose background color")).not.toBeInTheDocument();
  });

  it("renders a real native color-picker input as the swatch when onCommit is provided", () => {
    render(<InspectorColorFieldShell value="#3366ff" onCommit={vi.fn()} label="Background color" />);
    const picker = screen.getByLabelText("Choose background color");
    expect(picker).toHaveAttribute("type", "color");
    expect(picker).toHaveValue("#3366ff");
  });

  it("disables the color-picker input when disabled", () => {
    render(<InspectorColorFieldShell value="#3366ff" onCommit={vi.fn()} disabled label="Background color" />);
    expect(screen.getByLabelText("Choose background color")).toBeDisabled();
  });

  it("expands a short 3-digit hex to its 6-digit form for the native picker", () => {
    render(<InspectorColorFieldShell value="#0af" onCommit={vi.fn()} label="Background color" />);
    expect(screen.getByLabelText("Choose background color")).toHaveValue("#00aaff");
  });

  it("falls back to a safe default in the native picker for a non-representable value, without altering the text field", () => {
    render(<InspectorColorFieldShell value="rgba(0, 0, 0, 0.5)" onCommit={vi.fn()} label="Text color" />);
    expect(screen.getByLabelText("Choose text color")).toHaveValue("#000000");
    expect(screen.getByLabelText("Text color")).toHaveValue("rgba(0, 0, 0, 0.5)");
  });

  it("commits the picked hex through onCommit when the native picker fires its change event", () => {
    const onCommit = vi.fn();
    render(<InspectorColorFieldShell value="#3366ff" onCommit={onCommit} label="Background color" />);

    const picker = screen.getByLabelText("Choose background color");
    fireEvent.change(picker, { target: { value: "#ff8800" } });

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("#ff8800");
  });

  it("does not commit on the native picker's input event (only on change) — avoids one history entry per drag frame", () => {
    const onCommit = vi.fn();
    render(<InspectorColorFieldShell value="#3366ff" onCommit={onCommit} label="Background color" />);

    fireEvent.input(screen.getByLabelText("Choose background color"), { target: { value: "#ff8800" } });

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("does not stomp an in-progress native pick when an unrelated re-render happens before the change event fires", () => {
    // Regression test: an earlier version made the picker a React-controlled
    // input (value + a no-op onChange). Since this app re-renders on every
    // store change, any unrelated re-render while the native color dialog
    // was still open would force the DOM value back to the last-rendered
    // prop, discarding whatever the user was still mid-picking — so picking
    // a color visually silently appeared to do nothing. The fix made the
    // input uncontrolled (defaultValue) with an imperative ref-based sync
    // that only runs when the *committed* value actually changes.
    const onCommit = vi.fn();
    const { rerender } = render(<InspectorColorFieldShell value="#3366ff" onCommit={onCommit} label="Background color" />);

    const picker = screen.getByLabelText("Choose background color") as HTMLInputElement;

    // Simulate the browser having live-updated the input while the native
    // dialog is still open, before it has fired `change`.
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
    setter.call(picker, "#112233");

    // An unrelated re-render with the *same* props (e.g. some other part of
    // the app updated the store) must not reset the in-progress DOM value.
    rerender(<InspectorColorFieldShell value="#3366ff" onCommit={onCommit} label="Background color" />);
    expect(picker.value).toBe("#112233");

    // The user then finalizes the pick.
    fireEvent.change(picker, { target: { value: "#112233" } });
    expect(onCommit).toHaveBeenCalledWith("#112233");
  });

  it("updates the text field after a color is picked visually (external value change)", () => {
    const { rerender } = render(<InspectorColorFieldShell value="#3366ff" onCommit={vi.fn()} label="Background color" />);
    expect(screen.getByLabelText("Background color")).toHaveValue("#3366ff");

    rerender(<InspectorColorFieldShell value="#ff8800" onCommit={vi.fn()} label="Background color" />);
    expect(screen.getByLabelText("Background color")).toHaveValue("#ff8800");
    expect(screen.getByLabelText("Choose background color")).toHaveValue("#ff8800");
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
