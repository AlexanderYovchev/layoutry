import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InspectorSection } from "./InspectorSection";

describe("InspectorSection", () => {
  it("is open by default and toggles closed on click (uncontrolled)", () => {
    render(
      <InspectorSection label="Spacing">
        <p>content</p>
      </InspectorSection>,
    );

    const header = screen.getByRole("button", { name: "Spacing" });
    expect(header).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(header);
    expect(header).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(header);
    expect(header).toHaveAttribute("aria-expanded", "true");
  });

  it("honors defaultOpen=false", () => {
    render(
      <InspectorSection label="Spacing" defaultOpen={false}>
        <p>content</p>
      </InspectorSection>,
    );
    expect(screen.getByRole("button", { name: "Spacing" })).toHaveAttribute("aria-expanded", "false");
  });

  it("stays closed across a re-render with new children (a property update must not reopen or reset the section)", () => {
    const { rerender } = render(
      <InspectorSection label="Spacing">
        <p>value: 4</p>
      </InspectorSection>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Spacing" }));
    expect(screen.getByRole("button", { name: "Spacing" })).toHaveAttribute("aria-expanded", "false");

    rerender(
      <InspectorSection label="Spacing">
        <p>value: 8</p>
      </InspectorSection>,
    );

    expect(screen.getByRole("button", { name: "Spacing" })).toHaveAttribute("aria-expanded", "false");
  });

  it("supports controlled mode via isOpen/onToggle, calling onToggle with the next state", () => {
    const onToggle = vi.fn();
    render(
      <InspectorSection label="Spacing" isOpen={false} onToggle={onToggle}>
        <p>content</p>
      </InspectorSection>,
    );

    const header = screen.getByRole("button", { name: "Spacing" });
    expect(header).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(header);
    expect(onToggle).toHaveBeenCalledWith(true);
    // Controlled: the prop hasn't changed, so the header stays closed until the caller re-renders with isOpen=true.
    expect(header).toHaveAttribute("aria-expanded", "false");
  });

  it("disabled prevents toggling and hides the panel", () => {
    render(
      <InspectorSection label="Spacing" disabled>
        <p>content</p>
      </InspectorSection>,
    );

    const header = screen.getByRole("button", { name: "Spacing" });
    expect(header).toBeDisabled();
    expect(screen.queryByText("content")).not.toBeInTheDocument();
  });

  it("renders section-level actions and does not toggle the section when an action is clicked", () => {
    const onAction = vi.fn();
    render(
      <InspectorSection
        label="Spacing"
        actions={
          <button type="button" onClick={onAction}>
            Reset all
          </button>
        }
      >
        <p>content</p>
      </InspectorSection>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reset all" }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Spacing" })).toHaveAttribute("aria-expanded", "true");
  });

  it("associates the header and panel via aria-controls/aria-labelledby", () => {
    render(
      <InspectorSection label="Spacing">
        <p>content</p>
      </InspectorSection>,
    );

    const header = screen.getByRole("button", { name: "Spacing" });
    const controlsId = header.getAttribute("aria-controls");
    expect(controlsId).toBeTruthy();
    const panel = document.getElementById(controlsId!);
    expect(panel).toHaveAttribute("aria-labelledby", header.id);
  });
});
