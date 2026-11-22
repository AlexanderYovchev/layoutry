"use client";

import { useDroppable } from "@dnd-kit/core";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Registers any rendered document node (including leaves — not just
 * containers, unlike Checkpoint 3.3's container-only registration) as a
 * dnd-kit drop target, using the node's own id as the droppable id.
 * Deliberately does nothing else: zone computation and validity live in
 * useActiveDropIndicator (Canvas) and the insert/move pipelines (editor),
 * not duplicated here per-node.
 *
 * BC-12.3: a node is never its own drop target, but that is now enforced
 * by the editor's collision detection (EditorApp: the dragged node's own
 * droppable is skipped), not by reading the active drag here. Reading it
 * here used dnd-kit's public context, which changes on every pointer move,
 * so EVERY Canvas node re-rendered on every move of any drag (measured:
 * ~100 ms per move with 1,000 elements).
 */
export function useNodeDropRegistration(node: EditorElementNode) {
  const { setNodeRef } = useDroppable({ id: node.id });
  return setNodeRef;
}
