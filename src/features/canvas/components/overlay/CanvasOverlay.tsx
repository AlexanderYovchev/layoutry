"use client";

import type { RefObject } from "react";
import { HoverOverlay } from "@/features/canvas/components/overlay/HoverOverlay";
import { SelectionOverlay } from "@/features/canvas/components/overlay/SelectionOverlay";
import { useSelectedNode } from "@/features/editor/hooks/useSelectedNode";

interface CanvasOverlayProps {
  canvasRootRef: RefObject<HTMLElement | null>;
  hoveredNodeId: string | null;
}

/**
 * Purely decorative layer sitting over the rendered document — never
 * intercepts pointer events, never exposed to assistive tech. Additive
 * home for future resize handles, drag previews, and alignment guides;
 * only selection and hover exist this checkpoint.
 */
export function CanvasOverlay({ canvasRootRef, hoveredNodeId }: CanvasOverlayProps) {
  const selected = useSelectedNode();
  const showHover = hoveredNodeId !== null && hoveredNodeId !== selected?.node.id;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {showHover && (
        <HoverOverlay canvasRootRef={canvasRootRef} nodeId={hoveredNodeId} />
      )}
      {selected && (
        <SelectionOverlay canvasRootRef={canvasRootRef} node={selected.node} />
      )}
    </div>
  );
}
