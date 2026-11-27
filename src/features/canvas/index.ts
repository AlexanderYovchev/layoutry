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
// BC-17.3: the shared stylesheet compiler — pure, so the export uses the very same
// recipe dispatch, value validation and rule compilation as the Canvas.
export { compileBaseDeclarations, compileNodeStyle, validatedDeclarations, type CompileNodeStyleInput } from "@/features/canvas/styling/compileNodeStyle";
export { resolveNodeStyleRecipe, hasInnerMediaElement, type NodeStyleRecipe } from "@/features/canvas/styling/resolveNodeStyleRecipe";
export { printKeyframes, printSelector, printStyleRule, ruleOrderKey } from "@/features/canvas/styling/printStyleRules";
export { compileKeyframes, type CompiledKeyframes } from "@/features/canvas/styling/compileKeyframes";
export { referencedKeyframes } from "@/features/canvas/styling/keyframes";
export { STYLE_BUCKET, type NodeStyleIR, type StyleDiagnostic, type StyleIrRule } from "@/features/canvas/styling/styleIr";
export type { GroupDeclarationContext } from "@/features/canvas/styling/groupDeclarations";
