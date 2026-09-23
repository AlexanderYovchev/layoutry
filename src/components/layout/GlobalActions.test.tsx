import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GlobalActions, type HistoryControl, type PreviewControl } from "./GlobalActions";

const noopHistory: HistoryControl = { canUndo: false, canRedo: false, onUndo: () => {}, onRedo: () => {} };
const designPreview: PreviewControl = { mode: "design", onToggle: () => {} };

describe("GlobalActions — Preview control (Checkpoint 1.15.6.8)", () => {
  it("shows an enabled 'Preview' button in Design mode", () => {
    render(<GlobalActions historyControl={noopHistory} previewControl={designPreview} />);

    const button = screen.getByRole("button", { name: "Enter Preview" });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onToggle when clicked", () => {
    const onToggle = vi.fn();
    render(<GlobalActions historyControl={noopHistory} previewControl={{ mode: "design", onToggle }} />);

    fireEvent.click(screen.getByRole("button", { name: "Enter Preview" }));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("shows an 'Exit Preview' label and aria-pressed=true while in Preview mode", () => {
    const previewControl: PreviewControl = { mode: "preview", onToggle: () => {} };
    render(<GlobalActions historyControl={noopHistory} previewControl={previewControl} />);

    const button = screen.getByRole("button", { name: "Exit Preview" });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("Account remains a disabled placeholder, unaffected by preview mode", () => {
    render(<GlobalActions historyControl={noopHistory} previewControl={designPreview} />);
    expect(screen.getByRole("button", { name: "Account (not available yet)" })).toBeDisabled();
  });
});

describe("GlobalActions — Undo/Redo history control (Checkpoint 1.15.6.10.2)", () => {
  it("Undo and Redo are disabled when the caller reports no history in either direction", () => {
    render(<GlobalActions historyControl={noopHistory} previewControl={designPreview} />);

    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled();
  });

  it("Undo is enabled when canUndo is true", () => {
    render(
      <GlobalActions historyControl={{ ...noopHistory, canUndo: true }} previewControl={designPreview} />,
    );
    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();
  });

  it("Redo is enabled when canRedo is true", () => {
    render(
      <GlobalActions historyControl={{ ...noopHistory, canRedo: true }} previewControl={designPreview} />,
    );
    expect(screen.getByRole("button", { name: "Redo" })).toBeEnabled();
  });

  it("clicking Undo calls the provided onUndo exactly once", () => {
    const onUndo = vi.fn();
    render(
      <GlobalActions historyControl={{ ...noopHistory, canUndo: true, onUndo }} previewControl={designPreview} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("clicking Redo calls the provided onRedo exactly once", () => {
    const onRedo = vi.fn();
    render(
      <GlobalActions historyControl={{ ...noopHistory, canRedo: true, onRedo }} previewControl={designPreview} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Redo" }));

    expect(onRedo).toHaveBeenCalledTimes(1);
  });

  it("clicking a disabled Undo/Redo never calls the callback", () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    render(
      <GlobalActions historyControl={{ ...noopHistory, onUndo, onRedo }} previewControl={designPreview} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));

    expect(onUndo).not.toHaveBeenCalled();
    expect(onRedo).not.toHaveBeenCalled();
  });

  it("Undo/Redo accessible names carry no stale 'no history yet' text", () => {
    render(<GlobalActions historyControl={noopHistory} previewControl={designPreview} />);

    expect(screen.queryByText(/no history yet/i)).not.toBeInTheDocument();
  });
});
