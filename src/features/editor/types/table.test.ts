import { describe, expect, it } from "vitest";
import { getTableBody, getTableBodyRowCount, getTableColumnCount, getTableFoot, getTableHead } from "./table";
import { createTableNode } from "@/features/editor/factories/elementFactories";
import type { EditorElementNode } from "@/features/editor/types/document";

describe("getTableHead / getTableBody / getTableFoot (Checkpoint 1.14)", () => {
  it("finds each section by tag on a table with all three present", () => {
    const table: EditorElementNode = {
      id: "table-1",
      tag: "table",
      children: [
        { id: "thead-1", tag: "thead", children: [] },
        { id: "tbody-1", tag: "tbody", children: [] },
        { id: "tfoot-1", tag: "tfoot", children: [] },
      ],
    };

    expect(getTableHead(table)?.id).toBe("thead-1");
    expect(getTableBody(table)?.id).toBe("tbody-1");
    expect(getTableFoot(table)?.id).toBe("tfoot-1");
  });

  it("returns undefined for a section that isn't present", () => {
    const table: EditorElementNode = { id: "table-1", tag: "table", children: [{ id: "tbody-1", tag: "tbody", children: [] }] };

    expect(getTableHead(table)).toBeUndefined();
    expect(getTableFoot(table)).toBeUndefined();
    expect(getTableBody(table)?.id).toBe("tbody-1");
  });

  it("returns undefined for a table with no children at all", () => {
    const table: EditorElementNode = { id: "table-1", tag: "table" };
    expect(getTableHead(table)).toBeUndefined();
    expect(getTableBody(table)).toBeUndefined();
    expect(getTableFoot(table)).toBeUndefined();
  });
});

describe("getTableColumnCount (Checkpoint 1.14)", () => {
  it("reads column count from the header row when a thead is present", () => {
    const table = createTableNode();
    expect(getTableColumnCount(table)).toBe(3);
  });

  it("falls back to the body's first row when there is no header row", () => {
    const table: EditorElementNode = {
      id: "table-1",
      tag: "table",
      children: [
        {
          id: "tbody-1",
          tag: "tbody",
          children: [{ id: "tr-1", tag: "tr", children: [{ id: "td-1", tag: "td", text: "Cell" }, { id: "td-2", tag: "td", text: "Cell" }] }],
        },
      ],
    };
    expect(getTableColumnCount(table)).toBe(2);
  });

  it("falls back to the footer's first row when there is neither a header nor a body row", () => {
    const table: EditorElementNode = {
      id: "table-1",
      tag: "table",
      children: [
        { id: "tbody-1", tag: "tbody", children: [] },
        { id: "tfoot-1", tag: "tfoot", children: [{ id: "tr-1", tag: "tr", children: [{ id: "td-1", tag: "td", text: "Cell" }] }] },
      ],
    };
    expect(getTableColumnCount(table)).toBe(1);
  });

  it("is 0 for a table with no rows anywhere", () => {
    const table: EditorElementNode = { id: "table-1", tag: "table", children: [{ id: "tbody-1", tag: "tbody", children: [] }] };
    expect(getTableColumnCount(table)).toBe(0);
  });
});

describe("getTableBodyRowCount (Checkpoint 1.14)", () => {
  it("counts only rows under tbody — header/footer rows are never included", () => {
    const table = createTableNode();
    expect(getTableBodyRowCount(table)).toBe(2);
  });

  it("is 0 when there is no tbody at all", () => {
    const table: EditorElementNode = { id: "table-1", tag: "table", children: [{ id: "thead-1", tag: "thead", children: [] }] };
    expect(getTableBodyRowCount(table)).toBe(0);
  });
});
