import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { mockContainerElement } from "@/features/inspector/mockSelectedElement";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { InspectorContent } from "./InspectorContent";

const initialState = useEditorStore.getState();

describe("InspectorContent", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

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

  // A collapsed section's content stays mounted (so the collapse can
  // animate) but becomes inert — removed from focus and the
  // accessibility tree — rather than being removed from the DOM outright.
  // Uses the header's own aria-controls, which also exercises the
  // heading-button/panel ARIA relationship itself.
  function getSectionContent(header: HTMLElement) {
    const panelId = header.getAttribute("aria-controls");
    return document.getElementById(panelId ?? "") as HTMLElement;
  }

  it("opens Layout and Size by default, and keeps the rest collapsed", () => {
    render(<InspectorContent selectedElement={mockContainerElement} />);

    expect(screen.getByText("Display")).toBeInTheDocument();

    const sizeContent = getSectionContent(
      screen.getByRole("button", { name: "Size" }),
    );
    expect(within(sizeContent).getByText("Width")).toBeInTheDocument();
    expect(sizeContent).not.toHaveAttribute("inert");

    const spacingContent = getSectionContent(
      screen.getByRole("button", { name: "Spacing" }),
    );
    expect(spacingContent).toHaveAttribute("inert");
  });

  it("expands a collapsed section on click and collapses an open one", async () => {
    const user = userEvent.setup();
    render(<InspectorContent selectedElement={mockContainerElement} />);

    const spacingHeader = screen.getByRole("button", { name: "Spacing" });
    expect(spacingHeader).toHaveAttribute("aria-expanded", "false");

    await user.click(spacingHeader);
    expect(spacingHeader).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Padding")).toBeInTheDocument();
    expect(getSectionContent(spacingHeader)).not.toHaveAttribute("inert");

    const layoutHeader = screen.getByRole("button", { name: "Layout" });
    expect(layoutHeader).toHaveAttribute("aria-expanded", "true");

    await user.click(layoutHeader);
    expect(layoutHeader).toHaveAttribute("aria-expanded", "false");
    expect(getSectionContent(layoutHeader)).toHaveAttribute("inert");
  });

  it("shows a real selected node's read-only summary, taking priority over mock data", () => {
    useEditorStore.setState({ selectedElementId: "heading-1" });

    render(<InspectorContent selectedElement={mockContainerElement} />);

    expect(screen.getByText("1 element selected")).toBeInTheDocument();
    expect(screen.getByText("Heading")).toBeInTheDocument();
    expect(screen.getByText("heading-1")).toBeInTheDocument();
    // The mock CSS-section demo must not render while a real node is selected.
    expect(screen.queryByText("Layout")).not.toBeInTheDocument();
  });

  it("falls back to the no-selection state when the selected id no longer resolves", () => {
    useEditorStore.setState({ selectedElementId: "does-not-exist" });

    render(<InspectorContent />);

    expect(screen.getByText("No selection")).toBeInTheDocument();
    expect(screen.getByText("No element selected")).toBeInTheDocument();
  });
});
