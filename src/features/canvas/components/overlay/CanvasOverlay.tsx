"use client";

import type { RefObject } from "react";
import { DropIndicatorOverlay } from "@/features/canvas/components/overlay/DropIndicatorOverlay";
import { FormGuideOverlay } from "@/features/canvas/components/overlay/FormGuideOverlay";
import { HoverOverlay } from "@/features/canvas/components/overlay/HoverOverlay";
import { MediaGuideOverlay } from "@/features/canvas/components/overlay/MediaGuideOverlay";
import { SelectionOverlay } from "@/features/canvas/components/overlay/SelectionOverlay";
import { useActiveDropIndicator } from "@/features/canvas/hooks/useActiveDropIndicator";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { useSelectedNodes } from "@/features/editor/hooks/useSelectedNode";
import { isStyleProtected } from "@/features/editor/rules/styleProtection";

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
 * FormGuideOverlay (Checkpoint 1.12.1) and MediaGuideOverlay (Checkpoint
 * 1.15) both render unconditionally, unlike Hover/Selection — every Form
 * needs to read as a drop target while dragging (not just while
 * selected), and every sourceless Video/Iframe needs its "Add a source
 * URL" hint visible regardless of selection.
 */
export function CanvasOverlay({ canvasRootRef, hoveredNodeId }: CanvasOverlayProps) {
  const { nodes: selectedNodes, primary } = useSelectedNodes();
  const documentModel = useEditorStore((state) => state.document);
  const activeDropIndicator = useActiveDropIndicator();
  const showHover =
    hoveredNodeId !== null && hoveredNodeId !== primary?.node.id && !activeDropIndicator;
  // Checkpoint 1.15.2, Part 14 — resize handles only ever render for a
  // genuine single selection; a multi-selection's own outlines are pure
  // visual feedback (see SelectionOverlay's own doc comment for why).
  // Checkpoint 1.15.3, section 28 — also hidden entirely (not merely
  // disabled) for a single selection that's itself style-protected, since
  // resize is a CSS-authoring interaction; the store's own resizeElement/
  // setFreeChildGeometry(Live) guards are the real enforcement (section 29),
  // this only keeps the handles from being shown-but-inert.
  // Checkpoint 1.15.6, section 22 — also hidden while the selected SVG is
  // in Drawing Mode: the outer rectangular handles are an HTML-resize
  // concern, and while editing inside the SVG its own vector-object resize
  // handles (rendered by SvgElement itself) take over that role instead.
  const svgEditingNodeId = useEditorStore((state) => state.svgEditingNodeId);
  const showHandles =
    selectedNodes.length === 1 &&
    selectedNodes[0].node.id !== svgEditingNodeId &&
    !isStyleProtected(documentModel, selectedNodes[0].node.id);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <FormGuideOverlay canvasRootRef={canvasRootRef} />
      <MediaGuideOverlay canvasRootRef={canvasRootRef} />
      {showHover && (
        <HoverOverlay canvasRootRef={canvasRootRef} nodeId={hoveredNodeId} />
      )}
      {!activeDropIndicator &&
        selectedNodes.map((selected) => (
          <SelectionOverlay
            key={selected.node.id}
            canvasRootRef={canvasRootRef}
            node={selected.node}
            parentLayoutMode={selected.parentLayoutMode}
            isPrimary={selected.node.id === primary?.node.id}
            showHandles={showHandles}
          />
        ))}
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
