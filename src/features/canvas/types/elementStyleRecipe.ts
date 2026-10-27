import type { CSSProperties } from "react";
import type { DocumentDefaultStyleId } from "@/features/canvas/utils/documentDefaultStyles";
import type { ContainerLayoutMode } from "@/features/editor/types/layout";
import type { FlowDisplayMode } from "@/features/editor/types/flowLayout";

/** Where a node sits, which decides part of its CSS — the same context DocumentNodeRenderer passes every element. */
export interface ElementStyleContext {
  parentLayoutMode: ContainerLayoutMode;
  parentFlowDisplay: FlowDisplayMode;
  /** Preview semantics (authored transitions, dialog positioning). Export always renders Preview semantics. */
  isPreview: boolean;
}

/**
 * A document element's complete authored appearance (EXPORT-1.2): which
 * default presentations apply, plus the inline style the Canvas sets.
 * `style` is a plain style object (React's CSSProperties shape is only a
 * type) — it carries no editor-only state such as drag opacity.
 */
export interface ElementStyleRecipe {
  defaults: DocumentDefaultStyleId[];
  style: CSSProperties;
}

/** Image/Video/Audio/Embed render an outer layout box around the genuine inner media element. */
export interface MediaElementStyleRecipe extends ElementStyleRecipe {
  innerStyle: CSSProperties;
}
