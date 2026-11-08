import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InspectorHelpButton } from "./InspectorHelpButton";

function tooltipOf(button: HTMLElement): HTMLElement {
  const tooltip = button.parentElement?.lastElementChild;
  if (!(tooltip instanceof HTMLElement)) throw new Error("tooltip not found");
  return tooltip;
}

const SHOWN_ON_HOVER = "group-hover:opacity-100";
const SHOWN_ON_FOCUS = "group-focus-within:opacity-100";

describe("InspectorHelpButton (BC-04.2)", () => {
  const windowKeyDown = vi.fn((event: KeyboardEvent) => event.defaultPrevented);
  afterEach(() => {
    window.removeEventListener("keydown", windowKeyDown);
    windowKeyDown.mockClear();
  });

  it("is a focusable button named by the help text, with the help as its tooltip and as a description other controls can reference", () => {
    render(
      <>
        <InspectorHelpButton
          help="Explains the field."
          descriptionId="help-1"
        />
        <input aria-label="Field" aria-describedby="help-1" />
      </>,
    );
    const button = screen.getByRole("button", { name: "Explains the field." });
    expect(
      screen.getByRole("textbox", { name: "Field" }),
    ).toHaveAccessibleDescription("Explains the field.");
    button.focus();
    expect(button).toHaveFocus();
    expect(tooltipOf(button)).toHaveTextContent("Explains the field.");
    expect(tooltipOf(button)).toHaveAttribute("aria-hidden", "true");
  });

  it("Escape hides the tooltip without moving focus, and the editor's own Escape doesn't also run", () => {
    window.addEventListener("keydown", windowKeyDown);
    render(<InspectorHelpButton help="Explains the field." />);
    const button = screen.getByRole("button", { name: "Explains the field." });
    expect(tooltipOf(button).className).toContain(SHOWN_ON_FOCUS);

    act(() => button.focus());
    fireEvent.keyDown(button, { key: "Escape" });

    expect(button).toHaveFocus();
    expect(tooltipOf(button).className).not.toContain(SHOWN_ON_FOCUS);
    expect(tooltipOf(button).className).not.toContain(SHOWN_ON_HOVER);
    expect(windowKeyDown).toHaveLastReturnedWith(true);

    // Already dismissed: a second Escape is the editor's again.
    fireEvent.keyDown(button, { key: "Escape" });
    expect(windowKeyDown).toHaveLastReturnedWith(false);
  });

  it("shows again once pointer and focus have both left", () => {
    render(<InspectorHelpButton help="Explains the field." />);
    const button = screen.getByRole("button", { name: "Explains the field." });
    fireEvent.pointerEnter(button);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(tooltipOf(button).className).not.toContain(SHOWN_ON_HOVER);

    fireEvent.pointerLeave(button);
    expect(tooltipOf(button).className).toContain(SHOWN_ON_HOVER);
  });

  it("hovered while a text field has focus: hides the tooltip but leaves Escape to the field", () => {
    window.addEventListener("keydown", windowKeyDown);
    render(
      <>
        <input aria-label="Field" />
        <InspectorHelpButton help="Explains the field." />
      </>,
    );
    const field = screen.getByRole("textbox", { name: "Field" });
    const button = screen.getByRole("button", { name: "Explains the field." });
    act(() => field.focus());
    fireEvent.pointerEnter(button);
    fireEvent.keyDown(field, { key: "Escape" });

    expect(tooltipOf(button).className).not.toContain(SHOWN_ON_HOVER);
    expect(windowKeyDown).toHaveLastReturnedWith(false);
    expect(field).toHaveFocus();
  });

  it("leaves Escape alone while the tooltip isn't showing", () => {
    window.addEventListener("keydown", windowKeyDown);
    render(<InspectorHelpButton help="Explains the field." />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(windowKeyDown).toHaveLastReturnedWith(false);
  });
});
