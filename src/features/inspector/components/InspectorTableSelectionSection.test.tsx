import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { InspectorTableSelectionSection } from "./InspectorTableSelectionSection";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";

const initialState = useEditorStore.getState();

const table: EditorElementNode = {
  id: "table-1",
  tag: "table",
  children: [
    { id: "thead-1", tag: "thead", children: [{ id: "row-head", tag: "tr", children: [{ id: "th-1", tag: "th" }] }] },
    {
      id: "tbody-1",
      tag: "tbody",
      children: [{ id: "row-1", tag: "tr", children: [{ id: "td-1", tag: "td" }, { id: "td-2", tag: "td" }] }],
    },
  ],
};

describe("InspectorTableSelectionSection (Checkpoint 1.15.2)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("shows Table-level actions when a table is selected", () => {
    render(<InspectorTableSelectionSection node={table} />);
    expect(screen.getByRole("button", { name: "All Cells" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Header Cells" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Body Cells" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Footer Cells" })).toBeInTheDocument();
  });

  it("clicking All Cells calls setSelection with every real th/td id — an ordinary selection, no document mutation", () => {
    const documentBefore = useEditorStore.getState().document;
    render(<InspectorTableSelectionSection node={table} />);

    fireEvent.click(screen.getByRole("button", { name: "All Cells" }));

    expect(useEditorStore.getState().selection.ids).toEqual(["th-1", "td-1", "td-2"]);
    expect(useEditorStore.getState().document).toBe(documentBefore);
    expect(useEditorStore.getState().past).toHaveLength(0);
  });

  it("disables Footer Cells when the table has no tfoot", () => {
    render(<InspectorTableSelectionSection node={table} />);
    expect(screen.getByRole("button", { name: "Footer Cells" })).toBeDisabled();
  });

  it("shows a single 'Cells in Row' action for a selected row", () => {
    const row = table.children?.[1].children?.[0] as EditorElementNode;
    render(<InspectorTableSelectionSection node={row} />);

    fireEvent.click(screen.getByRole("button", { name: "Cells in Row" }));

    expect(useEditorStore.getState().selection.ids).toEqual(["td-1", "td-2"]);
  });
});
