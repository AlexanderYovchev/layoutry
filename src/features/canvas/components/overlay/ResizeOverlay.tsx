"use client";

import type { RefObject } from "react";
import { ResizeHandles } from "@/features/canvas/components/overlay/ResizeHandles";
import { canResizeElement } from "@/features/editor/rules/resizeRules";
import type { MeasuredNodeRect } from "@/features/canvas/hooks/useMeasuredNodeRect";
import type { EditorElementNode } from "@/features/editor/types/document";

interface ResizeOverlayProps {
  node: EditorElementNode;
  rect: MeasuredNodeRect;
  canvasRootRef: RefObject<HTMLElement | null>;
}

/**
 * Gates and hosts the resize affordance for the current selection: renders
 * nothing for a non-resizable node (heading, paragraph, button, body, the
 * document root), otherwise fills the same box SelectionOverlay already
 * measured and positioned, so ResizeHandles only has to place itself
 * relative to that box rather than re-deriving canvas coordinates. This is
 * also where future alignment guides and snap indicators are meant to
 * attach (see the milestone's overlay hierarchy), as siblings of
 * ResizeHandles inside the same positioned box.
 */
export function ResizeOverlay({ node, rect, canvasRootRef }: ResizeOverlayProps) {
  if (!canResizeElement(node.tag)) return null;

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
