import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Small, focused reads over a Table's own ordinary child tree (Checkpoint
 * 1.14) — deliberately NOT a parallel table data model (no columnCount/
 * rowCount/hasHeader fields anywhere; see EditorElementNode's own lack of
 * any table-specific field). The actual thead/tbody/tfoot/tr/th/td
 * subtree is the only source of truth; every value here is derived fresh
 * from it, the same "count children, don't store a count" precedent
 * List's getListItemCount-shaped Inspector controls and Select's own
 * option-count control already established (Checkpoints 1.12.1/1.13).
 *
 * A Table is not enforced to have at most one thead/tbody/tfoot — nothing
 * in this checkpoint's insertion/move rules prevents a second one from
 * being dragged in — so each getter here deliberately returns the FIRST
 * matching child rather than throwing or attempting to merge multiple;
 * the Table Inspector's own commands (tableCommands.ts) only ever produce
 * a well-formed single-of-each subtree, so this is a defensive fallback
 * for hand-assembled/future-edited documents, not the expected shape.
 */

export function getTableHead(node: EditorElementNode): EditorElementNode | undefined {
  return node.children?.find((child) => child.tag === "thead");
}

export function getTableBody(node: EditorElementNode): EditorElementNode | undefined {
  return node.children?.find((child) => child.tag === "tbody");
}

export function getTableFoot(node: EditorElementNode): EditorElementNode | undefined {
  return node.children?.find((child) => child.tag === "tfoot");
}

/**
 * A table's effective column count — read from whichever section has a
 * row first (header, then body, then footer), matching the order a user
 * would naturally think of "how many columns does this table have."
 * Zero when no section has any row yet (an edge case the Inspector's own
 * commands never produce, since the starter table and Header/Footer
 * toggles always create at least one row when they create a section at
 * all — see tableCommands.ts).
 */
export function getTableColumnCount(node: EditorElementNode): number {
  const head = getTableHead(node);
  const headRow = head?.children?.[0];
  if (headRow) return headRow.children?.length ?? 0;

  const body = getTableBody(node);
  const bodyRow = body?.children?.[0];
  if (bodyRow) return bodyRow.children?.length ?? 0;

  const foot = getTableFoot(node);
  const footRow = foot?.children?.[0];
  if (footRow) return footRow.children?.length ?? 0;

  return 0;
}

/** The number of rows under the table's `<tbody>` only — Header/Footer rows are a separate, dedicated toggle (see InspectorTableSection), not counted here. */
export function getTableBodyRowCount(node: EditorElementNode): number {
  return getTableBody(node)?.children?.length ?? 0;
}

/**
 * Table bulk-selection helpers (Checkpoint 1.15.2, Part D of its own
 * report) — pure reads over the genuine th/td tree, returning ordinary
 * node ids to hand to the shared multi-selection action (setSelection).
 * Deliberately NOT a synthetic "Cell Group" concept: the result is
 * indistinguishable from a selection the user built by hand, Ctrl-
 * clicking each cell one at a time — that's the whole architectural
 * point (see this checkpoint's report, section L).
 */
export function getTableRowCellIds(row: EditorElementNode): string[] {
  return (row.children ?? []).filter((child) => child.tag === "th" || child.tag === "td").map((cell) => cell.id);
}

function getSectionCellIds(section: EditorElementNode | undefined): string[] {
  if (!section) return [];
  return (section.children ?? []).flatMap((row) => getTableRowCellIds(row));
}

export function getTableHeaderCellIds(table: EditorElementNode): string[] {
  return getSectionCellIds(getTableHead(table));
}

export function getTableBodyCellIds(table: EditorElementNode): string[] {
  return getSectionCellIds(getTableBody(table));
}

export function getTableFooterCellIds(table: EditorElementNode): string[] {
  return getSectionCellIds(getTableFoot(table));
}

/** Every real th/td cell in the table, across thead/tbody/tfoot, in document order. */
export function getTableCellIds(table: EditorElementNode): string[] {
  return [...getTableHeaderCellIds(table), ...getTableBodyCellIds(table), ...getTableFooterCellIds(table)];
}
