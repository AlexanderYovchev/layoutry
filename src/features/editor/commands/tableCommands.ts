import {
  createCaptionNode,
  createTableHeaderCellNode,
  createTableDataCellNode,
  createTableRowNode,
  createTableSectionNode,
} from "@/features/editor/factories/elementFactories";
import { getTableColumnCount } from "@/features/editor/types/table";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Where a freshly-created structural section (a toggled-on `<thead>`, or a
 * from-scratch `<tbody>`) should land when there's no more specific
 * sibling to anchor against — Checkpoint 1.15.6.12.2's own "Caption must
 * remain first" requirement, generalized: a `<caption>`, when present, is
 * ALWAYS the table's first child (the one native HTML content-model rule
 * this file enforces), so any section that would otherwise default to
 * index 0 must land at index 1 instead. Centralized here rather than
 * duplicated inline in setTableHeaderEnabled/setTableBodyRowCount below.
 */
function firstStructuralInsertionIndex(children: readonly EditorElementNode[]): number {
  return children[0]?.tag === "caption" ? 1 : 0;
}

/**
 * Table's semantic-level structural commands (Checkpoint 1.14) — the same
 * "the child tree is the only source of truth, commands mutate it
 * directly, no parallel columnCount/rowCount/hasHeader fields anywhere"
 * architecture List's setListItemCount and Select's setOptionCount/
 * setSelectSelectedOption already established (Checkpoints 1.12.1/1.13).
 * Kept in their own file rather than folded into documentCommands.ts —
 * four commands, each with its own small internal helper, is enough
 * cohesive table-specific logic to earn a dedicated, descriptively-named
 * file (see spacingCommands.ts/layoutCommands.ts for the same "cohesive
 * command family gets its own file" precedent). Every command here
 * follows the identical recursive-find-then-rewrite shape every other
 * document command uses — no shared "findAndTransform" abstraction, the
 * same deliberate one-command-one-walk repetition setOptionCount/
 * setSelectSelectedOption already chose over a premature generalization.
 */

function cellTagForSectionTag(sectionTag: string): "th" | "td" {
  return sectionTag === "thead" ? "th" : "td";
}

/** Grows (appending fresh cells) or shrinks (trimming from the end) one row to exactly `count` cells — every retained cell keeps its existing id/text/styles untouched, never rebuilt. */
function normalizeRowCellCount(row: EditorElementNode, count: number, cellTag: "th" | "td"): EditorElementNode {
  const cells = row.children ?? [];
  if (cells.length === count) return row;

  if (count > cells.length) {
    const createCell = cellTag === "th" ? createTableHeaderCellNode : createTableDataCellNode;
    const additions = Array.from({ length: count - cells.length }, createCell);
    return { ...row, children: [...cells, ...additions] };
  }

  return { ...row, children: cells.slice(0, count) };
}

function normalizeSectionColumnCount(section: EditorElementNode, count: number): EditorElementNode {
  if (!section.children) return section;
  const cellTag = cellTagForSectionTag(section.tag);

  let changed = false;
  const children = section.children.map((row) => {
    const updatedRow = normalizeRowCellCount(row, count, cellTag);
    if (updatedRow !== row) changed = true;
    return updatedRow;
  });

  return changed ? { ...section, children } : section;
}

/**
 * Normalizes every row across thead/tbody/tfoot (whichever are present)
 * to exactly `count` cells (Checkpoint 1.14's Columns control) — a header
 * row grows/shrinks with fresh `<th>`s, a body/footer row with fresh
 * `<td>`s, per cellTagForSectionTag above. Irregular tables (rows that
 * already differ in cell count from hand-editing) are normalized
 * per-row, each to the same target count — minimal, additive/subtractive
 * only, never a full rebuild (see this checkpoint's report, section H).
 * No-op-guarded at every level: a table where every row already has
 * exactly `count` cells returns the same root reference untouched.
 */
