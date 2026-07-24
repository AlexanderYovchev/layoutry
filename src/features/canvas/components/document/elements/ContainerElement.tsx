"use client";

import { useContainerDropTarget } from "@/features/canvas/hooks/useContainerDropTarget";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { DROP_TARGET_ACTIVE_CLASSES } from "@/features/canvas/utils/dropTargetVisuals";
import { cn } from "@/lib/utils";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

export function ContainerElement({
  node,
  parentId,
  children,
}: DocumentElementProps) {
  const { setNodeRef, isDropActive } = useContainerDropTarget(node);

  return (
    <div
      ref={setNodeRef}
      {...documentNodeAttributes(node, parentId)}
      className={cn(
        "flex flex-col items-start gap-4 rounded-lg border border-zinc-100 p-8 transition-colors dark:border-zinc-900",
        isDropActive && DROP_TARGET_ACTIVE_CLASSES,
      )}
    >
      {children}
    </div>
  );
}
