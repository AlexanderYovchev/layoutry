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
  /**
   * Whether Advanced Container Shapes (CSS `clip-path`, Checkpoint 1.15.4)
   * are meaningful on this tag — see resolveShapeStyle and
   * types/shape.ts's own top comment. Deliberately NOT the same
   * default-true / page-body-opt-out rule supportsBorder/
   * supportsBorderRadius/supportsBoxShadow share: this checkpoint's own
   * brief was explicit that Shape should start scoped to ordinary
   * container/layout primitives only (SHAPE_CAPABLE_TAGS below), not
   * every visual box — a text-bearing leaf (h1/p/button), a form control,
   * a media tag, or a table-structural tag was not called out as a real
   * user need, and several of them (table/select/option, media replaced
   * elements) have their own box-model ownership questions this
   * checkpoint's brief explicitly deferred. Defaults false; computed
   * directly in getElementCapabilities's own return object below (the
   * same "named tag Set checked inline" shape TEXT_BEARING_TAGS/
   * isHeadingTag already use), not via CAPABILITY_OVERRIDES.
   */
  supportsShape: boolean;
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
  /**
   * Whether this tag has SVG-specific settings (Primitive/ViewBox/Fill/
   * Stroke/Stroke Width) worth exposing in the Inspector (Checkpoint
   * 1.15.5 — see InspectorSvgSection and types/svg.ts). True only for
   * `svg`, the same narrow "own capability flag per semantic/foundation
   * Inspector section" precedent supportsHref/supportsHeadingLevel/
   * supportsFormControl already established. Deliberately independent of
   * supportsShape (Checkpoint 1.15.4's CSS clip-path presets) — an `svg`
   * node never joins SHAPE_CAPABLE_TAGS, and a Shape-capable container
   * never gets this flag; the two features never overlap on the same
   * tag.
   */
  supportsSvgSettings: boolean;
  /**
   * Whether the generic Layout section (Flow/Free, then Block/Flex/Grid —
   * see InspectorLayoutSection) is meaningful for this tag's OWN children
   * (Checkpoint 1.14). Deliberately separate from `canContainChildren`:
   * that flag answers "can this node hold document children at all,"
   * this one answers a genuinely different question — "does arranging
   * those children through Layoutry's Flow/Flex/Grid model make sense."
   * A Select's children are native `<option>`s and a Table's children
   * are native `<thead>/<tbody>/<tfoot>` sections governed by native
   * table layout — Block/Flex/Grid has no real effect on either (see
   * this checkpoint's own report, section J), so both opt out here
   * rather than showing a control with no real effect. Defaults true —
   * every existing container tag (div/section/ul/ol/form/label/the
   * semantic sectioning family) keeps showing this section exactly as
   * before; only the tags explicitly overridden below opt out.
   */
  supportsChildLayout: boolean;
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
  supportsShape: false,
  supportsFilters: true,
  supportsDisplay: true,
  supportsPosition: true,
  supportsAspectRatio: true,
  supportsHref: false,
  supportsHeadingLevel: false,
  supportsFormControl: false,
  supportsSvgSettings: false,
  supportsChildLayout: true,
};

/**
 * Tags whose own rendered content is literal text (see
 * EditorElementNode.text) — the Inspector's Typography section
 * (Checkpoint 4.2) only renders for these. Includes "a"/"li"/"blockquote",
 * which have no insertable factory yet (same forward-compatible pattern
 * insertionRules.ts's CONTAINER_TAGS already uses), so typography support
 * is already correct the moment a factory for one of them is added.
 */
const TEXT_BEARING_TAGS: ReadonlySet<string> = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "button", "a", "li", "blockquote", "th", "td", "legend"]);

/**
 * Tags eligible for Advanced Container Shapes (Checkpoint 1.15.4) —
 * ordinary layout/content-grouping containers only, per this checkpoint's
 * own explicit "Advanced CONTAINER Shapes" scoping (section 8 of its own
 * brief). Matches Checkpoint 1.15.3's canOwnStyleLock tag list exactly,
 * by design — both checkpoints independently arrived at the same "these
 * are the ordinary structural container primitives" set. Deliberately
 * excludes ul/ol (also rendered by ContainerElement, but not called out
 * by either checkpoint's own brief) — nothing prevents widening this Set
 * later; the underlying resolveShapeStyle/clip-path mechanism is already
 * tag-agnostic.
 */
