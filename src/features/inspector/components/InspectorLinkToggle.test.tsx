import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InspectorLinkToggle } from "./InspectorLinkToggle";

describe("InspectorLinkToggle", () => {
  it("shows 'Linked' text and aria-pressed=true when linked", () => {
    render(<InspectorLinkToggle linked onToggle={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Linked" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows 'Unlinked' text and aria-pressed=false when not linked", () => {
    render(<InspectorLinkToggle linked={false} onToggle={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Unlinked" })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onToggle when clicked", () => {
    const onToggle = vi.fn();
    render(<InspectorLinkToggle linked onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("button", { name: "Linked" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("does not call onToggle when disabled", () => {
    const onToggle = vi.fn();
    render(<InspectorLinkToggle linked onToggle={onToggle} disabled />);
    expect(screen.getByRole("button", { name: "Linked" })).toBeDisabled();
  });
});
