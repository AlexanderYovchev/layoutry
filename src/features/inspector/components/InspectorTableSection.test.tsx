import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InspectorTableSection } from "./InspectorTableSection";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { createTableNode } from "@/features/editor/factories/elementFactories";

const initialState = useEditorStore.getState();

function commit(label: string, value: number) {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value: String(value) } });
  fireEvent.blur(input);
}

describe("InspectorTableSection (Checkpoint 1.14)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("shows the table's current column count, derived from the header row", () => {
    render(<InspectorTableSection node={createTableNode()} />);
    expect(screen.getByLabelText("Columns")).toHaveValue(3);
  });

  it("shows the table's current body row count", () => {
    render(<InspectorTableSection node={createTableNode()} />);
    expect(screen.getByLabelText("Body Rows")).toHaveValue(2);
  });

  it("shows Header Row as on for the starter table (it ships with a thead)", () => {
    render(<InspectorTableSection node={createTableNode()} />);
    expect(screen.getByRole("switch", { name: "Header Row" })).toHaveAttribute("aria-checked", "true");
  });

  it("shows Footer Row as off for the starter table (no tfoot by default)", () => {
    render(<InspectorTableSection node={createTableNode()} />);
    expect(screen.getByRole("switch", { name: "Footer Row" })).toHaveAttribute("aria-checked", "false");
  });

  it("committing a new Columns value calls setTableColumnCount with the table's id", () => {
    const table = createTableNode();
    // Spied BEFORE render: InspectorNumberFieldRow's draft edit is local
    // child state, so committing it never re-renders InspectorTableSection
    // itself — its store-selected setTableColumnCount closure is captured
    // exactly once, at this initial render, so the spy must already be in
    // place on the store object before that render happens.
    const spy = vi.spyOn(useEditorStore.getState(), "setTableColumnCount");
    render(<InspectorTableSection node={table} />);

    commit("Columns", 5);

    expect(spy).toHaveBeenCalledWith(table.id, 5);
  });

  it("committing a new Body Rows value calls setTableBodyRowCount with the table's id", () => {
    const table = createTableNode();
    const spy = vi.spyOn(useEditorStore.getState(), "setTableBodyRowCount");
    render(<InspectorTableSection node={table} />);

    commit("Body Rows", 4);

    expect(spy).toHaveBeenCalledWith(table.id, 4);
  });

  it("clicking the Header Row toggle calls setTableHeaderEnabled with the opposite of its current state", () => {
    const table = createTableNode();
    const spy = vi.spyOn(useEditorStore.getState(), "setTableHeaderEnabled");
    render(<InspectorTableSection node={table} />);

    fireEvent.click(screen.getByRole("switch", { name: "Header Row" }));

    expect(spy).toHaveBeenCalledWith(table.id, false);
  });

  it("clicking the Footer Row toggle calls setTableFooterEnabled with the opposite of its current state", () => {
    const table = createTableNode();
    const spy = vi.spyOn(useEditorStore.getState(), "setTableFooterEnabled");
    render(<InspectorTableSection node={table} />);

    fireEvent.click(screen.getByRole("switch", { name: "Footer Row" }));

    expect(spy).toHaveBeenCalledWith(table.id, true);
  });
});
