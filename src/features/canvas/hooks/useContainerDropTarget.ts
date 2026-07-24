"use client";

import { useDroppable } from "@dnd-kit/core";
import { canContainChildren } from "@/features/editor/rules/insertionRules";
import type { EditorElementNode } from "@/features/editor/types/document";

export interface ContainerDropTarget {
  /** Merge onto the container's own ref; undefined (never attached) when the node can't accept children. */
  setNodeRef: ((element: HTMLElement | null) => void) | undefined;
  /** True only while a drag is actively hovering this specific container. */
  isDropActive: boolean;
}

/**
 * Registers a rendered container node as a dnd-kit drop target, using
 * the node's own id as the droppable id so onDragEnd can hand it
 * straight to useInsertElement as the requested parent. Non-container
 * tags are registered disabled — they never light up during a drag,
 * per the milestone's "invalid targets receive nothing."
 */
export function useContainerDropTarget(node: EditorElementNode): ContainerDropTarget {
  const isContainer = canContainChildren(node.tag);
  const { setNodeRef, isOver } = useDroppable({
    id: node.id,
    disabled: !isContainer,
  });

  return {
    setNodeRef: isContainer ? setNodeRef : undefined,
    isDropActive: isContainer && isOver,
  };
}
