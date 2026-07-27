"use client";

import { useNodeDragSource } from "@/features/canvas/hooks/useNodeDragSource";
import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { elementPositionStyle } from "@/features/canvas/utils/elementDimensionsStyle";
import { cn, mergeRefs } from "@/lib/utils";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

export function ParagraphElement({ node, parentId, parentLayoutMode }: DocumentElementProps) {
  const dropRef = useNodeDropRegistration(node);
  const { setNodeRef: dragRef, listeners, isDragging } = useNodeDragSource(node, parentLayoutMode);

  return (
    <p
      ref={mergeRefs(dropRef, dragRef)}
      {...documentNodeAttributes(node, parentId)}
      className={cn(
        "text-base leading-relaxed text-zinc-600 dark:text-zinc-400",
        // The 65ch reading-measure default only applies while the
        // paragraph sizes itself naturally — an explicit resize (which
        // sets an inline width) or a Free child's own inline width (which
        // is never "natural") must win over it, not silently get capped
        // back down to prose width by this class.
        parentLayoutMode !== "free" && !node.dimensions && "max-w-prose",
        isDragging && "opacity-40",
      )}
      style={elementPositionStyle(node, parentLayoutMode, { clipOverflowY: true })}
      {...listeners}
    >
      {node.text}
    </p>
  );
}
