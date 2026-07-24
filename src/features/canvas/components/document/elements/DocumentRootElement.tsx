"use client";

import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

/**
 * Root of the document tree (tag "page"). Carries no visual identity of
 * its own — the page chrome (sheet, shadow, rounded corners) belongs to
 * DocumentCanvas — and it's intentionally neither selectable (see
 * CanvasInteractionBoundary) nor draggable (the document root can never
 * be moved; no useNodeDragSource here, unlike every other container). It
 * remains a valid drop target though: it's the "primary page container"
 * default-insertion falls back to when no more specific target applies.
 */
export function DocumentRootElement({ node, parentId, children }: DocumentElementProps) {
  const setNodeRef = useNodeDropRegistration(node);

  return (
    <div ref={setNodeRef} {...documentNodeAttributes(node, parentId)} className="flex flex-col">
      {children}
    </div>
  );
}
