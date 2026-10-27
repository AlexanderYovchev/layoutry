"use client";

import { useEditableText } from "@/features/canvas/hooks/useEditableText";
import { useNodeDragSource } from "@/features/canvas/hooks/useNodeDragSource";
import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { documentDefaultClasses } from "@/features/canvas/utils/documentDefaultStyles";
import { resolveTextElementStyle } from "@/features/canvas/utils/elementStyleRecipes";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { cn, mergeRefs } from "@/lib/utils";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

/**
 * A genuine `<legend>` — text-bearing leaf, the exact same shape as
 * ListItemElement (Checkpoint 1.15.6.12.1): no child-element content
 * model, `useEditableText` reused unchanged (double-click/blur-commit/
 * Enter-commit/Escape-cancel/one-history-step, no Legend-specific editing
 * code). Only ever meaningful as a direct child of a real `<fieldset>` —
 * enforced centrally by insertionRules.ts's canParentAcceptChild (see its
 * own CONSTRAINED_CHILD_EXTRA_PARENTS), never by this component or by any
 * drag/drop-local check.
 */
export function LegendElement({ node, parentId, parentLayoutMode, parentFlowDisplay }: DocumentElementProps) {
  const dropRef = useNodeDropRegistration(node);
  const { setNodeRef: dragRef, listeners, isDragging } = useNodeDragSource(node, parentLayoutMode);
  const editable = useEditableText(node);
  const isPreview = useEditorStore((state) => state.editorMode === "preview");
  const recipe = resolveTextElementStyle(node, { parentLayoutMode, parentFlowDisplay, isPreview });

  return (
    <legend
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
    </legend>
  );
}
