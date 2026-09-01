"use client";

import type { RefObject } from "react";
import { ResizeOverlay } from "@/features/canvas/components/overlay/ResizeOverlay";
import { useMeasuredNodeRect } from "@/features/canvas/hooks/useMeasuredNodeRect";
import { getElementDisplayName } from "@/features/editor/utils/elementDisplayName";
import { cn } from "@/lib/utils";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { ContainerLayoutMode } from "@/features/editor/types/layout";

interface SelectionOverlayProps {
  canvasRootRef: RefObject<HTMLElement | null>;
  node: EditorElementNode;
  /** node's own parent's layoutMode — threaded through to ResizeOverlay (Checkpoint 3.4.4). Defaults to "flow". */
  parentLayoutMode?: ContainerLayoutMode;
  /** Whether this node is the multi-selection's own primary (Checkpoint 1.15.2) — the label and outline dim for a non-primary member of a multi-selection, matching the "distinguish selected vs. primary" requirement without a new color. Defaults true (a plain single selection is always its own primary). */
  isPrimary?: boolean;
  /**
   * Whether resize handles may render at all (Checkpoint 1.15.2, Part
   * 14) — false whenever more than one node is selected, so a multi-
   * selection never shows handles that would misleadingly suggest
   * resizing one member resizes the whole selection. True resize-handle
   * eligibility is still gated per-node by ResizeOverlay's own
   * canResizeElement check underneath this.
   */
  showHandles?: boolean;
}

const LABEL_HEIGHT_PX = 24;

export function SelectionOverlay({ canvasRootRef, node, parentLayoutMode = "flow", isPrimary = true, showHandles = true }: SelectionOverlayProps) {
  const rect = useMeasuredNodeRect(canvasRootRef, node.id);
  if (!rect) return null;

  const labelFitsAbove = rect.top >= LABEL_HEIGHT_PX;

  return (
    <div
      data-canvas-overlay="selection"
      className={cn("absolute rounded-xs outline-2 -outline-offset-1", isPrimary ? "outline-blue-500" : "outline-blue-300")}
      style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
    >
      {isPrimary && (
        <span
          className={cn(
            "absolute left-0 whitespace-nowrap rounded-md bg-blue-500 px-1.5 py-0.5 text-xs font-medium text-white shadow-sm",
            labelFitsAbove ? "-top-6" : "top-0",
          )}
        >
          {getElementDisplayName(node)}
        </span>
      )}
      {showHandles && (
        <ResizeOverlay node={node} rect={rect} canvasRootRef={canvasRootRef} parentLayoutMode={parentLayoutMode} />
      )}
    </div>
  );
}
