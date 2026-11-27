"use client";

import { useEditableText } from "@/features/canvas/hooks/useEditableText";
import { useNodeDragSource } from "@/features/canvas/hooks/useNodeDragSource";
import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { useNodeStyle } from "@/features/canvas/hooks/useNodeStyle";
import { resolveDerivedAccessibilityAttributes } from "@/features/editor/rules/accessibilityAttributes";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { PAGINATION_ROLE_LABELS } from "@/features/editor/types/pagination";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { cn, mergeRefs } from "@/lib/utils";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

export function ParagraphElement({ node, parentId, parentLayoutMode, parentFlowDisplay }: DocumentElementProps) {
  const dropRef = useNodeDropRegistration(node);
  const { setNodeRef: dragRef, listeners, isDragging } = useNodeDragSource(node, parentLayoutMode);
  const editable = useEditableText(node);
  const nodeStyle = useNodeStyle(node, parentLayoutMode, parentFlowDisplay);
  // BC-09.4: a Pagination ellipsis is decorative (aria-hidden), as in the export.
  // The cheap label check first, so ordinary paragraphs never look up their parent.
  const ariaHidden = useEditorStore((state) => {
    if (node.displayName !== PAGINATION_ROLE_LABELS.ellipsis || !parentId) return false;
    return resolveDerivedAccessibilityAttributes(node, findNodeById(state.document, parentId)).length > 0;
  });

  return (
    <p
      id={node.htmlId}
      ref={mergeRefs<HTMLElement>(dropRef, dragRef, editable.elementRef)}
      {...documentNodeAttributes(node, parentId)}
      {...(ariaHidden ? { "aria-hidden": true } : undefined)}
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
    </p>
  );
}
