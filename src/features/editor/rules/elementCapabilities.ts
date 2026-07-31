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
  supportsTypography: boolean;
  supportsBackground: boolean;
  /** Whether a CSS border is meaningful on this tag (Checkpoint 4.4). Unlike Background — which excludes media tags because their own rendered content already fills the box — a border draws around the box's own edge regardless of what's inside it, so it defaults to true for nearly every tag; only the structural page/body wrappers opt out (see CAPABILITY_OVERRIDES), matching their own selectable/resizable overrides. */
  supportsBorder: boolean;
  /** Whether a CSS border radius is meaningful on this tag (Checkpoint 4.5) — a separate flag from supportsBorder (a radius can round a background/media box's corners with no border present at all), but the same "meaningful on nearly every visual box" reasoning applies, so it shares supportsBorder's exact default-true / page-body-opt-out rule. */
  supportsBorderRadius: boolean;
  /** Whether a CSS box shadow is meaningful on this tag (Checkpoint 4.6) — a shadow draws around a box's own edge regardless of what fills it, the same reasoning supportsBorder already uses (not supportsBackground's media-tag exclusion), so it shares supportsBorder/supportsBorderRadius's exact default-true / page-body-opt-out rule. */
  supportsBoxShadow: boolean;
  /** Whether CSS filters/opacity are meaningful on this tag (Checkpoint 4.7) — a filter/opacity affects a box's *entire* rendered output, including any media content inside it (unlike supportsBackground, which excludes media tags because their content already fills the box and a background would sit invisibly behind it — a filter has no such problem, since it applies on top of everything). Shares supportsBorder/supportsBorderRadius/supportsBoxShadow's exact default-true / page-body-opt-out rule. */
  supportsFilters: boolean;
}

const DEFAULT_CAPABILITIES: ElementCapabilities = {
  selectable: true,
  resizableX: true,
  resizableY: true,
  canContainChildren: false,
  supportsIntrinsicAspectRatio: false,
  supportsTypography: false,
  supportsBackground: false,
  supportsBorder: true,
  supportsBorderRadius: true,
  supportsBoxShadow: true,
  supportsFilters: true,
};

/**
 * Tags whose own rendered content is literal text (see
 * EditorElementNode.text) — the Inspector's Typography section
 * (Checkpoint 4.2) only renders for these. Includes "a"/"li"/"blockquote",
 * which have no insertable factory yet (same forward-compatible pattern
 * insertionRules.ts's CONTAINER_TAGS already uses), so typography support
 * is already correct the moment a factory for one of them is added.
 */
const TEXT_BEARING_TAGS: ReadonlySet<string> = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "button", "a", "li", "blockquote"]);

/**
 * Only the document root and the body wrapper opt out of selection and
 * resizing entirely — they're structural, not user-authored content, and
 * carry no visual identity a resize handle could attach to (see
 * DocumentRootElement/BodyElement). Every other tag is selectable and
 * resizable by default; containment and aspect-ratio are the only other
 * traits that vary per tag.
 */
const CAPABILITY_OVERRIDES: Record<string, Partial<ElementCapabilities>> = {
  page: { selectable: false, resizableX: false, resizableY: false, supportsBorder: false, supportsBorderRadius: false, supportsBoxShadow: false, supportsFilters: false },
  body: { selectable: false, resizableX: false, resizableY: false, supportsBorder: false, supportsBorderRadius: false, supportsBoxShadow: false, supportsFilters: false },

  img: { supportsIntrinsicAspectRatio: true },
  video: { supportsIntrinsicAspectRatio: true },
  iframe: { supportsIntrinsicAspectRatio: true },
};

export function getElementCapabilities(tag: string): ElementCapabilities {
  return {
    ...DEFAULT_CAPABILITIES,
    canContainChildren: canContainChildren(tag),
    supportsTypography: TEXT_BEARING_TAGS.has(tag),
    // Any container (div/section/ul/... ) or text-bearing tag (h1/p/button/...)
    // can meaningfully receive a CSS background — this is deliberately NOT
    // extended to img/video/iframe (Checkpoint 4.3): a media tag's own
    // rendered content (see resolveMediaFitStyle) already fills its box via
    // object-fit, so a background color/image would sit fully behind it and
    // never be visible — exposing those controls would be misleading, not
    // just unused. canContainChildren("img") and TEXT_BEARING_TAGS.has("img")
    // are already both false, so this already excludes media tags with no
    // override needed; CAPABILITY_OVERRIDES intentionally adds none for them.
    supportsBackground: canContainChildren(tag) || TEXT_BEARING_TAGS.has(tag),
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
