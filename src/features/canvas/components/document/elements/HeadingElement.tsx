"use client";

import { useEditableText } from "@/features/canvas/hooks/useEditableText";
import { useNodeDragSource } from "@/features/canvas/hooks/useNodeDragSource";
import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { documentDefaultClasses } from "@/features/canvas/utils/documentDefaultStyles";
import { resolveTextElementStyle } from "@/features/canvas/utils/elementStyleRecipes";
import { isHeadingTag } from "@/features/editor/types/heading";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { cn, mergeRefs } from "@/lib/utils";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

export function HeadingElement({ node, parentId, parentLayoutMode, parentFlowDisplay }: DocumentElementProps) {
  const Tag = isHeadingTag(node.tag) ? node.tag : "h2";
  const dropRef = useNodeDropRegistration(node);
  const { setNodeRef: dragRef, listeners, isDragging } = useNodeDragSource(node, parentLayoutMode);
  const editable = useEditableText(node);
  const isPreview = useEditorStore((state) => state.editorMode === "preview");
  const recipe = resolveTextElementStyle(node, { parentLayoutMode, parentFlowDisplay, isPreview });

  return (
    <Tag
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
    </Tag>
  );
}
