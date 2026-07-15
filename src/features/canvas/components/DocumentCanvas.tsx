"use client";

import { CanvasInteractionBoundary } from "@/features/canvas/components/CanvasInteractionBoundary";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";

/**
 * The page sheet: a fixed-identity "desktop page" artboard rendered from
 * the editor's document model. Width is capped at 1440px but yields to
 * the available workspace width so the canvas never forces horizontal
 * scrolling; height grows with content and the Workspace region (which
 * owns overflow) scrolls it.
 */
export function DocumentCanvas() {
  const document = useEditorStore((state) => state.document);

  return (
    <div className="animate-fade-in-up relative min-h-500 w-full max-w-360 shrink-0 rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-black">
      <CanvasInteractionBoundary document={document} />
    </div>
  );
}