const SHAPE_CAPABLE_TAGS: ReadonlySet<string> = new Set([
  "div",
  "section",
  "header",
  "nav",
  "main",
  "article",
  "aside",
  "footer",
  "form",
  "label",
]);

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
  /**
   * Video (Checkpoint 1.15) shares Image's exact override — a real
   * replaced element whose own content has an intrinsic ratio worth
   * resize-locking and whose visual presentation genuinely benefits from
   * object-fit/object-position, the same reasoning img already
   * established.
   */
  video: { supportsIntrinsicAspectRatio: true, supportsMediaFit: true },
  /**
   * Iframe deliberately does NOT get Image/Video's override (Checkpoint
   * 1.15 corrected a stale forward declaration here — this entry
   * previously granted supportsIntrinsicAspectRatio/supportsMediaFit,
   * copied speculatively from img/video before Iframe had a real factory
   * or renderer; see insertionRules.ts's own doc comment on this same
   * "forward declaration ahead of a real factory" pattern for "table").
   * An iframe's embedded document is not a replaced element the way
   * img/video are — object-fit/object-position have no effect on what an
   * iframe's own nested browsing context renders (the embedded page
   * reflows to fill the iframe's box; there is no "fit" concept to
   * apply), so exposing those controls would be shown-but-inert, not
   * genuinely useful. No override entry is needed at all: every other
   * capability the brief calls out as useful for Iframe (sizing/resize/
   * position/border/border-radius/box-shadow/filters/display/aspect-
   * ratio) is already exactly what DEFAULT_CAPABILITIES grants an
   * unlisted tag — see this checkpoint's own report, section L.
   */

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
   *
   * Deliberately NOT varied by inputType (Checkpoint 1.12 — checkbox/
   * radio share this exact same entry with every text-like variant):
   * getElementCapabilities only ever receives a tag, never a node, so
   * capabilities are architecturally tag-scoped, not inputType-scoped.
   * Native checkbox/radio styling IS genuinely less consistent across
   * browsers than a text field's (background/border/border-radius
   * render very differently, or are partly ignored, depending on the
   * browser's own default checkbox/radio appearance) — but introducing
   * an inputType-aware capability system would be a broad architectural
   * change for a real but secondary cosmetic concern, and nothing in
   * this checkpoint's scope requires it. Documented here as a known,
   * accepted browser-rendering limitation rather than worked around.
   */
  input: { supportsTypography: true, supportsBackground: true, supportsFormControl: true },

  /**
   * Textarea (Checkpoint 1.12) — the same reasoning and the same three
   * overrides as Input above: not a container, not in TEXT_BEARING_TAGS
   * (its content is node.value, not node.text), so it needs the same
   * explicit typography/background grant, plus supportsFormControl so
   * it receives the same Form Control Inspector section Input already
   * gets (Name/Placeholder/Default Value — no Type field, since Textarea
   * has no inputType concept at all).
   */
  textarea: { supportsTypography: true, supportsBackground: true, supportsFormControl: true },

  /**
   * Select (Checkpoint 1.13) — same three overrides as Input/Textarea
   * (not TEXT_BEARING_TAGS since its visible content comes from its
   * Option children, not node.text; canContainChildren is already true
   * via CONTAINER_TAGS membership, no override needed for that). Gets
   * supportsFormControl for the same "Form Control Inspector section"
   * reason Input/Textarea do, but that section renders only its Name
   * field for a select — see InspectorFormControlSection's own isSelect
   * branch; Placeholder/Default Value/Type/Checked are all meaningless
   * here and stay hidden.
   *
   * supportsChildLayout: false (Checkpoint 1.14) closes a known, accepted
   * edge case Checkpoint 1.13's own report explicitly deferred: a
   * Select's children are native `<option>`s, so Flow/Flex/Grid never had
   * any real effect on them, but InspectorLayoutSection still rendered
   * generically off the raw canContainChildren check until this flag
   * existed. Table's identical problem (see the table/thead/tbody/tfoot/
   * tr overrides below) needed the same fix, so this checkpoint closes
   * Select's version of it too as an incidental, same-mechanism fix
   * rather than leaving it open now that the flag exists — see this
   * checkpoint's own report for the explicit callout.
   */
  select: { supportsTypography: true, supportsBackground: true, supportsFormControl: true, supportsChildLayout: false },

  /**
   * Option (Checkpoint 1.13) — deliberately the most restricted override
   * in this table. An <option> has no rendered box at all outside an
   * open native <select> dropdown (browser-native behavior, not
   * something Layoutry controls), so every "applies to a box" capability
   * (border/border radius/box shadow/filters/display/position/aspect-
   * ratio-and-sizing) would control something with nothing visible to
   * apply to — left false/disabled here rather than shown-but-inert.
   * resizableX/Y are explicitly false for the same reason (no meaningful
   * box to attach a resize handle to — see this checkpoint's own report
   * on why Structure + the Option Inspector, not the Canvas, are the
   * reliable Option-authoring surfaces). typography/background are kept
   * true because real browsers DO genuinely (if inconsistently) respect
   * an <option>'s own color/background-color/font-weight inside their
   * native dropdown rendering — documented browser-styling limitation,
   * not a Layoutry gap.
   */
  option: {
    resizableX: false,
    resizableY: false,
    supportsTypography: true,
    supportsBackground: true,
    supportsBorder: false,
    supportsBorderRadius: false,
    supportsBoxShadow: false,
    supportsFilters: false,
    supportsDisplay: false,
    supportsPosition: false,
    supportsAspectRatio: false,
  },

  /**
   * Table (Checkpoint 1.14) — an ordinary box at the top of the
   * hierarchy: sizing/margin/position/border/border-radius/background/
   * box-shadow/overflow all stay at their DEFAULT_CAPABILITIES true, the
   * same "applies to a box regardless of what's inside it" reasoning
   * every other visual container already gets. Two explicit overrides:
   * supportsTypography (not TEXT_BEARING_TAGS — a table's own visible
   * content comes from its cells' node.text, not node.text on the table
   * itself — but a table-level font genuinely cascades into cells that
   * don't override it, the same reasoning Select/Input/Textarea's own
   * typography overrides already use) and supportsChildLayout: false —
   * see that flag's own doc comment for why Flow/Flex/Grid has no real
   * effect on a table's thead/tbody/tfoot children.
   */
  table: { supportsTypography: true, supportsChildLayout: false },

  /**
   * Thead/Tbody/Tfoot (Checkpoint 1.14) — structural row-grouping
   * containers, not independently resizable/positionable/sized: their
   * size and position are computed entirely by native table layout, not
   * something a resize handle or an explicit Width/Height/Position value
   * should fight (see this checkpoint's report, section J). supportsBorder
   * stays at its DEFAULT_CAPABILITIES true (a header/footer divider line
   * is a real, common table styling need); border-radius/box-shadow/
   * filters are left disabled — cosmetically odd on a row-group whose own
   * box is largely an implementation detail of the rows inside it, and
   * not called out as useful by this checkpoint's own capability audit.
   * supportsDisplay is disabled for a sharper reason than "not useful":
   * the Display control's own value set (block/inline/inline-block/none —
   * see types/display.ts) has no "table-header-group"/"table-row-group"/
   * "table-footer-group" option, so the only values actually offered
   * would silently break native table layout the moment one were applied
   * (Checkpoint 4.8 already reserves "flex"/"grid" for the same ownership
   * reason via Layout's own Display control — this is that same kind of
   * conflict, not a new pattern). supportsTypography is granted the same
   * way Table's own override is, for the same cascading reason.
   */
  thead: {
    resizableX: false,
    resizableY: false,
    supportsAspectRatio: false,
    supportsPosition: false,
    supportsDisplay: false,
    supportsBorderRadius: false,
    supportsBoxShadow: false,
    supportsFilters: false,
    supportsTypography: true,
    supportsChildLayout: false,
  },
  tbody: {
    resizableX: false,
    resizableY: false,
    supportsAspectRatio: false,
    supportsPosition: false,
    supportsDisplay: false,
    supportsBorderRadius: false,
    supportsBoxShadow: false,
    supportsFilters: false,
    supportsTypography: true,
    supportsChildLayout: false,
  },
  tfoot: {
    resizableX: false,
    resizableY: false,
    supportsAspectRatio: false,
    supportsPosition: false,
    supportsDisplay: false,
    supportsBorderRadius: false,
    supportsBoxShadow: false,
    supportsFilters: false,
    supportsTypography: true,
    supportsChildLayout: false,
  },

  /**
   * Tr (Checkpoint 1.14) — same restricted shape as Thead/Tbody/Tfoot
   * above and the same reasoning throughout (a row's size/position are
   * native-table-computed; "display: flex" on a `<tr>` is the exact
   * example this checkpoint's brief itself warns would "fundamentally
   * stop [it] behaving like a table row" — supportsDisplay stays
   * disabled for that reason, not merely "not useful"). supportsBorder
   * stays true (a per-row divider/highlight is a real, common table
   * styling need). supportsChildLayout is also false: a row's children
   * are native `<th>/<td>` cells laid out by native table row rules, not
   * Layoutry's Flow/Flex/Grid.
   */
  tr: {
    resizableX: false,
    resizableY: false,
    supportsAspectRatio: false,
    supportsPosition: false,
    supportsDisplay: false,
    supportsBorderRadius: false,
    supportsBoxShadow: false,
    supportsFilters: false,
    supportsTypography: true,
    supportsChildLayout: false,
  },

  /**
   * Th/Td (Checkpoint 1.14) — text-bearing leaves (see TEXT_BEARING_TAGS
   * above), so typography/background are already granted generically,
   * with no override needed for either — the exact same derivation List
   * Item's own zero-entry table row already relies on. Border/border-
   * radius/box-shadow/filters/sizing (the Size section) all stay at their
   * DEFAULT_CAPABILITIES true: a cell's own border, rounded corner, or
   * explicit width is a completely ordinary, common table-styling want
   * that doesn't touch the cell's own `display: table-cell`. Two explicit
   * overrides, both for the same "would silently break native table-cell
   * layout" reason Thead/Tbody/Tfoot/Tr's own supportsDisplay override
   * already documents: supportsDisplay (its block/inline/inline-block/
   * none value set includes no "table-cell" option — the same ownership
   * conflict, not a new pattern) and supportsPosition (an explicit
   * absolute/fixed position value computes `display: block` per the CSS
   * spec, pulling the cell out of the table's layout the same way
   * `display: block` itself would; there is no way to offer only
   * `relative` — the one position value that's actually safe here —
   * without a scoped-down control this checkpoint doesn't build).
   * resizableX/Y are also disabled: a Canvas drag-resize on one cell
   * can't move the rest of its column (no colgroup/shared-column-width
   * model exists yet — out of this checkpoint's scope), so a resize
   * handle here would silently look broken; the Inspector's own Size
   * section (still enabled) is the deliberate, explicit way to set a
   * cell's width/height instead.
   */
  th: {
    resizableX: false,
    resizableY: false,
    supportsDisplay: false,
    supportsPosition: false,
  },
  td: {
    resizableX: false,
    resizableY: false,
    supportsDisplay: false,
    supportsPosition: false,
  },

  /**
   * Svg (Checkpoint 1.15.5) — not a container (canContainChildren("svg")
   * is false) and not in TEXT_BEARING_TAGS (its visible output is vector
   * geometry, not node.text), so supportsBackground needs the same
   * explicit grant Input/Textarea/Select's own overrides already use —
   * section 21 of this checkpoint's own brief is explicit that ordinary
   * CSS background/border on the `<svg>` box itself must remain
   * available and stay a genuinely separate concept from SVG's own
   * fill/stroke (see resolveBackgroundStyle vs the real SVG presentation
   * attributes SvgElement applies). Every other capability this tag
   * needs (border/border-radius/box-shadow/filters/display/position/
   * aspect-ratio-and-sizing) is already exactly what DEFAULT_CAPABILITIES
   * grants an unlisted tag, the same "nothing else needs an override"
   * shape Iframe's own entry documents. supportsMediaFit intentionally
   * stays false (default) — SVG's own viewBox already governs internal
   * content fit; reusing Image/Video's object-fit model here would be a
   * second, conflicting sizing system (section 23 of this checkpoint's
   * own brief).
   */
  svg: { supportsBackground: true },

  /**
   * Dialog (Checkpoint 1.15.6.9) — a genuine native `<dialog>`, childable
   * (canContainChildren("dialog") is already true via CONTAINER_TAGS,
   * needing no override here) and background-capable via the same generic
   * container rule getElementCapabilities's own return object below
   * already grants every container tag, needing no explicit override
   * either. Two explicit, deliberate opt-outs, both to avoid a real
   * conflict this checkpoint's own audit found rather than a "not useful"
   * judgment call:
   *
   * supportsChildLayout: false — the same reasoning Table's own override
   * documents: this element's OWN box must never be handed Flow/Flex/Grid
   * arrangement authority (see DialogElement's own doc comment for why),
   * so the Inspector's generic Layout section — which would only ever
   * apply to the dialog's own children, never useful for a Modal
   * composition whose real content-arranging Container lives one level
   * deeper — stays hidden, exactly like Table/Select's own children being
   * native-layout-governed rather than Layoutry-governed.
   *
   * supportsDisplay: false — the genuinely narrow, checkpoint-specific
   * reason (not merely "not useful"): a native modal dialog's own open/
   * closed state is partly owned by the browser's own top-layer algorithm
   * (showModal()/close()), and letting an AUTHORED `display: none`
   * fight that — most browsers now force a `display: none` dialog out of
   * the top layer entirely, silently breaking `showModal()`'s own
   * subsequent calls — is exactly the "Critical Conflict" this
   * checkpoint's own brief calls out by name. Excluding the whole Display/
   * Visibility/Overflow/Interaction Inspector section for this one tag
   * avoids the entire conflict class by construction (the same minimal-
   * risk choice Option/Thead/Tbody/Tfoot/Tr/Th/Td's own supportsDisplay
   * overrides already make for their own, unrelated "would silently break
   * native layout" reasons) rather than attempting to detect/prevent the
   * conflict at runtime.
   *
   * Every other capability (Position/AspectRatio-and-Size/Border/
   * BorderRadius/BoxShadow/Filters) stays at DEFAULT_CAPABILITIES' true —
   * an ordinary box concern regardless of what's inside it or how it's
   * currently shown, the same reasoning Iframe/Svg/Table's own minimal
   * override entries already rely on. supportsShape and Style Protection
   * ownership (see SHAPE_CAPABLE_TAGS/canOwnStyleLock, both in separate
   * files) are deliberately NOT extended to "dialog" — a Modal
   * composition's own root (an ordinary div, per createModalNode) is
   * already the correct lock/shape owner, exactly like Dropdown's own
   * root, so this tag needs neither.
   */
  dialog: { supportsChildLayout: false, supportsDisplay: false },
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
    supportsShape: SHAPE_CAPABLE_TAGS.has(tag),
    supportsSvgSettings: tag === "svg",
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

/**
 * The capability set a MIXED selection can safely offer (Checkpoint
 * 1.15.2, Part G of its own report) — every boolean capability is true
 * only when EVERY selected tag's own capability is true (a logical AND
 * across the selection), so e.g. selecting a Paragraph and an Image never
 * shows Typography (Image alone already answers that false). This is the
 * single centralized place that intersection happens; no Inspector
 * section computes its own "are all selected tags text-bearing"-style
 * check — every one of them reads this same function's result instead
 * (see InspectorMultiNodeSummary). Throws on an empty `tags` array (there
 * is no meaningful "capabilities of zero elements") — callers only ever
 * invoke this once a real multi-selection exists.
 */
export function intersectElementCapabilities(tags: readonly string[]): ElementCapabilities {
  if (tags.length === 0) {
    throw new Error("intersectElementCapabilities requires at least one tag");
  }

  const perTag = tags.map((tag) => getElementCapabilities(tag));
  const result = { ...perTag[0] };
  for (const key of Object.keys(result) as (keyof ElementCapabilities)[]) {
    result[key] = perTag.every((capabilities) => capabilities[key] === true);
  }
  return result;
}
