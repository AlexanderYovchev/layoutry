import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockContainerElement } from "@/features/inspector/mockSelectedElement";
import { InspectorContent } from "./InspectorContent";

describe("InspectorContent", () => {
  it("shows the no-selection empty state by default", () => {
    render(<InspectorContent />);

    expect(screen.getByText("Inspector")).toBeInTheDocument();
    expect(screen.getByText("No selection")).toBeInTheDocument();
    expect(screen.getByText("No element selected")).toBeInTheDocument();
  });

  it("shows the element summary and sections for a mock selected element", () => {
    render(<InspectorContent selectedElement={mockContainerElement} />);

    expect(screen.getByText("1 element selected")).toBeInTheDocument();
    expect(screen.getByText("Container")).toBeInTheDocument();
    expect(screen.getByText("<div>")).toBeInTheDocument();

    for (const label of [
      "Layout",
      "Size",
      "Spacing",
      "Background",
      "Border",
      "Effects",
      "Advanced",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("opens Layout and Size by default, and keeps the rest collapsed", () => {
    render(<InspectorContent selectedElement={mockContainerElement} />);

    expect(screen.getByText("Display")).toBeInTheDocument();
    expect(screen.getByText("Width")).toBeInTheDocument();
    expect(screen.queryByText("Padding")).not.toBeInTheDocument();
  });

  it("expands a collapsed section on click and collapses an open one", async () => {
    const user = userEvent.setup();
    render(<InspectorContent selectedElement={mockContainerElement} />);

    const spacingHeader = screen.getByRole("button", { name: "Spacing" });
    expect(spacingHeader).toHaveAttribute("aria-expanded", "false");

    await user.click(spacingHeader);
    expect(spacingHeader).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Padding")).toBeInTheDocument();

    const layoutHeader = screen.getByRole("button", { name: "Layout" });
    expect(layoutHeader).toHaveAttribute("aria-expanded", "true");

    await user.click(layoutHeader);
    expect(layoutHeader).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Display")).not.toBeInTheDocument();
  });
});
