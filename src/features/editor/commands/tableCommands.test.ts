import { describe, expect, it } from "vitest";
import {
  setTableBodyRowCount,
  setTableCaptionEnabled,
  setTableColumnCount,
  setTableFooterEnabled,
  setTableHeaderEnabled,
} from "./tableCommands";
import { createTableNode } from "@/features/editor/factories/elementFactories";
import { getTableBody, getTableCaption, getTableFoot, getTableHead } from "@/features/editor/types/table";
import type { EditorElementNode } from "@/features/editor/types/document";

/** Wraps a bare table node in a page root — every command here is written to walk from the document root, matching every other document command's own contract. */
function wrap(table: EditorElementNode): EditorElementNode {
  return { id: "page-1", tag: "page", children: [table] };
}

describe("setTableColumnCount (Checkpoint 1.14)", () => {
  it("grows every row (header and body) by appending fresh cells of the right tag", () => {
    const root = wrap(createTableNode());
    const table = root.children![0];

    const next = setTableColumnCount(root, table.id, 5);
    const nextTable = next.children![0];
    const [thead, tbody] = nextTable.children!;

    expect(thead.children![0].children).toHaveLength(5);
    expect(thead.children![0].children!.every((cell) => cell.tag === "th")).toBe(true);
    for (const row of tbody.children!) {
      expect(row.children).toHaveLength(5);
      expect(row.children!.every((cell) => cell.tag === "td")).toBe(true);
    }
  });

  it("preserves every retained cell's id/text/styles when growing — only appends new cells", () => {
    const root = wrap(createTableNode());
    const table = root.children![0];
    const originalHeaderCells = table.children![0].children![0].children!;

    const next = setTableColumnCount(root, table.id, 5);
    const newHeaderCells = next.children![0].children![0].children![0].children!;

    for (let i = 0; i < originalHeaderCells.length; i++) {
      expect(newHeaderCells[i]).toBe(originalHeaderCells[i]);
    }
  });

  it("shrinks every row by trimming cells from the end", () => {
    const root = wrap(createTableNode());
    const table = root.children![0];

    const next = setTableColumnCount(root, table.id, 1);
    const nextTable = next.children![0];
    const [thead, tbody] = nextTable.children!;

    expect(thead.children![0].children).toHaveLength(1);
    expect(thead.children![0].children![0].text).toBe("Heading 1");
    for (const row of tbody.children!) {
      expect(row.children).toHaveLength(1);
    }
  });

  it("is a no-op (same reference) when every row already has the requested count", () => {
    const root = wrap(createTableNode());
    const table = root.children![0];
    expect(setTableColumnCount(root, table.id, 3)).toBe(root);
  });

  it("is a no-op for a non-table id", () => {
    const root = wrap(createTableNode());
    expect(setTableColumnCount(root, "does-not-exist", 5)).toBe(root);
  });

  it("clamps a negative count to 0", () => {
    const root = wrap(createTableNode());
    const table = root.children![0];
    const next = setTableColumnCount(root, table.id, -3);
    expect(next.children![0].children![0].children![0].children).toEqual([]);
  });

  it("Checkpoint 1.15.6.12.2 — a Caption survives a column-count change untouched (id/text/position all stable)", () => {
    const table = createTableNode();
    const withCaption = setTableCaptionEnabled(wrap(table), table.id, true).children![0];
    const originalCaption = getTableCaption(withCaption)!;

    const next = setTableColumnCount(wrap(withCaption), withCaption.id, 5);
    const nextTable = next.children![0];

    expect(nextTable.children![0]).toBe(originalCaption);
    expect(getTableCaption(nextTable)!.id).toBe(originalCaption.id);
    expect(getTableCaption(nextTable)!.text).toBe(originalCaption.text);
  });

  it("normalizes irregular rows independently, each to the same target count", () => {
    const table: EditorElementNode = {
      id: "table-1",
      tag: "table",
      children: [
        {
          id: "tbody-1",
          tag: "tbody",
          children: [
            { id: "tr-1", tag: "tr", children: [{ id: "td-1", tag: "td", text: "A" }] },
            { id: "tr-2", tag: "tr", children: [{ id: "td-2", tag: "td", text: "B" }, { id: "td-3", tag: "td", text: "C" }, { id: "td-4", tag: "td", text: "D" }] },
          ],
        },
      ],
    };
    const root = wrap(table);
    const next = setTableColumnCount(root, "table-1", 2);
    const rows = next.children![0].children![0].children!;
    expect(rows[0].children).toHaveLength(2);
    expect(rows[0].children![0].text).toBe("A");
    expect(rows[1].children).toHaveLength(2);
    expect(rows[1].children!.map((c) => c.text)).toEqual(["B", "C"]);
  });
});

