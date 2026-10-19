"use client";

import type { PointerEvent, ReactNode } from "react";
import { ResizeHandle } from "@/components/ui/resizable/ResizeHandle";

interface InspectorPanelProps {
  children: ReactNode;
  width: number;
  minWidth: number;
  maxWidth: number;
  isDragging: boolean;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
}

export function InspectorPanel({
  children,
  width,
  minWidth,
  maxWidth,
  isDragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: InspectorPanelProps) {
  return (
    // `width` includes the 8px outer gutter (pr-2), so the shell's width
    // budget (computeAppliedPanelWidths) is unchanged by the card layout.
    // overflow-hidden lives on the card, not the aside, so the resize
    // handle can sit in the gutter outside it.
    <aside
      aria-label="Inspector panel"
      style={{ width }}
      className="relative flex shrink-0 flex-col pr-2"
    >
      {/* Centered on the 8px gutter between the Workspace and this card (10px hit target, 1px line). */}
      <ResizeHandle
        aria-label="Resize Inspector Panel"
        valueNow={width}
        valueMin={minWidth}
        valueMax={maxWidth}
        className="-left-2.25"
        isDragging={isDragging}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
      <div className="rounded-surface border-line bg-surface-inspector shadow-panel flex min-h-0 flex-1 flex-col overflow-hidden border">
        {children}
      </div>
    </aside>
  );
}
