import { canContainChildren } from "@/features/editor/rules/insertionRules";

/**
 * What a tag can do on the Canvas — the single source every selection,
 * resize, and future capability check reads from, instead of each
 * maintaining its own small hardcoded tag list. Adding a new element type
 * is one entry here (or accepting the defaults); nothing in the resize
 * engine, selection boundary, or overlays needs to change.
 */
export interface ElementCapabilities {
  selectable: boolean;
  resizableX: boolean;
  resizableY: boolean;
  canContainChildren: boolean;
  supportsIntrinsicAspectRatio: boolean;
}

const DEFAULT_CAPABILITIES: ElementCapabilities = {
  selectable: true,
  resizableX: true,
  resizableY: true,
  canContainChildren: false,
  supportsIntrinsicAspectRatio: false,
};

/**
 * Only the document root and the body wrapper opt out of selection and
 * resizing entirely — they're structural, not user-authored content, and
 * carry no visual identity a resize handle could attach to (see
 * DocumentRootElement/BodyElement). Every other tag is selectable and
 * resizable by default; containment and aspect-ratio are the only other
 * traits that vary per tag.
 */
const CAPABILITY_OVERRIDES: Record<string, Partial<ElementCapabilities>> = {
  page: { selectable: false, resizableX: false, resizableY: false },
  body: { selectable: false, resizableX: false, resizableY: false },

  img: { supportsIntrinsicAspectRatio: true },
  video: { supportsIntrinsicAspectRatio: true },
  iframe: { supportsIntrinsicAspectRatio: true },
};

export function getElementCapabilities(tag: string): ElementCapabilities {
  return {
    ...DEFAULT_CAPABILITIES,
    canContainChildren: canContainChildren(tag),
    ...CAPABILITY_OVERRIDES[tag],
  };
}

export function isSelectableElement(tag: string): boolean {
  return getElementCapabilities(tag).selectable;
}

export function canResizeElement(tag: string): boolean {
  const capabilities = getElementCapabilities(tag);
  return capabilities.resizableX || capabilities.resizableY;
}
