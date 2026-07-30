"use client";

import { useNodeDragSource } from "@/features/canvas/hooks/useNodeDragSource";
import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { elementPositionStyle } from "@/features/canvas/utils/elementDimensionsStyle";
import { resolveBackgroundStyle } from "@/features/canvas/utils/resolveBackgroundStyle";
import { resolveFlexOrGridChildStyle } from "@/features/canvas/utils/resolveFlexOrGridChildStyle";
import { resolveFlowLayoutStyle } from "@/features/canvas/utils/resolveFlowLayoutStyle";
import { cn, mergeRefs } from "@/lib/utils";
import { getLayoutMode } from "@/features/editor/types/layout";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

export function ContainerElement({
  node,
  parentId,
  parentLayoutMode,
  parentFlowDisplay,
  children,
}: DocumentElementProps) {
  const dropRef = useNodeDropRegistration(node);
  const { setNodeRef: dragRef, listeners, isDragging } = useNodeDragSource(node, parentLayoutMode);

  const isFreeChild = parentLayoutMode === "free";
  const ownLayoutMode = getLayoutMode(node);
  // A Free child already renders position: absolute (see freeChildStyle),
  // which already qualifies it as a containing block for its own
  // absolutely-positioned Free children — position: relative is only
  // needed to establish that when this container isn't itself a Free
  // child (otherwise flow's default position: static would let its Free
  // children's left/top resolve against some ancestor further up instead
  // of this container).
  const hostsOwnFreeChildren = ownLayoutMode === "free" && !isFreeChild;

  // A node with no explicit flowLayout/spacing predates Checkpoint 3.5 —
  // the Tailwind classes below (originally this app's only container
  // presentation) are its fallback, kept byte-for-byte so nothing already
  // built or tested regresses. Once a container has an explicit
  // flowLayout (every newly created one — see elementFactories.ts) or
  // spacing, the data-driven inline styles below take over instead.
  const usesLegacyFlexClasses = !node.flowLayout;
  const usesLegacyPadding = !node.spacing;

  return (
    <div
      ref={mergeRefs(dropRef, dragRef)}
      {...documentNodeAttributes(node, parentId)}
      className={cn(
        "rounded-lg border border-zinc-100 dark:border-zinc-900",
        usesLegacyFlexClasses && "flex flex-col items-start gap-4",
        usesLegacyPadding && "p-8",
        isDragging && "opacity-40",
      )}
      style={{
        ...elementPositionStyle(node, parentLayoutMode),
        ...resolveFlexOrGridChildStyle(node, parentFlowDisplay),
        ...(ownLayoutMode === "flow" ? resolveFlowLayoutStyle(node) : undefined),
        ...(hostsOwnFreeChildren ? { position: "relative" } : {}),
        ...resolveBackgroundStyle(node),
      }}
      {...listeners}
    >
      {children}
    </div>
  );
}
