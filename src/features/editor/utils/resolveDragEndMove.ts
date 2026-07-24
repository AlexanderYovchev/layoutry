import { canContainChildren } from "@/features/editor/rules/insertionRules";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import {
  computeDraggedCenterY,
  resolveDropZone,
  type DropZone,
} from "@/features/editor/utils/resolveDropZone";
import type { EditorElementNode } from "@/features/editor/types/document";

export interface DragEndMoveRequest {
  nodeId: string;
  targetId: string;
  zone: DropZone;
}

interface RectLike {
  top: number;
  height: number;
}

interface MinimalDragEndEvent {
  active: {
    data: { current?: Record<string, unknown> };
    rect: { current: { translated: RectLike | null } };
  };
  over: { id: string | number; rect: RectLike } | null;
}

/**
 * Pure mapping from a dnd-kit DragEndEvent to a move request — the
 * move-drag counterpart to resolveDragEndInsertion, kept separate since
 * the two payload kinds ("move" vs implicit catalog-insert) produce
 * differently-shaped requests. Returns null for anything that isn't a
 * recognized, resolvable move-kind drag: no payload, no drop target, or
 * geometry the browser never actually measured.
 */
export function resolveDragEndMove(
  event: MinimalDragEndEvent,
  documentModel: EditorElementNode,
): DragEndMoveRequest | null {
  const dragData = event.active.data.current;
  if (dragData?.kind !== "move" || typeof dragData.nodeId !== "string") return null;
  if (!event.over) return null;

  const draggedRect = event.active.rect.current.translated;
  if (!draggedRect) return null;

  const targetId = String(event.over.id);
  const targetNode = findNodeById(documentModel, targetId);
  if (!targetNode) return null;

  const zone = resolveDropZone(
    event.over.rect,
    computeDraggedCenterY(draggedRect),
    canContainChildren(targetNode.tag),
  );

  return { nodeId: dragData.nodeId, targetId, zone };
}