describe("setTableBodyRowCount (Checkpoint 1.14)", () => {
  it("grows tbody by appending fresh rows matching the table's current column count", () => {
    const root = wrap(createTableNode());
    const table = root.children![0];

    const next = setTableBodyRowCount(root, table.id, 4);
    const tbody = getTableBody(next.children![0])!;
    expect(tbody.children).toHaveLength(4);
    for (const row of tbody.children!) {
      expect(row.children).toHaveLength(3);
      expect(row.children!.every((cell) => cell.tag === "td")).toBe(true);
    }
  });

  it("preserves every retained row untouched when growing", () => {
    const root = wrap(createTableNode());
    const table = root.children![0];
    const originalRows = getTableBody(table)!.children!;

    const next = setTableBodyRowCount(root, table.id, 4);
    const newRows = getTableBody(next.children![0])!.children!;

    expect(newRows[0]).toBe(originalRows[0]);
    expect(newRows[1]).toBe(originalRows[1]);
  });

  it("shrinks tbody by trimming rows from the end, never touching Header/Footer", () => {
    const table = createTableNode();
    const withFooter = setTableFooterEnabled(wrap(table), table.id, true).children![0];
    const root = wrap(withFooter);

    const next = setTableBodyRowCount(root, withFooter.id, 1);
    const nextTable = next.children![0];
    expect(getTableBody(nextTable)!.children).toHaveLength(1);
    expect(getTableHead(nextTable)).toBeDefined();
    expect(getTableFoot(nextTable)).toBeDefined();
  });

  it("is a no-op when the count already matches", () => {
    const root = wrap(createTableNode());
    const table = root.children![0];
    expect(setTableBodyRowCount(root, table.id, 2)).toBe(root);
  });

  it("creates a fresh tbody, inserted after thead, when the table has none yet and a positive count is requested", () => {
    const table: EditorElementNode = {
      id: "table-1",
      tag: "table",
      children: [{ id: "thead-1", tag: "thead", children: [{ id: "tr-1", tag: "tr", children: [{ id: "th-1", tag: "th", text: "Heading 1" }] }] }],
    };
    const root = wrap(table);
    const next = setTableBodyRowCount(root, "table-1", 2);
    const nextTable = next.children![0];
    expect(nextTable.children!.map((c) => c.tag)).toEqual(["thead", "tbody"]);
    expect(getTableBody(nextTable)!.children).toHaveLength(2);
    expect(getTableBody(nextTable)!.children![0].children).toHaveLength(1);
  });

  it("is a no-op (not even creating an empty tbody) when requesting 0 rows on a table with no tbody", () => {
    const table: EditorElementNode = { id: "table-1", tag: "table", children: [{ id: "thead-1", tag: "thead", children: [] }] };
    const root = wrap(table);
    expect(setTableBodyRowCount(root, "table-1", 0)).toBe(root);
  });

  it("Checkpoint 1.15.6.12.2 — a Caption survives a body-row-count change untouched and remains first", () => {
    const table = createTableNode();
    const withCaption = setTableCaptionEnabled(wrap(table), table.id, true).children![0];
    const originalCaption = getTableCaption(withCaption)!;

    const next = setTableBodyRowCount(wrap(withCaption), withCaption.id, 4);
    const nextTable = next.children![0];

    expect(nextTable.children![0].tag).toBe("caption");
    expect(nextTable.children![0]).toBe(originalCaption);
    expect(getTableBody(nextTable)!.children).toHaveLength(4);
  });

  it("Checkpoint 1.15.6.12.2 — creating a fresh tbody from scratch on a captioned, headerless table inserts it right after the Caption, never before", () => {
    const table: EditorElementNode = {
      id: "table-1",
      tag: "table",
      children: [{ id: "caption-1", tag: "caption", text: "My caption" }],
    };
    const root = wrap(table);
    const next = setTableBodyRowCount(root, "table-1", 2);
    const nextTable = next.children![0];
    expect(nextTable.children!.map((c) => c.tag)).toEqual(["caption", "tbody"]);
  });
});

