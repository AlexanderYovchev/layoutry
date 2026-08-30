import { canContainChildren } from "@/features/editor/rules/insertionRules";
import { isHeadingTag } from "@/features/editor/types/heading";

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
  /** Whether a Free-child corner resize defaults to preserving this tag's own width:height ratio (see useFreeChildResizeSession) — a resize-*interaction* concern only. Deliberately separate from supportsMediaFit (Checkpoint 5.6 split this out — see that flag's own doc comment): "this tag has an intrinsic ratio worth locking while resizing" and "this tag's rendered content supports object-fit/object-position" are genuinely different questions, even though every current media tag (img/video/iframe) happens to answer both the same way today. */
  supportsIntrinsicAspectRatio: boolean;
  /**
   * Whether CSS object-fit/object-position are meaningful on this tag
   * (Checkpoint 5.6) — true only for a *replaced element* whose own
   * rendered content can be fit/cropped/aligned within its box (img now;
   * video/iframe once those exist). Split out from
   * supportsIntrinsicAspectRatio (Checkpoint 3.5.1), which had
   * conflated two different concerns: the Media Inspector section's own
   * visibility, and the default Free-resize corner-lock behavior. The two
   * flags currently co-occur for every existing media tag, but are
   * architecturally independent — a future replaced element could in
   * principle need one without the other (e.g. an intrinsic-ratio
   * element whose content isn't a fittable replaced element, or a
   * fittable element with no natural ratio worth resize-locking).
   */
  supportsMediaFit: boolean;
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
  /** Whether display/visibility/overflow/interaction CSS is meaningful on this tag (Checkpoint 4.8) — same "applies to a box regardless of what's inside it" reasoning as supportsBorder/supportsBoxShadow/supportsFilters, so it shares their exact default-true / page-body-opt-out rule. */
  supportsDisplay: boolean;
  /** Whether CSS `position` is meaningful on this tag (Checkpoint 5.1) — same default-true / page-body-opt-out rule as supportsDisplay. This is a per-*tag* capability only; a per-*node* exception also exists (a Free-layout child or a Free-hosting container never shows the Position section regardless of tag, since Free layout already owns `position` on those specific nodes — see InspectorNodeSummary and types/position.ts's own doc comment). */
  supportsPosition: boolean;
  /**
   * Whether CSS `aspect-ratio` is meaningful on this tag (Checkpoint
   * 5.5) — same default-true / page-body-opt-out rule as supportsDisplay/
   * supportsPosition: aspect-ratio is a box-sizing constraint that
   * applies to a box regardless of what's inside it, the same reasoning
   * those two already use. Deliberately a *separate* flag from
   * supportsIntrinsicAspectRatio, which governs a different, pre-existing
   * concern (default Free-resize corner-lock behavior and the Media
   * section's own visibility) — see EditorElementNode.aspectRatio's own
   * doc comment for the full distinction. Media tags (img/video/iframe)
   * get both flags true; they are not mutually exclusive.
   *
   * Checkpoint 5.7 widened this flag's role: it now also gates the
   * entire consolidated Inspector "Size" section (Width/Height/Min/Max/
   * Aspect Ratio/Resize Proportions — see InspectorSizeSection), not just
   * the Aspect Ratio control alone. No new flag was introduced for this —
   * Width/Height/Min/Max are exactly the same category of "box-sizing
   * constraint that applies regardless of content" this flag already
   * represents, and every existing tag already answers both questions
   * identically, so a separate `supportsSizing` flag would only have
   * been a same-truth-table synonym (unlike the genuine
   * supportsIntrinsicAspectRatio/supportsMediaFit split in 5.5/5.6, which
   * existed because those two questions had actually come apart).
   */
  supportsAspectRatio: boolean;
  /** Whether this tag has a link destination worth exposing in the Inspector (Checkpoint 1.4 — see InspectorLinkSection and types/link.ts). True only for `a`; not a text-bearing-tag default, since most text-bearing tags (h1, p, button) have no href concept at all. */
  supportsHref: boolean;
  /** Whether this tag has a semantic Heading level worth exposing in the Inspector (Checkpoint 1.7 — see InspectorHeadingLevelSection and types/heading.ts). True only for h1–h6; deliberately a separate flag from supportsTypography, which every text-bearing tag (including button/a, neither of which has a "level") already gets. */
  supportsHeadingLevel: boolean;
  /** Whether this tag has form-control semantics (Name/Placeholder/Default Value) worth exposing in the Inspector (Checkpoint 1.10 — see InspectorFormControlSection). True only for `input`; the same "own capability flag per semantic Inspector section" precedent supportsHref/supportsHeadingLevel already established, rather than an inline tag comparison in InspectorNodeSummary. */
  supportsFormControl: boolean;
}

/**
 * node.aspectRatioLocked if explicitly set, else the tag's own default
 * (see EditorElementNode.aspectRatioLocked's own doc comment) — the pure
 * "effective value" resolution shared by both the live Free-resize
 * session (useFreeChildResizeSession, which additionally needs a
 * store/DOM node lookup this function itself doesn't do) and the
 * Inspector's Resize Proportions control (Checkpoint 5.7), so the two
 * can never disagree about what "the current lock state" actually is.
 */
export function getEffectiveAspectRatioLocked(node: { aspectRatioLocked?: boolean; tag: string }): boolean {
  if (node.aspectRatioLocked !== undefined) return node.aspectRatioLocked;
  return getElementCapabilities(node.tag).supportsIntrinsicAspectRatio;
}

const DEFAULT_CAPABILITIES: ElementCapabilities = {
  selectable: true,
  resizableX: true,
  resizableY: true,
  canContainChildren: false,
  supportsIntrinsicAspectRatio: false,
  supportsMediaFit: false,
  supportsTypography: false,
  supportsBackground: false,
  supportsBorder: true,
  supportsBorderRadius: true,
  supportsBoxShadow: true,
  supportsFilters: true,
  supportsDisplay: true,
  supportsPosition: true,
  supportsAspectRatio: true,
  supportsHref: false,
  supportsHeadingLevel: false,
  supportsFormControl: false,
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
  page: { selectable: false, resizableX: false, resizableY: false, supportsBorder: false, supportsBorderRadius: false, supportsBoxShadow: false, supportsFilters: false, supportsDisplay: false, supportsPosition: false, supportsAspectRatio: false },
  body: { selectable: false, resizableX: false, resizableY: false, supportsBorder: false, supportsBorderRadius: false, supportsBoxShadow: false, supportsFilters: false, supportsDisplay: false, supportsPosition: false, supportsAspectRatio: false },

  img: { supportsIntrinsicAspectRatio: true, supportsMediaFit: true },
  video: { supportsIntrinsicAspectRatio: true, supportsMediaFit: true },
  iframe: { supportsIntrinsicAspectRatio: true, supportsMediaFit: true },

  a: { supportsHref: true },

  /**
   * Input (Checkpoint 1.10) is neither a container nor in
   * TEXT_BEARING_TAGS (its visible text comes from node.value/
   * node.placeholder, not node.text — see types/input.ts), so it needs
   * an explicit override rather than qualifying for supportsTypography/
   * supportsBackground through either generic rule. Everything else it
   * needs (border/border radius/box shadow/filters/display/position/
   * aspect-ratio-and-sizing) is already true via DEFAULT_CAPABILITIES,
   * the same "applies to a box regardless of what's inside it" reasoning
   * every other visual tag already gets.
   */
  input: { supportsTypography: true, supportsBackground: true, supportsFormControl: true },
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
    supportsHeadingLevel: isHeadingTag(tag),
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
