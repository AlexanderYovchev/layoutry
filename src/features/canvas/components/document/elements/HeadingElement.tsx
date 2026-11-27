"use client";

import { useEditableText } from "@/features/canvas/hooks/useEditableText";
import { useNodeDragSource } from "@/features/canvas/hooks/useNodeDragSource";
import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { useNodeStyle } from "@/features/canvas/hooks/useNodeStyle";
import { isHeadingTag } from "@/features/editor/types/heading";
import { cn, mergeRefs } from "@/lib/utils";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

export function HeadingElement({ node, parentId, parentLayoutMode, parentFlowDisplay }: DocumentElementProps) {
  const Tag = isHeadingTag(node.tag) ? node.tag : "h2";
  const dropRef = useNodeDropRegistration(node);
  const { setNodeRef: dragRef, listeners, isDragging } = useNodeDragSource(node, parentLayoutMode);
  const editable = useEditableText(node);
  const nodeStyle = useNodeStyle(node, parentLayoutMode, parentFlowDisplay);

  return (
    <Tag
      id={node.htmlId}
      ref={mergeRefs<HTMLElement>(dropRef, dragRef, editable.elementRef)}
      {...documentNodeAttributes(node, parentId)}
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
    </Tag>
  );
}
