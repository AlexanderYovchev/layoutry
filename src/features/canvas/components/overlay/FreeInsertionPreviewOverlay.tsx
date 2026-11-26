"use client";

import type { RefObject } from "react";
import { readOriginInset } from "@/features/canvas/components/overlay/FreeSnapGuideOverlay";
import { useMeasuredNodeRect } from "@/features/canvas/hooks/useMeasuredNodeRect";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { cn } from "@/lib/utils";

interface FreeInsertionPreviewOverlayProps {
  canvasRootRef: RefObject<HTMLElement | null>;
}

/**
 * BC-13.6 — where a Resource Panel component being dragged into a Free
 * container would land: a translucent, dashed outline of its proposed
 * border box (snapped and contained), labelled with the component's name.
 * Red when that container can't accept the component (nothing would be
 * inserted). Editor-only: inside CanvasOverlay (nothing in Preview, outside
 * the document surface, so never exported), pointer-events:none, drawn
 * under the alignment guides, and never a mounted component.
 */
export function FreeInsertionPreviewOverlay({ canvasRootRef }: FreeInsertionPreviewOverlayProps) {
  const preview = useEditorStore((state) => state.freeInsertionPreview);
  const containerRect = useMeasuredNodeRect(canvasRootRef, preview?.containerId ?? null, { trackScroll: true });
  if (!preview || !containerRect) return null;

  // The same local Free frame as the guides (padding-box origin, BC-13.2).
  const inset = readOriginInset(canvasRootRef, preview.containerId);
  const { rect } = preview;

  return (
    <div
      data-canvas-overlay="insertion-preview"
      data-valid={preview.valid ? "true" : "false"}
      className={cn(
        "pointer-events-none absolute rounded-xs border border-dashed",
        preview.valid ? "border-canvas-selection bg-canvas-selection/10" : "border-red-500 bg-red-500/10",
      )}
      style={{ left: containerRect.left + inset.left + rect.x, top: containerRect.top + inset.top + rect.y, width: rect.width, height: rect.height }}
    >
      <span
        className={cn(
          "absolute -top-5 left-0 rounded-sm px-1 py-px text-[10px] leading-none font-medium whitespace-nowrap text-white",
          preview.valid ? "bg-canvas-selection" : "bg-red-500",
        )}
      >
        {preview.valid ? preview.label : `${preview.label} can't go here`}
      </span>
    </div>
  );
}
