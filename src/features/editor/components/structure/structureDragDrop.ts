import { validateMove, type MoveRejectionReason } from "@/features/editor/commands/moveCommands";
import { canContainChildren } from "@/features/editor/rules/insertionRules";
import { findNodeById, findParentId } from "@/features/editor/utils/findNodeById";
import { existingSelectedIds, orderedSelectionRoots } from "@/features/editor/commands/multiClipboardCommands";
import { getElementDisplayName } from "@/features/editor/utils/elementDisplayName";
import { validateMultiMove } from "@/features/editor/commands/multiMoveCommands";
import { resolveDropZone, type DropZone } from "@/features/editor/utils/resolveDropZone";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * BC-12.3 — Structure panel pointer drag (D1–D4, D10, D12, D13).
 *
 * A row's drag handle is a dnd-kit draggable with this payload kind. The
 * drop target is NOT a dnd-kit droppable: while a Structure drag is active
 * the shared collision detection returns nothing (so the Canvas never
 * reacts), and the Structure panel hit-tests the row under the pointer in
 * the live DOM. That keeps rows revealed by auto-expand and rows scrolled
 * into view immediately targetable, with no per-row measuring.
 */
export const STRUCTURE_DRAG_KIND = "structure-move";

/** How long the pointer rests on a collapsed container's "inside" zone before it opens (D3). Tunable. */
export const STRUCTURE_AUTO_EXPAND_DELAY_MS = 600;

/** Marks a row element with its node id, for hit-testing. */
export const STRUCTURE_ROW_ID_ATTRIBUTE = "data-structure-row-id";

/** BC-12.3.1: marks the drop area under the last row (appends to the end of the page). */
export const STRUCTURE_PAGE_END_ATTRIBUTE = "data-structure-page-end-drop";

/** Marks the Structure tree; the Structure drag auto-scrolls only the scroll region containing it (D4). */
export const STRUCTURE_TREE_ATTRIBUTE = "data-structure-tree";

export interface StructureDragData {
  kind: typeof STRUCTURE_DRAG_KIND;
  nodeId: string;
  label: string;
  tag: string;
  /** Always 1 on the handle; the real count of a multi-drag is resolved at drag start (resolveStructureDragSet). */
  count: number;
}

/**
 * BC-12.4 — what a drag from `nodeId`'s handle moves: with two or more
 * selected elements including it, the minimal selected roots in document
 * order (a selected descendant travels inside its selected ancestor and is
 * not counted twice); otherwise just that element (an unselected row, or
 * the only selected one: the BC-12.3 single drag). Resolved once per drag.
 */
export function resolveStructureDragSet(documentModel: EditorElementNode, selectionIds: readonly string[], nodeId: string): string[] {
  const selected = existingSelectedIds(documentModel, selectionIds);
  if (selected.length < 2 || !selected.includes(nodeId)) return [nodeId];
  return orderedSelectionRoots(documentModel, selected).map((node) => node.id);
}

/**
 * The drag chip's label and count (D13): the count is the number of moved
 * roots (descendants of a moved root are not counted). The label is the
 * dragged row's — or, when the dragged row only travels inside a selected
 * ancestor (the one moved root), that ancestor's, since that is what moves.
 */
export function describeStructureDragSet(documentModel: EditorElementNode, moved: readonly string[], nodeId: string, label: string): { label: string; count: number } {
  if (moved.length === 1 && moved[0] !== nodeId) {
    const root = findNodeById(documentModel, moved[0]);
    return { label: root ? getElementDisplayName(root) : label, count: 1 };
  }
  return { label, count: moved.length };
}

/** Where a moved group now is, read from the document: "Moved 3 elements to Section, positions 2–4 of 5." */
export function describeMovedGroup(documentModel: EditorElementNode, rootIds: readonly string[]): string {
  const parentId = findParentId(documentModel, rootIds[0]);
  const parent = parentId ? findNodeById(documentModel, parentId) : undefined;
  if (!parent) return "";
  const siblings = parent.children ?? [];
  const first = siblings.findIndex((child) => child.id === rootIds[0]);
  return `Moved ${rootIds.length} elements to ${getElementDisplayName(parent)}, positions ${first + 1}–${first + rootIds.length} of ${siblings.length}.`;
}

export type StructureMoveValidator = (targetId: string, zone: DropZone) => MoveRejectionReason | null;

/** The shared verdict for the moved set: validateMove for one element, the all-or-nothing batch rules for several. */
export function structureMoveValidator(documentModel: EditorElementNode, moved: readonly string[]): StructureMoveValidator {
  return moved.length === 1
    ? (targetId, zone) => validateMove(documentModel, moved[0], targetId, zone)
    : (targetId, zone) => validateMultiMove(documentModel, moved, targetId, zone);
}

function asList(moved: string | readonly string[]): readonly string[] {
  return typeof moved === "string" ? [moved] : moved;
}

export function isStructureDragData(data: unknown): data is StructureDragData {
  return typeof data === "object" && data !== null && "kind" in data && data.kind === STRUCTURE_DRAG_KIND && "nodeId" in data && typeof data.nodeId === "string";
}

