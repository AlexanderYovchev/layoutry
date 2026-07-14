"use client";

import { ResizeHandle } from "@/components/ui/resizable/ResizeHandle";
import { useResizablePanelWidth } from "@/components/ui/resizable/useResizablePanelWidth";

const INSPECTOR_DEFAULT_WIDTH = 300;
const INSPECTOR_MIN_WIDTH = 260;
const INSPECTOR_MAX_WIDTH = 520;

export function InspectorPanel({ children }: { children: React.ReactNode }) {
  const {
    width,
    isDragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  } = useResizablePanelWidth({
    storageKey: "layoutry:inspector-panel-width",
    defaultWidth: INSPECTOR_DEFAULT_WIDTH,
    minWidth: INSPECTOR_MIN_WIDTH,
    maxWidth: INSPECTOR_MAX_WIDTH,
    growDirection: "left",
  });

  return (
    <aside
      aria-label="Inspector panel"
      style={{ width }}
      className="relative flex shrink-0 flex-col overflow-hidden border-l border-zinc-200 dark:border-zinc-800"
    >
      <ResizeHandle
        className="left-0"
        isDragging={isDragging}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
      {children}
    </aside>
  );
}
