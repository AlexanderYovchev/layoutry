"use client";

import { useNodeDragSource } from "@/features/canvas/hooks/useNodeDragSource";
import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { elementDimensionsStyle } from "@/features/canvas/utils/elementDimensionsStyle";
import { cn, mergeRefs } from "@/lib/utils";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

const HEADING_TAGS = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;
type HeadingTag = (typeof HEADING_TAGS)[number];

function isHeadingTag(tag: string): tag is HeadingTag {
  return (HEADING_TAGS as readonly string[]).includes(tag);
}

export function HeadingElement({ node, parentId }: DocumentElementProps) {
  const Tag = isHeadingTag(node.tag) ? node.tag : "h2";
  const dropRef = useNodeDropRegistration(node);
  const { setNodeRef: dragRef, listeners, isDragging } = useNodeDragSource(node);

  return (
    <Tag
      ref={mergeRefs(dropRef, dragRef)}
      {...documentNodeAttributes(node, parentId)}
      className={cn(
        "text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50",
        isDragging && "opacity-40",
      )}
      style={elementDimensionsStyle(node.dimensions, { clipOverflowY: true })}
      {...listeners}
    >
      {node.text}
    </Tag>
  );
}
