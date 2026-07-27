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
});
