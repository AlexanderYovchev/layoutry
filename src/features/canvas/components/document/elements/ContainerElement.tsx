"use client";

import { useNodeDragSource } from "@/features/canvas/hooks/useNodeDragSource";
import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { elementPositionStyle } from "@/features/canvas/utils/elementDimensionsStyle";
import { cn, mergeRefs } from "@/lib/utils";
import { getLayoutMode } from "@/features/editor/types/layout";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

export function ContainerElement({
  node,
  parentId,
  parentLayoutMode,
  children,
}: DocumentElementProps) {
  const dropRef = useNodeDropRegistration(node);
  const { setNodeRef: dragRef, listeners, isDragging } = useNodeDragSource(node, parentLayoutMode);

  const isFreeChild = parentLayoutMode === "free";
  const style = elementPositionStyle(node, parentLayoutMode);
  // A Free child already renders position: absolute (see freeChildStyle),
  // which already qualifies it as a containing block for its own
  // absolutely-positioned Free children — position: relative is only
  // needed to establish that when this container isn't itself a Free
  // child (otherwise flow's default position: static would let its Free
  // children's left/top resolve against some ancestor further up instead
  // of this container).
  const hostsOwnFreeChildren = getLayoutMode(node) === "free" && !isFreeChild;

  return (
    <div
      ref={mergeRefs(dropRef, dragRef)}
      {...documentNodeAttributes(node, parentId)}
      className={cn(
        "flex flex-col items-start gap-4 rounded-lg border border-zinc-100 p-8 dark:border-zinc-900",
        isDragging && "opacity-40",
      )}
      style={hostsOwnFreeChildren ? { ...style, position: "relative" } : style}
      {...listeners}
    >
      {children}
    </div>
  );
}
