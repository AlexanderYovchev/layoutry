"use client";

import { useEditableText } from "@/features/canvas/hooks/useEditableText";
import { useNodeDragSource } from "@/features/canvas/hooks/useNodeDragSource";
import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { useNodeStyle } from "@/features/canvas/hooks/useNodeStyle";
import { cn, mergeRefs } from "@/lib/utils";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

/**
 * A genuine native `<caption>` (Checkpoint 1.15.6.12.2) — a text-bearing
 * leaf, the same shape ListItemElement/TableCellElement already use.
 * Never wrapped in a div: rendered directly as the table's own `<caption>`
 * child, exactly where native table layout expects it.
 *
 * resolveDisplayStyle/resolvePositionStyle are deliberately NOT imported at
 * all (supportsDisplay/supportsPosition are both false — see
 * elementCapabilities.ts's own caption override for why either would
 * silently pull it out of its native position relative to the table), and
 * resolveFlexOrGridChildStyle/parentFlowDisplay are not used either — the
 * exact same "only resolve what the tag's own capabilities actually grant,
 * and skip what native table layout already owns" precedent
 * TableCellElement's own doc comment establishes for th/td.
 */
export function CaptionElement({ node, parentId, parentLayoutMode }: DocumentElementProps) {
  const dropRef = useNodeDropRegistration(node);
  const { setNodeRef: dragRef, listeners, isDragging } = useNodeDragSource(node, parentLayoutMode);
  const editable = useEditableText(node);
  const nodeStyle = useNodeStyle(node, parentLayoutMode, "block");

  return (
    <caption
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
    </caption>
  );
}
