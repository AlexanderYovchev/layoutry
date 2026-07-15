import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { StructureTree } from "./StructureTree";

const initialState = useEditorStore.getState();

describe("StructureTree", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("renders the page root and nested child nodes", () => {
    render(<StructureTree />);

    expect(screen.getByText("Page")).toBeInTheDocument();
    expect(screen.getAllByText("Section")).toHaveLength(2);
    expect(screen.getByText("Heading")).toBeInTheDocument();
    expect(screen.getByText("Paragraph")).toBeInTheDocument();
    expect(screen.getByText("Primary Button")).toBeInTheDocument();
    expect(screen.getByText("Image")).toBeInTheDocument();
  });

  it("collapses and expands a section's children via its disclosure control", async () => {
    // Collapsed children stay mounted (so the collapse can animate) but
    // become inert — removed from focus and the accessibility tree —
    // rather than being removed from the DOM outright.
    const user = userEvent.setup();
    render(<StructureTree />);

    const [firstSectionToggle] = screen.getAllByRole("button", {
      name: "Collapse Section",
    });
    const headingGroup = screen
      .getByText("Heading")
      .closest('[role="group"]') as HTMLElement;

    expect(headingGroup).not.toHaveAttribute("inert");

    await user.click(firstSectionToggle);

    expect(headingGroup).toHaveAttribute("inert");
    expect(
      screen.getByRole("button", { name: "Expand Section" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Expand Section" }));

    expect(headingGroup).not.toHaveAttribute("inert");
  });

  it("selects the corresponding element when a row is clicked", async () => {
    const user = userEvent.setup();
    render(<StructureTree />);

    await user.click(screen.getByText("Heading"));

    expect(useEditorStore.getState().selectedElementId).toBe("heading-1");
  });

  it("marks the matching row selected when the store's selection changes externally", () => {
    render(<StructureTree />);

    act(() => {
      useEditorStore.getState().selectElement("image-1");
    });

    expect(
      screen.getByText("Image").closest('[role="treeitem"]'),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("expands a collapsed ancestor when a nested element is selected externally", async () => {
    const user = userEvent.setup();
    render(<StructureTree />);

    const sectionToggles = screen.getAllByRole("button", {
      name: "Collapse Section",
    });
    const imageGroup = screen
      .getByText("Image")
      .closest('[role="group"]') as HTMLElement;

    await user.click(sectionToggles[1]);
    expect(imageGroup).toHaveAttribute("inert");

    act(() => {
      useEditorStore.getState().selectElement("image-1");
    });

    expect(imageGroup).not.toHaveAttribute("inert");
    expect(
      screen.getByText("Image").closest('[role="treeitem"]'),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("does not expose expandable semantics on leaf nodes", () => {
    render(<StructureTree />);

    const headingRow = screen.getByText("Heading").closest('[role="treeitem"]');
    expect(headingRow).not.toHaveAttribute("aria-expanded");
  });

  it("selects the focused row on Enter", () => {
    render(<StructureTree />);

    const paragraphRow = screen
      .getByText("Paragraph")
      .closest('[role="treeitem"]') as HTMLElement;
    paragraphRow.focus();
    fireEvent.keyDown(paragraphRow, { key: "Enter" });

    expect(useEditorStore.getState().selectedElementId).toBe("paragraph-1");
  });

  it("keeps only one row in the tab sequence at a time (roving tabindex)", () => {
    render(<StructureTree />);

    const pageRow = screen.getByText("Page").closest('[role="treeitem"]');
    const headingRow = screen.getByText("Heading").closest('[role="treeitem"]');
    expect(pageRow).toHaveAttribute("tabindex", "0");
    expect(headingRow).toHaveAttribute("tabindex", "-1");

    fireEvent.focus(headingRow as HTMLElement);

    expect(pageRow).toHaveAttribute("tabindex", "-1");
    expect(headingRow).toHaveAttribute("tabindex", "0");
  });

  it("moves focus to the next and previous visible row with ArrowDown/ArrowUp", () => {
    render(<StructureTree />);

    const pageRow = screen
      .getByText("Page")
      .closest('[role="treeitem"]') as HTMLElement;
    const firstSectionRow = screen
      .getAllByText("Section")[0]
      .closest('[role="treeitem"]') as HTMLElement;

    pageRow.focus();
    fireEvent.keyDown(pageRow, { key: "ArrowDown" });
    expect(firstSectionRow).toHaveFocus();

    fireEvent.keyDown(firstSectionRow, { key: "ArrowUp" });
    expect(pageRow).toHaveFocus();
  });

  it("does not move focus past the first row on ArrowUp", () => {
    render(<StructureTree />);

    const pageRow = screen
      .getByText("Page")
      .closest('[role="treeitem"]') as HTMLElement;

    pageRow.focus();
    fireEvent.keyDown(pageRow, { key: "ArrowUp" });

    expect(pageRow).toHaveFocus();
  });

  it("moves focus to the first and last visible row with Home/End", () => {
    render(<StructureTree />);

    const pageRow = screen
      .getByText("Page")
      .closest('[role="treeitem"]') as HTMLElement;
    const imageRow = screen
      .getByText("Image")
      .closest('[role="treeitem"]') as HTMLElement;

    pageRow.focus();
    fireEvent.keyDown(pageRow, { key: "End" });
    expect(imageRow).toHaveFocus();

    fireEvent.keyDown(imageRow, { key: "Home" });
    expect(pageRow).toHaveFocus();
  });

  it("skips a collapsed branch's children when moving focus with ArrowDown", async () => {
    const user = userEvent.setup();
    render(<StructureTree />);

    const [firstSectionToggle] = screen.getAllByRole("button", {
      name: "Collapse Section",
    });
    await user.click(firstSectionToggle);

    const firstSectionRow = screen
      .getAllByText("Section")[0]
      .closest('[role="treeitem"]') as HTMLElement;
    const secondSectionRow = screen
      .getAllByText("Section")[1]
      .closest('[role="treeitem"]') as HTMLElement;

    firstSectionRow.focus();
    fireEvent.keyDown(firstSectionRow, { key: "ArrowDown" });

    expect(secondSectionRow).toHaveFocus();
  });

  it("truncates a long element name and exposes the full name via title", () => {
    const longName =
      "A very long custom component label that should truncate instead of wrapping or overflowing";

    useEditorStore.setState({
      document: {
        id: "root",
        tag: "page",
        children: [{ id: "long-1", tag: "div", displayName: longName }],
      },
    });

    render(<StructureTree />);

    const row = screen.getByText(longName).closest('[role="treeitem"]');
    expect(row).toHaveAttribute("title", longName);
    expect(screen.getByText(longName)).toHaveClass("truncate");
  });
});
