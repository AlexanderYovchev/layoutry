"use client";

import { CanvasInteractionBoundary } from "@/features/canvas/components/CanvasInteractionBoundary";
import { documentDefaultClasses } from "@/features/canvas/utils/documentDefaultStyles";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";

/**
 * The page sheet: a fixed-identity "desktop page" artboard rendered from
 * the editor's document model. Width is capped at 1440px but yields to
 * the available workspace width so the canvas never forces horizontal
 * scrolling; height grows with content and the Workspace region (which
 * owns overflow) scrolls it.
 *
 * `data-document-surface` marks the boundary between editor chrome and
 * the user's document (UI-1.4.1): Tailwind's `dark:` variant never
 * applies on or inside it (see globals.css), and the sheet sets the
 * document's own theme-independent baseline — white background, the
 * default sans stack, zinc-950 text, and a light color-scheme so native
 * form controls and scrollbars inside the page never follow the editor
 * theme. The border and shadow are the editor's frame around the page,
 * so they do follow the theme. Editor-only: the attribute lives on this
 * DOM wrapper, never in the document model, so it can't reach export.
 */
export function DocumentCanvas() {
  const document = useEditorStore((state) => state.document);

  return (
    <div
      data-document-surface=""
      // Sheet chrome (shadow, border, rounding, presentation width/height)
      // first; the page's own surface (background, font, text color, color
      // scheme) comes from the shared defaults HTML/CSS export also emits.
      className={`animate-fade-in-up border-line shadow-page relative min-h-500 w-full max-w-360 shrink-0 rounded-md border ${documentDefaultClasses(["page-surface"])}`}
    >
      <CanvasInteractionBoundary document={document} />
    </div>
  );
}
