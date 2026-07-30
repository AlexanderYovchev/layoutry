import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InspectorResetButton } from "./InspectorResetButton";

describe("InspectorResetButton", () => {
  it("calls onReset when clicked", () => {
    const onReset = vi.fn();
    render(<InspectorResetButton onReset={onReset} label="Reset margin" />);
    fireEvent.click(screen.getByRole("button", { name: "Reset margin" }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("is disabled (and inert) when there is no explicit value to reset", () => {
    const onReset = vi.fn();
    render(<InspectorResetButton onReset={onReset} disabled label="Reset margin" />);
    const button = screen.getByRole("button", { name: "Reset margin" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onReset).not.toHaveBeenCalled();
  });
});
