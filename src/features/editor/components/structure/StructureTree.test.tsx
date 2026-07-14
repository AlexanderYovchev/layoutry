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
    const user = userEvent.setup();
    render(<StructureTree />);

    const [firstSectionToggle] = screen.getAllByRole("button", {
      name: "Collapse Section",
    });

    expect(screen.getByText("Heading")).toBeInTheDocument();

    await user.click(firstSectionToggle);

    expect(screen.queryByText("Heading")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Expand Section" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Expand Section" }));

    expect(screen.getByText("Heading")).toBeInTheDocument();
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
    await user.click(sectionToggles[1]);
    expect(screen.queryByText("Image")).not.toBeInTheDocument();

    act(() => {
      useEditorStore.getState().selectElement("image-1");
    });

    expect(screen.getByText("Image")).toBeInTheDocument();
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
