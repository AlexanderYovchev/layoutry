"use client";

import type { MouseEvent as ReactMouseEvent } from "react";
import { useEditableText } from "@/features/canvas/hooks/useEditableText";
import { useNodeDragSource } from "@/features/canvas/hooks/useNodeDragSource";
import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { documentDefaultClasses } from "@/features/canvas/utils/documentDefaultStyles";
import { resolveTextElementStyle } from "@/features/canvas/utils/elementStyleRecipes";
import { getLinkHref } from "@/features/editor/types/link";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { cn, mergeRefs } from "@/lib/utils";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

/**
 * Genuine navigation is never appropriate while designing a page —
 * clicking a Link on the Canvas must select/edit it, not carry the
 * whole Layoutry app away to its destination. preventDefault() is the
 * smallest possible fix: it stops the browser's default anchor-click
 * navigation for both mouse and keyboard (Enter-on-a-focused-anchor)
 * activation — both dispatch a real "click" event a browser handles
 * identically — while leaving `href` itself completely real and intact,
 * and without touching event propagation at all, so the click still
 * bubbles up to CanvasInteractionBoundary's own window listener for
 * ordinary selection exactly as it would on any other element. Preview/
 * Export are explicitly out of this checkpoint's scope; a real anchor
 * with a real href is what those future features will need to read.
 */
function preventEditorNavigation(event: ReactMouseEvent) {
  event.preventDefault();
}

export function LinkElement({ node, parentId, parentLayoutMode, parentFlowDisplay }: DocumentElementProps) {
  const dropRef = useNodeDropRegistration(node);
  const { setNodeRef: dragRef, listeners, isDragging } = useNodeDragSource(node, parentLayoutMode);
  const editable = useEditableText(node);
  const isPreview = useEditorStore((state) => state.editorMode === "preview");
  const recipe = resolveTextElementStyle(node, { parentLayoutMode, parentFlowDisplay, isPreview });

  return (
    <a
      href={getLinkHref(node)}
      onClick={preventEditorNavigation}
      id={node.htmlId}
      ref={mergeRefs<HTMLElement>(dropRef, dragRef, editable.elementRef)}
      {...documentNodeAttributes(node, parentId)}
      {...editable.editableProps}
      className={cn(
        documentDefaultClasses(recipe.defaults),
        editable.isEditing && "outline-none",
        isDragging && "opacity-40",
        node.className,
      )}
      style={recipe.style}
      {...(editable.isEditing ? undefined : listeners)}
    >
      {node.text}
    </a>
  );
}
