import { validateMove, type MoveRejectionReason } from "@/features/editor/commands/moveCommands";
import { canContainChildren } from "@/features/editor/rules/insertionRules";
import { findNodeById } from "@/features/editor/utils/findNodeById";
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
}

interface RectLike {
  top: number;
  height: number;
}

/**
 * The before / after / inside target for the pointer over a row, with the
 * shared validateMove verdict (the same rules the drop runs). The zones
 * are the Canvas's (resolveDropZone): 25/50/25% for a container, 50/50
 * for a leaf. The page row only takes "inside". Null over the dragged
 * row itself (no indicator for "onto itself").
 */
export function resolveStructureDropTarget(
  documentModel: EditorElementNode,
  draggedId: string,
  rowId: string,
  rowRect: RectLike,
  pointerY: number,
): StructureDropTarget | null {
  if (rowId === draggedId) return null;
  const target = findNodeById(documentModel, rowId);
  if (!target) return null;
  const zone: DropZone = rowId === documentModel.id ? "inside" : resolveDropZone(rowRect, pointerY, canContainChildren(target.tag));
  return { targetId: rowId, zone, rejection: validateMove(documentModel, draggedId, rowId, zone) };
}

/** Whether the hovered target should open after the hover delay: a valid "inside" on a closed container that has rows to reveal. */
export function shouldAutoExpand(documentModel: EditorElementNode, target: StructureDropTarget | null, openNodeIds: ReadonlySet<string>): boolean {
  if (!target || target.zone !== "inside" || target.rejection !== null || openNodeIds.has(target.targetId)) return false;
  return (findNodeById(documentModel, target.targetId)?.children?.length ?? 0) > 0;
}
