"use client";

import type { RefObject } from "react";
import { FreeChildResizeHandles } from "@/features/canvas/components/overlay/FreeChildResizeHandles";
import { ResizeHandles } from "@/features/canvas/components/overlay/ResizeHandles";
import { canResizeElement } from "@/features/editor/rules/elementCapabilities";
import type { MeasuredNodeRect } from "@/features/canvas/hooks/useMeasuredNodeRect";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { ContainerLayoutMode } from "@/features/editor/types/layout";

interface ResizeOverlayProps {
  node: EditorElementNode;
  rect: MeasuredNodeRect;
  canvasRootRef: RefObject<HTMLElement | null>;
  /** node's own parent's layoutMode — decides Flow's ResizeHandles vs Free's FreeChildResizeHandles (Checkpoint 3.4.4). Defaults to "flow" for existing (pre-3.4.4) call sites. */
  parentLayoutMode?: ContainerLayoutMode;
}

/**
 * Gates and hosts the resize affordance for the current selection: renders
 * nothing for a non-resizable node (heading, paragraph, button, body, the
 * document root), otherwise fills the same box SelectionOverlay already
 * measured and positioned, so the handles only have to place themselves
 * relative to that box rather than re-deriving canvas coordinates. This is
 * also where future alignment guides and snap indicators are meant to
 * attach (see the milestone's overlay hierarchy), as siblings of the
 * handles inside the same positioned box.
 *
 * When the node's parent is a Free container, a Free child's x/y/width/
 * height (not a margin-anchored flow box) is what a west/north handle
 * actually moves — see FreeChildResizeHandles/useFreeChildResizeSession.
 * A Free child with no freeLayout yet (shouldn't normally happen — every
 * Free child gets one on insertion/conversion) falls back to Flow's
 * handles rather than rendering nothing.
 */
export function ResizeOverlay({ node, rect, canvasRootRef, parentLayoutMode = "flow" }: ResizeOverlayProps) {
  if (!canResizeElement(node.tag)) return null;

  if (parentLayoutMode === "free" && node.freeLayout) {
    return (
      <div className="absolute inset-0">
        <FreeChildResizeHandles nodeId={node.id} geometry={node.freeLayout} />
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      <ResizeHandles
        nodeId={node.id}
        rect={rect}
        offsetX={node.dimensions?.offsetX ?? 0}
        offsetY={node.dimensions?.offsetY ?? 0}
        canvasRootRef={canvasRootRef}
      />
    </div>
  );
}
