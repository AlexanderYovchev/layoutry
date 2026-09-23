import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GlobalActions, type PreviewControl } from "./GlobalActions";

describe("GlobalActions — Preview control (Checkpoint 1.15.6.8)", () => {
  it("shows an enabled 'Preview' button in Design mode", () => {
    const previewControl: PreviewControl = { mode: "design", onToggle: () => {} };
    render(<GlobalActions previewControl={previewControl} />);

    const button = screen.getByRole("button", { name: "Enter Preview" });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onToggle when clicked", () => {
    const onToggle = vi.fn();
    render(<GlobalActions previewControl={{ mode: "design", onToggle }} />);

    fireEvent.click(screen.getByRole("button", { name: "Enter Preview" }));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("shows an 'Exit Preview' label and aria-pressed=true while in Preview mode", () => {
    const previewControl: PreviewControl = { mode: "preview", onToggle: () => {} };
    render(<GlobalActions previewControl={previewControl} />);

    const button = screen.getByRole("button", { name: "Exit Preview" });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("still shows Undo/Redo/Account as disabled placeholders, unaffected by preview mode", () => {
    render(<GlobalActions previewControl={{ mode: "design", onToggle: () => {} }} />);

    expect(screen.getByRole("button", { name: "Undo (no history yet)" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Redo (no history yet)" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Account (not available yet)" })).toBeDisabled();
  });
});
