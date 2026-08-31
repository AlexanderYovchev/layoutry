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
