import {
  isInsertableElementType,
  type InsertableElementType,
} from "@/features/editor/factories/elementFactories";
import { canContainChildren } from "@/features/editor/rules/insertionRules";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import {
  computeDraggedCenterY,
  resolveDropZone,
  type DropZone,
} from "@/features/editor/utils/resolveDropZone";
import type { EditorElementNode } from "@/features/editor/types/document";

export interface DragEndInsertionRequest {
  elementType: InsertableElementType;
  /** Id of whatever node was hovered — useInsertElement resolves the actual parent from this plus zone. */
  targetId?: string;
  zone?: DropZone;
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
 * Pure mapping from a dnd-kit DragEndEvent's shape to an insertion
 * request — kept separate from EditorApp's onDragEnd handler so the
 * "was this a valid, insertable drop" logic can be unit tested directly
 * without simulating a real pointer drag through dnd-kit's internals.
 * Returns null when the drag didn't carry a recognized element payload
 * (e.g. dropped from an unrelated draggable, however unlikely today).
 */
export function resolveDragEndInsertion(
  event: MinimalDragEndEvent,
  documentModel: EditorElementNode,
): DragEndInsertionRequest | null {
  const elementType = event.active.data.current?.elementType;
  if (typeof elementType !== "string" || !isInsertableElementType(elementType)) {
    return null;
  }

  if (!event.over) return { elementType };

  const targetId = String(event.over.id);
  const draggedRect = event.active.rect.current.translated;
  const targetNode = findNodeById(documentModel, targetId);
  if (!draggedRect || !targetNode) return { elementType, targetId };

  const zone = resolveDropZone(
    event.over.rect,
    computeDraggedCenterY(draggedRect),
    canContainChildren(targetNode.tag),
  );

  return { elementType, targetId, zone };
}
