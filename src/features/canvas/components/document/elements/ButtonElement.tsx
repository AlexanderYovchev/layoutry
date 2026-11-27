"use client";

import { useEditableText } from "@/features/canvas/hooks/useEditableText";
import { useNodeDragSource } from "@/features/canvas/hooks/useNodeDragSource";
import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
import { usePreviewTriggerAria } from "@/features/canvas/hooks/usePreviewTriggerAria";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { useNodeStyle } from "@/features/canvas/hooks/useNodeStyle";
import { accessibilityProps } from "@/features/editor/rules/accessibilityAttributes";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { cn, mergeRefs } from "@/lib/utils";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

export function ButtonElement({ node, parentId, parentLayoutMode, parentFlowDisplay }: DocumentElementProps) {
  const dropRef = useNodeDropRegistration(node);
  const { setNodeRef: dragRef, listeners, isDragging } = useNodeDragSource(node, parentLayoutMode);
  const editable = useEditableText(node);
  const triggerAria = usePreviewTriggerAria(node);
  const isPreview = useEditorStore((state) => state.editorMode === "preview");
  const nodeStyle = useNodeStyle(node, parentLayoutMode, parentFlowDisplay);

  return (
    <button
      type="button"
      id={node.htmlId}
      ref={mergeRefs<HTMLElement>(dropRef, dragRef, editable.elementRef)}
      {...documentNodeAttributes(node, parentId)}
      {...accessibilityProps(node, { nativeDisabled: isPreview })}
      {...triggerAria}
      {...editable.editableProps}
      className={cn(
        nodeStyle.className,
        editable.isEditing && "outline-none",
        isDragging && "opacity-40",
        nodeStyle.authoredClassName,
      )}
      style={nodeStyle.style}
      {...nodeStyle.overrideAttributes}
      {...(editable.isEditing ? undefined : listeners)}
    >
      {node.text}
    </button>
  );
}
