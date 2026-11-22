import { validateMove, type MoveRejectionReason } from "@/features/editor/commands/moveCommands";
import { canContainChildren } from "@/features/editor/rules/insertionRules";
import { findNodeById, findParentId } from "@/features/editor/utils/findNodeById";
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
  /** BC-12.4 (multi-drag) will set this; one element in BC-12.3. */
  count: 1;
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

/** The parent's children without the dragged element — unless it is the row being looked at itself. */
function siblingsWithout(documentModel: EditorElementNode, parentId: string, draggedId: string, currentId: string): EditorElementNode[] {
  return (findNodeById(documentModel, parentId)?.children ?? []).filter((child) => child.id !== draggedId || child.id === currentId);
}

/**
 * BC-12.3.1 — the levels the gap under a row can mean. Under a row that is
 * the last child of its parent (the dragged element itself not counted),
 * the same spot is also "the end of that parent", and if the parent is the
 * last child of ITS parent, the end of that one too, up to the page's own
 * children. Deepest first: [row, parent, grandparent, ...]. "After X" for a
 * candidate X is exactly "append to the end of X's parent".
 */
export function trailingLevelCandidates(documentModel: EditorElementNode, rowId: string, draggedId: string): string[] {
  const candidates = [rowId];
  let current = rowId;
  for (;;) {
    const parentId = findParentId(documentModel, current);
    if (!parentId || parentId === documentModel.id) break;
    const siblings = siblingsWithout(documentModel, parentId, draggedId, current);
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
 * Null when the only meaning would be the dragged row itself.
 */
export function resolveStructureDropTarget(
  documentModel: EditorElementNode,
  draggedId: string,
  rowId: string,
  rowRect: RectLike,
  pointerY: number,
  levels?: StructureHoverLevels,
): StructureDropTarget | null {
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
      const candidates = trailingLevelCandidates(documentModel, rowId, draggedId);
      const chosen = candidates.find((id) => {
        const start = levels.indentStartOf(id);
        return start !== null && levels.pointerX >= start;
      });
      targetId = chosen ?? candidates[candidates.length - 1];
      levelId = targetId;
    }
  }

  if (targetId === draggedId) return null;
  return { targetId, zone: finalZone, rejection: validateMove(documentModel, draggedId, targetId, finalZone), levelId };
}

/** BC-12.3.1: the drop area under the last row — the end of the page itself. */
export function resolvePageEndTarget(documentModel: EditorElementNode, draggedId: string): StructureDropTarget {
  return { targetId: documentModel.id, zone: "inside", rejection: validateMove(documentModel, draggedId, documentModel.id, "inside"), levelId: documentModel.id };
}

/** Whether the hovered target should open after the hover delay: a valid "inside" on a closed container that has rows to reveal. */
export function shouldAutoExpand(documentModel: EditorElementNode, target: StructureDropTarget | null, openNodeIds: ReadonlySet<string>): boolean {
  if (!target || target.zone !== "inside" || target.rejection !== null || openNodeIds.has(target.targetId)) return false;
  return (findNodeById(documentModel, target.targetId)?.children?.length ?? 0) > 0;
}
