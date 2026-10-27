// Public API of the canvas feature (EXPORT-1.2): the framework-independent
// design rules that decide how an authored document node looks — default
// presentations and per-element style recipes — shared by the Canvas
// renderer and HTML/CSS export. Only pure modules are re-exported here, never
// React components, so a consumer such as the export generator stays free of
// React, the DOM and editor runtime state.
export {
  DOCUMENT_DEFAULT_STYLE_IDS,
  DOCUMENT_DEFAULT_STYLES,
  DOCUMENT_SANS_FONT_STACK,
  getDocumentDefaultStyle,
  type DocumentDefaultStyleId,
} from "@/features/canvas/utils/documentDefaultStyles";
export type { CssDeclaration, DocumentDefaultStyle } from "@/features/canvas/types/documentDefaultStyle";
export {
  resolveAudioElementStyle,
  resolveBoxElementStyle,
  resolveContainerElementStyle,
  resolveControlElementStyle,
  resolveDialogElementStyle,
  resolveImageElementStyle,
  resolveLegacyBodyElementStyle,
  resolveOptionElementStyle,
  resolvePageRootElementStyle,
  resolveSvgElementStyle,
  resolveTableCellElementStyle,
  resolveTableStructureElementStyle,
  resolveTextElementStyle,
  resolveVideoOrIframeElementStyle,
} from "@/features/canvas/utils/elementStyleRecipes";
export type {
  ElementStyleContext,
  ElementStyleRecipe,
  MediaElementStyleRecipe,
} from "@/features/canvas/types/elementStyleRecipe";
export {
  resolveDialogAccessibleDescription,
  resolveDialogAccessibleName,
} from "@/features/canvas/utils/resolveDialogAccessibleName";