describe("setTableHeaderEnabled (Checkpoint 1.14)", () => {
  it("creates a fresh thead with th cells matching the table's column count, inserted first", () => {
    const table: EditorElementNode = {
      id: "table-1",
      tag: "table",
      children: [
        { id: "tbody-1", tag: "tbody", children: [{ id: "tr-1", tag: "tr", children: [{ id: "td-1", tag: "td", text: "Cell" }, { id: "td-2", tag: "td", text: "Cell" }] }] },
      ],
    };
    const root = wrap(table);
    const next = setTableHeaderEnabled(root, "table-1", true);
    const nextTable = next.children![0];

    expect(nextTable.children!.map((c) => c.tag)).toEqual(["thead", "tbody"]);
    const head = getTableHead(nextTable)!;
    expect(head.children).toHaveLength(1);
    expect(head.children![0].children).toHaveLength(2);
    expect(head.children![0].children!.every((cell) => cell.tag === "th")).toBe(true);
  });

  it("removes the entire thead subtree when disabled", () => {
    const root = wrap(createTableNode());
    const table = root.children![0];
    const next = setTableHeaderEnabled(root, table.id, false);
    expect(getTableHead(next.children![0])).toBeUndefined();
    expect(next.children![0].children!.map((c) => c.tag)).toEqual(["tbody"]);
  });

  it("is a no-op when enabling an already-headered table", () => {
    const root = wrap(createTableNode());
    const table = root.children![0];
    expect(setTableHeaderEnabled(root, table.id, true)).toBe(root);
  });

  it("is a no-op when disabling an already-headerless table", () => {
    const table: EditorElementNode = { id: "table-1", tag: "table", children: [{ id: "tbody-1", tag: "tbody", children: [] }] };
    const root = wrap(table);
    expect(setTableHeaderEnabled(root, "table-1", false)).toBe(root);
  });

  it("never converts existing body cells into header cells or vice versa", () => {
    const root = wrap(createTableNode());
    const table = root.children![0];
    const originalBody = getTableBody(table);

    const next = setTableHeaderEnabled(root, table.id, false);
    const reEnabled = setTableHeaderEnabled(next, table.id, true);

    expect(getTableBody(reEnabled.children![0])).toBe(originalBody);
  });

  it("defaults to at least one column when the table has no rows anywhere yet", () => {
    const table: EditorElementNode = { id: "table-1", tag: "table" };
    const root = wrap(table);
    const next = setTableHeaderEnabled(root, "table-1", true);
    expect(getTableHead(next.children![0])!.children![0].children).toHaveLength(1);
  });

  it("Checkpoint 1.15.6.12.2 — enabling Header on a captioned table inserts thead right AFTER the Caption, never before it (Caption stays the table's first child)", () => {
    const table = createTableNode();
    const withCaption = setTableCaptionEnabled(wrap(table), table.id, true).children![0];
    const withoutHeader = setTableHeaderEnabled(wrap(withCaption), withCaption.id, false).children![0];

    const next = setTableHeaderEnabled(wrap(withoutHeader), withoutHeader.id, true);
    const nextTable = next.children![0];

    expect(nextTable.children!.map((c) => c.tag)).toEqual(["caption", "thead", "tbody"]);
  });

  it("Checkpoint 1.15.6.12.2 — a Caption survives a Header toggle (either direction) untouched and remains first", () => {
    const table = createTableNode();
    const withCaption = setTableCaptionEnabled(wrap(table), table.id, true).children![0];
    const originalCaption = getTableCaption(withCaption)!;

    const headerOff = setTableHeaderEnabled(wrap(withCaption), withCaption.id, false).children![0];
    expect(getTableCaption(headerOff)).toBe(originalCaption);

    const headerOn = setTableHeaderEnabled(wrap(headerOff), headerOff.id, true).children![0];
    expect(getTableCaption(headerOn)).toBe(originalCaption);
    expect(headerOn.children![0].tag).toBe("caption");
  });
});