export function setTableColumnCount(root: EditorElementNode, tableId: string, count: number): EditorElementNode {
  if (root.id === tableId) {
    if (root.tag !== "table" || !root.children) return root;

    const clampedCount = Math.max(0, Math.floor(count));
    let changed = false;
    const children = root.children.map((section) => {
      if (section.tag !== "thead" && section.tag !== "tbody" && section.tag !== "tfoot") return section;
      const updatedSection = normalizeSectionColumnCount(section, clampedCount);
      if (updatedSection !== section) changed = true;
      return updatedSection;
    });

    return changed ? { ...root, children } : root;
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setTableColumnCount(child, tableId, count);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

/**
 * Grows or shrinks the table's `<tbody>` row count (Checkpoint 1.14's
 * Body Rows control) — Header/Footer rows are untouched, matching this
 * checkpoint's brief ("Rows" refers to tbody only). Growing appends fresh
 * rows built at the table's own current column count (getTableColumnCount)
 * so a newly added row is never irregular; shrinking trims rows from the
 * end, preserving every retained row's own cells untouched. If the table
 * somehow has no `<tbody>` yet (never produced by the starter table or by
 * setTableHeaderEnabled/setTableFooterEnabled, but not structurally
 * impossible on a hand-edited document) and a positive count is
 * requested, a fresh `<tbody>` is created and inserted immediately after
 * `<thead>` (or at the front if there is none) — the same valid HTML
 * content-model order (thead, tbody, tfoot) every other table command
 * here preserves.
 */
export function setTableBodyRowCount(root: EditorElementNode, tableId: string, count: number): EditorElementNode {
  if (root.id === tableId) {
    if (root.tag !== "table") return root;

    const clampedCount = Math.max(0, Math.floor(count));
    const columnCount = getTableColumnCount(root);
    const children = root.children ?? [];
    const bodyIndex = children.findIndex((child) => child.tag === "tbody");

    if (bodyIndex === -1) {
      if (clampedCount === 0) return root;
      const newBody = createTableSectionNode(
        "tbody",
        Array.from({ length: clampedCount }, () => createTableRowNode("td", columnCount)),
      );
      const headIndex = children.findIndex((child) => child.tag === "thead");
      const insertAt = headIndex === -1 ? firstStructuralInsertionIndex(children) : headIndex + 1;
      return { ...root, children: [...children.slice(0, insertAt), newBody, ...children.slice(insertAt)] };
    }

    const body = children[bodyIndex];
    const rows = body.children ?? [];
    if (rows.length === clampedCount) return root;

    const newRows =
      clampedCount > rows.length
        ? [...rows, ...Array.from({ length: clampedCount - rows.length }, () => createTableRowNode("td", columnCount))]
        : rows.slice(0, clampedCount);

    const newChildren = [...children];
    newChildren[bodyIndex] = { ...body, children: newRows };
    return { ...root, children: newChildren };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setTableBodyRowCount(child, tableId, count);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

/**
 * Toggles the table's `<thead>` subtree on/off (Checkpoint 1.14) —
 * enabling creates a fresh `<thead>` with one row of `<th>` cells matching
 * the table's current column count (minimum 1, so an otherwise-empty
 * table still gets a usable header) and inserts it first among structural
 * sections — the table's very first position, UNLESS a `<caption>` is
 * present (Checkpoint 1.15.6.12.2's own firstStructuralInsertionIndex),
 * in which case it lands right after it, preserving Caption's own
 * "always the table's first child" HTML content-model rule. Disabling
 * removes the entire `<thead>` subtree in one step. Never converts
 * existing header cells into data cells or vice versa — this only ever
 * adds/removes the whole section. No-op-guarded: enabling an already-
 * headered table, or disabling an already-headerless one, returns the
 * same root reference untouched.
 */
export function setTableHeaderEnabled(root: EditorElementNode, tableId: string, enabled: boolean): EditorElementNode {
  if (root.id === tableId) {
    if (root.tag !== "table") return root;

    const children = root.children ?? [];
    const hasHead = children.some((child) => child.tag === "thead");
    if (enabled === hasHead) return root;

    if (enabled) {
      const columnCount = Math.max(1, getTableColumnCount(root));
      const newHead = createTableSectionNode("thead", [createTableRowNode("th", columnCount)]);
      const insertAt = firstStructuralInsertionIndex(children);
      return { ...root, children: [...children.slice(0, insertAt), newHead, ...children.slice(insertAt)] };
    }

    return { ...root, children: children.filter((child) => child.tag !== "thead") };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setTableHeaderEnabled(child, tableId, enabled);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

/**
 * Toggles the table's `<tfoot>` subtree on/off (Checkpoint 1.14) — the
 * exact same shape setTableHeaderEnabled above uses, mirrored for the
 * footer: fresh `<td>` cells (a footer row is data-shaped, not header-
 * shaped) matching the table's current column count, inserted LAST,
 * matching valid HTML content-model order (thead, tbody, tfoot).
 */
export function setTableFooterEnabled(root: EditorElementNode, tableId: string, enabled: boolean): EditorElementNode {
  if (root.id === tableId) {
    if (root.tag !== "table") return root;

    const children = root.children ?? [];
    const hasFoot = children.some((child) => child.tag === "tfoot");
    if (enabled === hasFoot) return root;

    if (enabled) {
      const columnCount = Math.max(1, getTableColumnCount(root));
      const newFoot = createTableSectionNode("tfoot", [createTableRowNode("td", columnCount)]);
      return { ...root, children: [...children, newFoot] };
    }

    return { ...root, children: children.filter((child) => child.tag !== "tfoot") };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setTableFooterEnabled(child, tableId, enabled);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

/**
 * Toggles the table's `<caption>` on/off (Checkpoint 1.15.6.12.2) — a new
 * Table does NOT get one by default (createTableNode is unchanged); this
 * is the only way one is ever created. Enabling always inserts it at
 * index 0, unconditionally — a `<caption>` is ALWAYS the table's first
 * child per the HTML content model, never anchored relative to thead/
 * tbody/tfoot the way those three are anchored relative to each other.
 * Disabling simply removes it; every other child (thead/tbody/tfoot and
 * their own rows/cells) is left completely untouched either way — no
 * other structural command ever needs to rebuild around a caption's
 * presence beyond firstStructuralInsertionIndex above. No-op-guarded:
 * enabling an already-captioned table, or disabling an already-caption-
 * less one, returns the same root reference untouched (zero history).
 */
export function setTableCaptionEnabled(root: EditorElementNode, tableId: string, enabled: boolean): EditorElementNode {
  if (root.id === tableId) {
    if (root.tag !== "table") return root;

    const children = root.children ?? [];
    const hasCaption = children.some((child) => child.tag === "caption");
    if (enabled === hasCaption) return root;

    if (enabled) {
      return { ...root, children: [createCaptionNode(), ...children] };
    }

    return { ...root, children: children.filter((child) => child.tag !== "caption") };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setTableCaptionEnabled(child, tableId, enabled);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}
