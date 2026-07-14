"use client";

import type { PointerEvent, ReactNode } from "react";
import { ResizeHandle } from "@/components/ui/resizable/ResizeHandle";

interface InspectorPanelProps {
  children: ReactNode;
  width: number;
  isDragging: boolean;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
}

export function InspectorPanel({
  children,
  width,
  isDragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: InspectorPanelProps) {
  return (
    <aside
      aria-label="Inspector panel"
      style={{ width }}
      className="relative flex shrink-0 flex-col overflow-hidden border-l border-zinc-200 dark:border-zinc-800"
    >
      <ResizeHandle
        className="left-0"
        isDragging={isDragging}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
      {children}
    </aside>
  );
}
