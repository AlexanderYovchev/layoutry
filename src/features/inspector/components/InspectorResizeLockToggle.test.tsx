import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InspectorResizeLockToggle } from "./InspectorResizeLockToggle";

describe("InspectorResizeLockToggle", () => {
  it("shows Locked/aria-pressed=true when locked", () => {
    render(<InspectorResizeLockToggle locked onToggle={vi.fn()} />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveTextContent("Locked");
  });

  it("shows Unlocked/aria-pressed=false when unlocked", () => {
    render(<InspectorResizeLockToggle locked={false} onToggle={vi.fn()} />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).toHaveTextContent("Unlocked");
  });

  it("calls onToggle when clicked", () => {
    const onToggle = vi.fn();
    render(<InspectorResizeLockToggle locked={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("is disabled when requested", () => {
    render(<InspectorResizeLockToggle locked={false} onToggle={vi.fn()} disabled />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("has an accessible name distinguishing this from Checkpoint 5.5's Aspect Ratio control", () => {
    render(<InspectorResizeLockToggle locked onToggle={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Lock resize proportions/ })).toBeInTheDocument();
  });
});
