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

  it("renders a help tooltip trigger with an accessible name when help text is provided", () => {
    render(
      <InspectorSegmentedRow
        label="Layout mode"
        help="Flow keeps elements in reading order. Free lets you position elements freely, like on a canvas."
        options={["Flow", "Free"]}
        activeOption="Flow"
        onSelect={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "Flow keeps elements in reading order. Free lets you position elements freely, like on a canvas.",
      }),
    ).toBeInTheDocument();
  });

  it("does not render a help trigger when help text is omitted, and the label stays a direct sibling of the option group", () => {
    render(<InspectorSegmentedRow label="Layout mode" options={["Flow", "Free"]} activeOption="Flow" onSelect={vi.fn()} />);

    const label = screen.getByText("Layout mode");
    const group = screen.getByRole("group", { name: "Layout mode" });
    expect(label.parentElement).toBe(group.parentElement);
  });

  it("allows the option group to wrap onto multiple lines instead of overflowing (regression: Justify content's six options clipped past the Inspector panel's right edge, Checkpoint 4.1.5)", () => {
    render(
      <InspectorSegmentedRow
        label="Justify content"
        options={["Start", "Center", "End", "Space between", "Space around", "Space evenly"]}
        activeOption="Start"
        onSelect={vi.fn()}
      />,
    );

    const group = screen.getByRole("group", { name: "Justify content" });
    expect(group).toHaveClass("flex-wrap");
    expect(screen.getAllByRole("button")).toHaveLength(6);
  });
});
