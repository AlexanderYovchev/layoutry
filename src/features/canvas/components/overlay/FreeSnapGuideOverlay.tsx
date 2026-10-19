"use client";

import type { RefObject } from "react";
import { useMeasuredNodeRect } from "@/features/canvas/hooks/useMeasuredNodeRect";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";

interface FreeSnapGuideOverlayProps {
  canvasRootRef: RefObject<HTMLElement | null>;
}

function readPaddingInset(canvasRootRef: RefObject<HTMLElement | null>, containerId: string): { left: number; top: number } {
  const containerEl = canvasRootRef.current?.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(containerId)}"]`);
  if (!containerEl) return { left: 0, top: 0 };
  const style = getComputedStyle(containerEl);
  return { left: parseFloat(style.paddingLeft) || 0, top: parseFloat(style.paddingTop) || 0 };
}

/**
 * Lightweight temporary Free-layout Snap guides (Checkpoint 1.15.6.1.1,
 * sections 17-19) — a single vertical and/or horizontal line, visible
 * only for the duration of an active snapped drag, matching this
 * checkpoint's own explicit scope: no rulers, no distance labels, no
 * persistent guides. Reads `activeSnapGuides` (see types/snap.ts) —
 * ephemeral editor/UI state, never document content, cleared the moment
 * the drag session itself clears it (pointer-up, Escape, or unmount —
 * see useFreeChildMoveSession).
 *
 * `activeSnapGuides.vertical/horizontal` are in the SAME coordinate space
 * as FreeLayoutGeometry.x/y — the Free container's own content box
 * (net of padding) — so this component converts to canvas-root-relative
 * screen coordinates itself, the same conversion every other overlay
 * (SelectionOverlay, ResizeOverlay) already performs via
 * useMeasuredNodeRect, plus one extra padding-inset step since
 * useMeasuredNodeRect measures the container's border box, not its
 * content box.
 */
export function FreeSnapGuideOverlay({ canvasRootRef }: FreeSnapGuideOverlayProps) {
  const guides = useEditorStore((state) => state.activeSnapGuides);
  const containerRect = useMeasuredNodeRect(canvasRootRef, guides?.containerId ?? null);

  if (!guides || !containerRect) return null;

  const inset = readPaddingInset(canvasRootRef, guides.containerId);

  return (
    <>
      {guides.vertical !== undefined && (
        <div
          data-canvas-overlay="snap-guide-vertical"
          className="absolute w-px bg-canvas-guide"
          style={{ left: containerRect.left + inset.left + guides.vertical, top: containerRect.top, height: containerRect.height }}
        />
      )}
      {guides.horizontal !== undefined && (
        <div
          data-canvas-overlay="snap-guide-horizontal"
          className="absolute h-px bg-canvas-guide"
          style={{ top: containerRect.top + inset.top + guides.horizontal, left: containerRect.left, width: containerRect.width }}
        />
      )}
    </>
  );
}
