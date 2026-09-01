import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InspectorBulkTextField } from "./InspectorBulkTextField";

describe("InspectorBulkTextField (Checkpoint 1.15.2)", () => {
  it("shows the shared value when every selected node agrees", () => {
    render(<InspectorBulkTextField ariaLabel="Text color" shared={{ kind: "same", value: "#ff0000" }} onCommit={() => {}} />);
    expect(screen.getByLabelText("Text color")).toHaveValue("#ff0000");
  });

  it("shows an empty draft with a Mixed placeholder when the selection disagrees", () => {
    render(<InspectorBulkTextField ariaLabel="Text color" shared={{ kind: "mixed" }} onCommit={() => {}} />);
    const input = screen.getByLabelText("Text color");
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("placeholder", "Mixed");
  });

  it("committing on blur calls onCommit with the trimmed value", () => {
    const onCommit = vi.fn();
    render(<InspectorBulkTextField ariaLabel="Text color" shared={{ kind: "mixed" }} onCommit={onCommit} />);
    const input = screen.getByLabelText("Text color");
    fireEvent.change(input, { target: { value: "  #00ff00  " } });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith("#00ff00");
  });

  it("Enter commits once, and the resulting blur does not double-commit", () => {
    const onCommit = vi.fn();
    render(<InspectorBulkTextField ariaLabel="Text color" shared={{ kind: "mixed" }} onCommit={onCommit} />);
    const input = screen.getByLabelText("Text color");
    fireEvent.change(input, { target: { value: "#00ff00" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("blurring an untouched field never commits", () => {
    const onCommit = vi.fn();
    render(<InspectorBulkTextField ariaLabel="Text color" shared={{ kind: "same", value: "#ff0000" }} onCommit={onCommit} />);
    const input = screen.getByLabelText("Text color");
    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("Escape reverts the draft without committing", () => {
    const onCommit = vi.fn();
    render(<InspectorBulkTextField ariaLabel="Text color" shared={{ kind: "same", value: "#ff0000" }} onCommit={onCommit} />);
    const input = screen.getByLabelText("Text color");
    fireEvent.change(input, { target: { value: "garbage" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue("#ff0000");
  });

  it("an empty committed draft reverts rather than clearing", () => {
    const onCommit = vi.fn();
    render(<InspectorBulkTextField ariaLabel="Text color" shared={{ kind: "same", value: "#ff0000" }} onCommit={onCommit} />);
    const input = screen.getByLabelText("Text color");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue("#ff0000");
  });
});
