import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { InspectorMediaTextField } from "./InspectorMediaTextField";

function renderField(overrides: Partial<ComponentProps<typeof InspectorMediaTextField>> = {}) {
  const onCommit = vi.fn();
  const onReset = vi.fn();
  render(
    <InspectorMediaTextField
      id="test-field"
      label="Source URL"
      value=""
      hasExplicitValue={false}
      onCommit={onCommit}
      onReset={onReset}
      {...overrides}
    />,
  );
  return { onCommit, onReset };
}

describe("InspectorMediaTextField (Checkpoint 1.15)", () => {
  it("commits the trimmed draft on blur", () => {
    const { onCommit } = renderField();
    const input = screen.getByLabelText("Source URL");
    fireEvent.change(input, { target: { value: "  https://example.com  " } });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith("https://example.com");
  });

  it("commits on Enter", () => {
    const { onCommit } = renderField();
    const input = screen.getByLabelText("Source URL");
    fireEvent.change(input, { target: { value: "https://example.com" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCommit).toHaveBeenCalledWith("https://example.com");
  });

  it("does not double-commit when Enter's own blur() fires the native blur event (the React-closure race InspectorNumberFieldRow's own doc comment documents)", () => {
    const { onCommit } = renderField();
    const input = screen.getByLabelText("Source URL");
    fireEvent.change(input, { target: { value: "https://example.com" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("Escape reverts the draft without committing", () => {
    const { onCommit } = renderField({ value: "https://original.com", hasExplicitValue: true });
    const input = screen.getByLabelText("Source URL");
    fireEvent.change(input, { target: { value: "https://discarded.com" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect((input as HTMLInputElement).value).toBe("https://original.com");
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("an untouched blur (focus passed through, no edit) never commits — no spurious no-op history entry", () => {
    const { onCommit } = renderField({ value: "https://example.com", hasExplicitValue: true });
    const input = screen.getByLabelText("Source URL");
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("an empty draft on blur reverts rather than committing", () => {
    const { onCommit } = renderField({ value: "https://example.com", hasExplicitValue: true });
    const input = screen.getByLabelText("Source URL");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
    expect((input as HTMLInputElement).value).toBe("https://example.com");
  });

  it("clicking Reset calls onReset", () => {
    const { onReset } = renderField({ value: "https://example.com", hasExplicitValue: true });
    fireEvent.click(screen.getByLabelText("Reset source url"));
    expect(onReset).toHaveBeenCalled();
  });

  it("shows the error message and marks the field invalid when an error is passed", () => {
    renderField({ error: "Enter a valid video URL." });
    expect(screen.getByText("Enter a valid video URL.")).toBeInTheDocument();
    expect(screen.getByLabelText("Source URL")).toHaveAttribute("aria-invalid", "true");
  });
});
