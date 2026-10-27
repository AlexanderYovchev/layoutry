"use client";

import { useNodeDragSource } from "@/features/canvas/hooks/useNodeDragSource";
import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { documentDefaultClasses } from "@/features/canvas/utils/documentDefaultStyles";
import { resolveLegacyBodyElementStyle } from "@/features/canvas/utils/elementStyleRecipes";
import { cn, mergeRefs } from "@/lib/utils";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

export function BodyElement({ node, parentId, children }: DocumentElementProps) {
  const dropRef = useNodeDropRegistration(node);
  const { setNodeRef: dragRef, listeners, isDragging } = useNodeDragSource(node);

  return (
    <div
      ref={mergeRefs(dropRef, dragRef)}
      {...documentNodeAttributes(node, parentId)}
      className={cn(documentDefaultClasses(resolveLegacyBodyElementStyle().defaults), isDragging && "opacity-40")}
      {...listeners}
    >
      {children}
    </div>
  );
}
