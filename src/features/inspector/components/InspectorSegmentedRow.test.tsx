import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InspectorSegmentedRow } from "./InspectorSegmentedRow";

describe("InspectorSegmentedRow", () => {
  it("renders plain, non-interactive spans when onSelect is omitted", () => {
    render(<InspectorSegmentedRow label="Layout mode" options={["Flow", "Free"]} activeOption="Flow" />);

    expect(screen.getByText("Flow").tagName).toBe("SPAN");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders real buttons and calls onSelect when a non-active option is clicked", () => {
    const onSelect = vi.fn();
    render(
      <InspectorSegmentedRow
        label="Layout mode"
        options={["Flow", "Free"]}
        activeOption="Flow"
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Free" }));
    expect(onSelect).toHaveBeenCalledWith("Free");
  });

  it("marks the active option as pressed", () => {
    render(
      <InspectorSegmentedRow
        label="Layout mode"
        options={["Flow", "Free"]}
        activeOption="Free"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Free" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Flow" })).toHaveAttribute("aria-pressed", "false");
  });

  it("moves focus to the next option on ArrowRight, wrapping past the last option", () => {
    render(
      <InspectorSegmentedRow
        label="Layout mode"
        options={["Flow", "Free", "Absolute"]}
        activeOption="Flow"
        onSelect={vi.fn()}
      />,
    );

    const flow = screen.getByRole("button", { name: "Flow" });
    const free = screen.getByRole("button", { name: "Free" });
    const absolute = screen.getByRole("button", { name: "Absolute" });

    flow.focus();
    fireEvent.keyDown(flow, { key: "ArrowRight" });
    expect(free).toHaveFocus();

    fireEvent.keyDown(free, { key: "ArrowRight" });
    expect(absolute).toHaveFocus();

    fireEvent.keyDown(absolute, { key: "ArrowRight" });
    expect(flow).toHaveFocus();
  });

  it("moves focus to the previous option on ArrowLeft, wrapping before the first option", () => {
    render(
      <InspectorSegmentedRow
        label="Layout mode"
        options={["Flow", "Free"]}
        activeOption="Flow"
        onSelect={vi.fn()}
      />,
    );

    const flow = screen.getByRole("button", { name: "Flow" });
    const free = screen.getByRole("button", { name: "Free" });

    flow.focus();
    fireEvent.keyDown(flow, { key: "ArrowLeft" });
    expect(free).toHaveFocus();
  });

  it("disabled options render as non-interactive buttons", () => {
    const onSelect = vi.fn();
    render(
      <InspectorSegmentedRow
        label="Layout mode"
        options={["Flow", "Free"]}
        activeOption="Flow"
        onSelect={onSelect}
        disabled
      />,
    );

    expect(screen.getByRole("button", { name: "Free" })).toBeDisabled();
  });
});
