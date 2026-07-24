"use client";

import { useContainerDropTarget } from "@/features/canvas/hooks/useContainerDropTarget";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { DROP_TARGET_ACTIVE_CLASSES } from "@/features/canvas/utils/dropTargetVisuals";
import { cn } from "@/lib/utils";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

/**
 * Root of the document tree (tag "page"). Carries no visual identity of
 * its own beyond drop feedback — the page chrome (sheet, shadow, rounded
 * corners) belongs to DocumentCanvas, and it's intentionally not
 * selectable (see CanvasInteractionBoundary). It is a valid insertion
 * target though: it's the "primary page container" default-insertion
 * falls back to when no more specific target applies.
 */
export function DocumentRootElement({ node, parentId, children }: DocumentElementProps) {
  const { setNodeRef, isDropActive } = useContainerDropTarget(node);

  return (
    <div
      ref={setNodeRef}
      {...documentNodeAttributes(node, parentId)}
      className={cn("flex flex-col transition-colors", isDropActive && DROP_TARGET_ACTIVE_CLASSES)}
    >
      {children}
    </div>
  );
}
