import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { resetScopeProps } from "@/features/inspector/utils/inspectorResetScope";
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

describe("InspectorResetButton focus after reset (BC-05.2)", () => {
  function Row({ set, onReset }: { set: boolean; onReset: () => void }) {
    return (
      <div {...resetScopeProps}>
        <input aria-label="Font size" />
        <InspectorResetButton onReset={onReset} disabled={!set} label="Reset font size" />
      </div>
    );
  }

  function Harness() {
    const [set, setSet] = useState(true);
    return <Row set={set} onReset={() => setSet(false)} />;
  }

  it("a keyboard reset (click with detail 0) that hides the button moves focus to the row's own control", async () => {
    render(<Harness />);
    const button = screen.getByRole("button", { name: "Reset font size" });
    button.focus();
    fireEvent.click(button, { detail: 0 });
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Font size" })).toHaveFocus());
    expect(button).toBeDisabled();
  });

  it("a pointer click (detail 1) leaves focus alone", async () => {
    render(<Harness />);
    const button = screen.getByRole("button", { name: "Reset font size" });
    fireEvent.click(button, { detail: 1 });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(screen.getByRole("textbox", { name: "Font size" })).not.toHaveFocus();
  });

  it("a keyboard reset that leaves the button enabled keeps focus on it", async () => {
    render(<Row set onReset={() => undefined} />);
    const button = screen.getByRole("button", { name: "Reset font size" });
    button.focus();
    fireEvent.click(button, { detail: 0 });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(button).toHaveFocus();
  });

  it("is marked as a reset button, so edit sessions can tell it apart", () => {
    render(<InspectorResetButton onReset={() => undefined} label="Reset margin" />);
    expect(screen.getByRole("button", { name: "Reset margin" })).toHaveAttribute("data-inspector-reset");
  });
});
