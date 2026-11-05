"use client";

import { useDraggable } from "@dnd-kit/core";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useFreeChildMoveSession } from "@/features/canvas/hooks/useFreeChildMoveSession";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { getElementDisplayName } from "@/features/editor/utils/elementDisplayName";
import type { ContainerLayoutMode } from "@/features/editor/types/layout";
import type { EditorElementNode } from "@/features/editor/types/document";

export interface NodeDragSource {
  setNodeRef: (element: HTMLElement | null) => void;
  listeners: Record<string, (event: ReactPointerEvent) => void> | undefined;
  isDragging: boolean;
}

/**
 * Makes an already-rendered document node draggable for reordering/
 * moving. Mirrors CatalogCard's approach from 3.3: only dnd-kit's
 * pointer `listeners` are used, never its `attributes`, so this never
 * overrides whatever native semantics the element itself already has
 * (a <button> stays a real button, an <h1> stays a real heading). The
 * drag payload's kind: "move" discriminant is what lets drop targets
 * and onDragEnd tell this apart from a catalog-card insert drag.
 *
 * Every rendered node is nested inside its container ancestors, and
 * every container is itself draggable too — a plain pointerdown on a
 * child would otherwise bubble up and let the parent's own listener
 * "steal" the drag. The onPointerDown handler here is wrapped to stop
 * propagation before calling dnd-kit's own handler, so only the
 * innermost (actually clicked) node ever activates.
 *
 * Checkpoint 3.4.4: when parentLayoutMode is "free", tree reordering
 * (before/after/inside) makes no sense for an absolutely-positioned Free
 * child — dragging instead repositions it in place via
 * useFreeChildMoveSession, never touching the document tree. Both hooks
 * are always called (React's rules of hooks forbid conditional calls);
 * only one branch's result is ever returned.
 *
 * Preview (BC-02.4): no listeners at all, and dnd-kit's draggable is
 * disabled. Preview is for testing the page, not editing it. Before this,
 * a drag in Preview moved a free-layout element in the document (B8) and
 * recorded an undo step for flow elements, and a parent's listener took
 * over a mouse drag meant to select text in a field.
 */
export function useNodeDragSource(
  node: EditorElementNode,
  parentLayoutMode: ContainerLayoutMode = "flow",
): NodeDragSource {
  const isPreview = useEditorStore((state) => state.editorMode === "preview");
  const { setNodeRef, listeners, isDragging } = useDraggable({
    disabled: isPreview,
    id: node.id,
    data: { kind: "move", nodeId: node.id, label: getElementDisplayName(node) },
  });
  const freeMove = useFreeChildMoveSession(node.id);

  if (isPreview) return { setNodeRef: parentLayoutMode === "free" ? () => {} : setNodeRef, listeners: undefined, isDragging: false };

  if (parentLayoutMode === "free") {
    return {
      setNodeRef: () => {},
      listeners: {
        onPointerDown: freeMove.onPointerDown,
        onPointerMove: freeMove.onPointerMove,
        onPointerUp: freeMove.onPointerUp,
        onPointerCancel: freeMove.onPointerCancel,
      },
      isDragging: freeMove.isDragging,
    };
  }

  const onPointerDown = listeners?.onPointerDown as
    | ((event: ReactPointerEvent) => void)
    | undefined;

  return {
    setNodeRef,
    listeners: onPointerDown
      ? {
          onPointerDown: (event: ReactPointerEvent) => {
            event.stopPropagation();
            onPointerDown(event);
          },
        }
      : undefined,
    isDragging,
  };
}
