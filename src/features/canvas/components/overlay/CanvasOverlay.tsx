"use client";

import type { RefObject } from "react";
import { DropIndicatorOverlay } from "@/features/canvas/components/overlay/DropIndicatorOverlay";
import { FormGuideOverlay } from "@/features/canvas/components/overlay/FormGuideOverlay";
import { HoverOverlay } from "@/features/canvas/components/overlay/HoverOverlay";
import { SelectionOverlay } from "@/features/canvas/components/overlay/SelectionOverlay";
import { useActiveDropIndicator } from "@/features/canvas/hooks/useActiveDropIndicator";
import { useSelectedNode } from "@/features/editor/hooks/useSelectedNode";

interface CanvasOverlayProps {
  canvasRootRef: RefObject<HTMLElement | null>;
  hoveredNodeId: string | null;
}

/**
 * Purely decorative layer sitting over the rendered document — never
 * intercepts pointer events, never exposed to assistive tech. Additive
 * home for future resize handles and alignment guides. Hover and
 * selection are suppressed while a drop indicator is active, so the
 * canvas never shows two competing highlights during a drag.
 *
 * FormGuideOverlay (Checkpoint 1.12.1) renders unconditionally, unlike
 * Hover/Selection — every Form on the canvas gets its boundary/badge, not
 * only the selected one, since an empty Form needs to read as a drop
 * target while dragging, not just while selected.
 */
export function CanvasOverlay({ canvasRootRef, hoveredNodeId }: CanvasOverlayProps) {
  const selected = useSelectedNode();
  const activeDropIndicator = useActiveDropIndicator();
  const showHover =
    hoveredNodeId !== null && hoveredNodeId !== selected?.node.id && !activeDropIndicator;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <FormGuideOverlay canvasRootRef={canvasRootRef} />
      {showHover && (
        <HoverOverlay canvasRootRef={canvasRootRef} nodeId={hoveredNodeId} />
      )}
      {selected && !activeDropIndicator && (
        <SelectionOverlay
          canvasRootRef={canvasRootRef}
          node={selected.node}
          parentLayoutMode={selected.parentLayoutMode}
        />
      )}
      {activeDropIndicator && (
        <DropIndicatorOverlay
          canvasRootRef={canvasRootRef}
          targetId={activeDropIndicator.targetId}
          zone={activeDropIndicator.zone}
        />
      )}
    </div>
  );
}