describe("setTableFooterEnabled (Checkpoint 1.14)", () => {
  it("creates a fresh tfoot with td cells matching the table's column count, inserted last", () => {
    const root = wrap(createTableNode());
    const table = root.children![0];
    const next = setTableFooterEnabled(root, table.id, true);
    const nextTable = next.children![0];

    expect(nextTable.children!.map((c) => c.tag)).toEqual(["thead", "tbody", "tfoot"]);
    const foot = getTableFoot(nextTable)!;
    expect(foot.children).toHaveLength(1);
    expect(foot.children![0].children).toHaveLength(3);
    expect(foot.children![0].children!.every((cell) => cell.tag === "td")).toBe(true);
  });

  it("removes the entire tfoot subtree when disabled", () => {
    const root = wrap(createTableNode());
    const table = root.children![0];
    const withFooter = setTableFooterEnabled(root, table.id, true);
    const next = setTableFooterEnabled(withFooter, table.id, false);
    expect(getTableFoot(next.children![0])).toBeUndefined();
  });

  it("is a no-op when enabling an already-footered table", () => {
    const root = wrap(createTableNode());
    const table = root.children![0];
    const withFooter = setTableFooterEnabled(root, table.id, true);
    expect(setTableFooterEnabled(withFooter, table.id, true)).toBe(withFooter);
  });

  it("is a no-op when disabling an already-footerless table", () => {
    const root = wrap(createTableNode());
    const table = root.children![0];
    expect(setTableFooterEnabled(root, table.id, false)).toBe(root);
  });

  it("Checkpoint 1.15.6.12.2 — a Caption survives a Footer toggle untouched and remains first (Footer always appends last regardless of Caption)", () => {
    const table = createTableNode();
    const withCaption = setTableCaptionEnabled(wrap(table), table.id, true).children![0];
    const originalCaption = getTableCaption(withCaption)!;

    const next = setTableFooterEnabled(wrap(withCaption), withCaption.id, true);
    const nextTable = next.children![0];

    expect(nextTable.children!.map((c) => c.tag)).toEqual(["caption", "thead", "tbody", "tfoot"]);
    expect(getTableCaption(nextTable)).toBe(originalCaption);
  });
});

describe("setTableCaptionEnabled (Checkpoint 1.15.6.12.2)", () => {
  it("creates a fresh caption, inserted as the table's very first child, unconditionally", () => {
    const root = wrap(createTableNode());
    const table = root.children![0];
    const next = setTableCaptionEnabled(root, table.id, true);
    const nextTable = next.children![0];

    expect(nextTable.children![0].tag).toBe("caption");
    expect(nextTable.children![0].text).toBe("Table caption");
    expect(nextTable.children!.slice(1).map((c) => c.tag)).toEqual(table.children!.map((c) => c.tag));
  });

  it("removes the entire caption when disabled, leaving every other child untouched", () => {
    const root = wrap(createTableNode());
    const table = root.children![0];
    const withCaption = setTableCaptionEnabled(root, table.id, true);
    const originalHead = getTableHead(withCaption.children![0]);
    const originalBody = getTableBody(withCaption.children![0]);

    const next = setTableCaptionEnabled(withCaption, table.id, false);
    const nextTable = next.children![0];

    expect(getTableCaption(nextTable)).toBeUndefined();
    expect(getTableHead(nextTable)).toBe(originalHead);
    expect(getTableBody(nextTable)).toBe(originalBody);
  });

  it("is a no-op (same reference, zero history) when enabling an already-captioned table", () => {
    const root = wrap(createTableNode());
    const table = root.children![0];
    const withCaption = setTableCaptionEnabled(root, table.id, true);
    expect(setTableCaptionEnabled(withCaption, table.id, true)).toBe(withCaption);
  });

  it("is a no-op (same reference, zero history) when disabling an already-captionless table", () => {
    const root = wrap(createTableNode());
    const table = root.children![0];
    expect(setTableCaptionEnabled(root, table.id, false)).toBe(root);
  });

  it("does not create a tableCaptionText field on Table — the authored text lives entirely on the real caption child", () => {
    const root = wrap(createTableNode());
    const table = root.children![0];
    const next = setTableCaptionEnabled(root, table.id, true);
    const nextTable = next.children![0] as unknown as Record<string, unknown>;
    expect(nextTable.tableCaptionText).toBeUndefined();
    expect(nextTable.captionText).toBeUndefined();
  });
});
