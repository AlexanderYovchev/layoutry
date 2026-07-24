"use client";

import { useDndContext, useDroppable } from "@dnd-kit/core";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Registers any rendered document node (including leaves — not just
 * containers, unlike Checkpoint 3.3's container-only registration) as a
 * dnd-kit drop target, using the node's own id as the droppable id.
 * Deliberately does nothing else: zone computation and validity live in
 * useActiveDropIndicator (Canvas) and the insert/move pipelines (editor),
 * not duplicated here per-node. Disabled while the node itself is the
 * one being dragged, so a node never registers as its own drop target.
 */
export function useNodeDropRegistration(node: EditorElementNode) {
  const { active } = useDndContext();
  const { setNodeRef } = useDroppable({
    id: node.id,
    disabled: active?.id === node.id,
  });

  return setNodeRef;
}