export interface StructureDropTarget {
  targetId: string;
  zone: DropZone;
  /** null: the shared validator accepts it (a move to where it already is included — it simply changes nothing). */
  rejection: MoveRejectionReason | null;
  /**
   * BC-12.3.1: the row whose indentation the insertion line starts at — the
   * level the element will land at. The hovered row for an ordinary
   * before/after; an ancestor when appending to the end of a container;
   * the first child for "after" an open container.
   */
  levelId: string;
}

interface RectLike {
  top: number;
  height: number;
}

/** Where the pointer is horizontally, and where each row's indentation starts (same coordinate space). */
export interface StructureHoverLevels {
  openNodeIds: ReadonlySet<string>;
  pointerX: number;
  indentStartOf: (id: string) => number | null;
}

/** The parent's children without the dragged elements — unless one is the row being looked at itself. */
function siblingsWithout(documentModel: EditorElementNode, parentId: string, movedIds: ReadonlySet<string>, currentId: string): EditorElementNode[] {
  return (findNodeById(documentModel, parentId)?.children ?? []).filter((child) => !movedIds.has(child.id) || child.id === currentId);
}

/**
 * BC-12.3.1 — the levels the gap under a row can mean. Under a row that is
 * the last child of its parent (the dragged element itself not counted),
 * the same spot is also "the end of that parent", and if the parent is the
 * last child of ITS parent, the end of that one too, up to the page's own
 * children. Deepest first: [row, parent, grandparent, ...]. "After X" for a
 * candidate X is exactly "append to the end of X's parent".
 */
export function trailingLevelCandidates(documentModel: EditorElementNode, rowId: string, moved: string | readonly string[]): string[] {
  const movedIds = new Set(asList(moved));
  const candidates = [rowId];
  let current = rowId;
  for (;;) {
    const parentId = findParentId(documentModel, current);
    if (!parentId || parentId === documentModel.id) break;
    const siblings = siblingsWithout(documentModel, parentId, movedIds, current);
    if (siblings[siblings.length - 1]?.id !== current) break;
    candidates.push(parentId);
    current = parentId;
  }
  return candidates;
}

/**
 * The before / after / inside target for the pointer over a row, with the
 * shared validateMove verdict (the same rules the drop runs). The zones
 * are the Canvas's (resolveDropZone): 25/50/25% for a container, 50/50
 * for a leaf. The page row only takes "inside".
 *
 * BC-12.3.1 — the "after" band is resolved by what is really below it:
 * - an OPEN container with children: its first child follows, so the gap
 *   means "before the first child" (never "after the whole subtree", which
 *   would land somewhere else entirely);
 * - a last child: the pointer's horizontal position picks the level, like
 *   an outliner — over the row's own indentation (or to the right of it) it
 *   is "after this row"; further left, at an ancestor's indentation, it is
 *   "after that ancestor", i.e. the end of the ancestor's parent.
 * Null when the only meaning would be the dragged row itself (BC-12.4: or
 * "inside" one of several dragged rows).
 *
 * `moved`: the dragged element, or (BC-12.4) the moved roots of a
 * multi-drag; `validate` lets the caller reuse one cached validator per drag.
 */
export function resolveStructureDropTarget(
  documentModel: EditorElementNode,
  moved: string | readonly string[],
  rowId: string,
  rowRect: RectLike,
  pointerY: number,
  levels?: StructureHoverLevels,
  validate: StructureMoveValidator = structureMoveValidator(documentModel, asList(moved)),
): StructureDropTarget | null {
  const movedList = asList(moved);
  const row = findNodeById(documentModel, rowId);
  if (!row) return null;
  const zone: DropZone = rowId === documentModel.id ? "inside" : resolveDropZone(rowRect, pointerY, canContainChildren(row.tag));
  let targetId = rowId;
  let finalZone = zone;
  let levelId = rowId;

  if (zone === "after" && levels) {
    const visibleChildren = levels.openNodeIds.has(rowId) ? (row.children ?? []) : [];
    if (visibleChildren.length > 0) {
      targetId = visibleChildren[0].id;
      finalZone = "before";
      levelId = targetId;
    } else {
      const candidates = trailingLevelCandidates(documentModel, rowId, movedList);
      const chosen = candidates.find((id) => {
        const start = levels.indentStartOf(id);
        return start !== null && levels.pointerX >= start;
      });
      targetId = chosen ?? candidates[candidates.length - 1];
      levelId = targetId;
    }
  }

  if (movedList.length === 1 ? targetId === movedList[0] : finalZone === "inside" && movedList.includes(targetId)) return null;
  return { targetId, zone: finalZone, rejection: validate(targetId, finalZone), levelId };
}

/** BC-12.3.1: the drop area under the last row — the end of the page itself. */
export function resolvePageEndTarget(
  documentModel: EditorElementNode,
  moved: string | readonly string[],
  validate: StructureMoveValidator = structureMoveValidator(documentModel, asList(moved)),
): StructureDropTarget {
  return { targetId: documentModel.id, zone: "inside", rejection: validate(documentModel.id, "inside"), levelId: documentModel.id };
}

/** Whether the hovered target should open after the hover delay: a valid "inside" on a closed container that has rows to reveal. */
export function shouldAutoExpand(documentModel: EditorElementNode, target: StructureDropTarget | null, openNodeIds: ReadonlySet<string>): boolean {
  if (!target || target.zone !== "inside" || target.rejection !== null || openNodeIds.has(target.targetId)) return false;
  return (findNodeById(documentModel, target.targetId)?.children?.length ?? 0) > 0;
}
