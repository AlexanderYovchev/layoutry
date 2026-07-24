import {
  isInsertableElementType,
  type InsertableElementType,
} from "@/features/editor/factories/elementFactories";

export interface DragEndInsertionRequest {
  elementType: InsertableElementType;
  targetParentId?: string;
}

interface MinimalDragEndEvent {
  active: { data: { current?: Record<string, unknown> } };
  over: { id: string | number } | null;
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
): DragEndInsertionRequest | null {
  const elementType = event.active.data.current?.elementType;
  if (typeof elementType !== "string" || !isInsertableElementType(elementType)) {
    return null;
  }

  return {
    elementType,
    targetParentId: event.over ? String(event.over.id) : undefined,
  };
}
