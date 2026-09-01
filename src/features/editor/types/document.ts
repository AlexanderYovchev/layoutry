import type {
  ChildResizePolicy,
  ContainerLayoutMode,
  FreeLayoutGeometry,
} from "@/features/editor/types/layout";
import type { FlexChildSettings, FlowLayoutSettings, GridChildSettings } from "@/features/editor/types/flowLayout";
import type { ElementSpacing } from "@/features/editor/types/spacing";
import type { MediaFitSettings } from "@/features/editor/types/mediaFit";
import type { TypographySettings } from "@/features/editor/types/typography";
import type { BackgroundSettings } from "@/features/editor/types/background";
import type { BorderSettings } from "@/features/editor/types/border";
import type { BorderRadiusSettings } from "@/features/editor/types/borderRadius";
import type { BoxShadowSettings } from "@/features/editor/types/boxShadow";
import type { FilterSettings } from "@/features/editor/types/filters";
import type { DisplaySettings } from "@/features/editor/types/display";
import type { PositionSettings } from "@/features/editor/types/position";
import type { AspectRatioValue } from "@/features/editor/types/aspectRatio";
import type { SizeConstraints } from "@/features/editor/types/sizeConstraints";
import type { InputType } from "@/features/editor/types/input";

export interface ElementDimensions {
  /**
   * The user's own resize intent in pixels — set once by a resize drag and
   * never silently rewritten afterward (in particular, never shrunk just
   * because a containing parent happens to be smaller right now; see
   * Checkpoint 3.4.3). What actually renders is this value clamped live,
   * in CSS, against the current containing block (elementDimensionsStyle's
   * maxWidth/maxHeight: "100%") — so the preferred size is preserved and
   * simply becomes visible again the moment the parent grows enough to
   * fit it, with no extra bookkeeping to "restore" anything.
   */
  preferredWidth: number;
  preferredHeight: number;
  /**
   * Pixel shift applied on top of the element's normal-flow position, via
   * marginLeft/marginTop (see elementDimensionsStyle). West/north-anchored
   * resizes need this: in normal flow, a box's top-left corner is wherever
   * the flow algorithm puts it, not an independently settable coordinate,
   * so growing `preferredWidth` alone can only ever extend the box's right
   * edge — there is no such thing as "move the left edge" without also
   * shifting where the box sits. Margin, specifically, not `transform`: a
   * transform only shifts where a box *paints*, never how much flow space
   * it *reserves*, so a sibling positioned after it would still be placed
   * using the box's raw (unshifted) height/width, drifting out of sync
   * with the box's own anchored edge — margin genuinely participates in
   * flow, so growing north/west by shrinking marginTop/marginLeft
   * correctly and simultaneously moves this box's edge *and* adjusts how
   * much space precedes it, keeping every sibling exactly where its own
   * flow position says it should be. 0/0 for an element resized only from
   * its east/south edges, which need no compensating shift.
   */
  offsetX: number;
  offsetY: number;
}

export interface EditorElementNode {
  id: string;
  /** Lowercase HTML tag name, or a virtual pseudo-tag such as "page" for the document root. */
  tag: string;
  /** Overrides the tag-based friendly name (e.g. a component's assigned label like "Primary Button"). */
  displayName?: string;
  /** Literal text content for text-bearing leaf nodes (e.g. headings, paragraphs, buttons). Unset for structural nodes. */
  text?: string;
  children?: EditorElementNode[];
  /** Explicit pixel size set via a resize interaction. Unset means the element still sizes itself naturally. Ignored (in favor of freeLayout) while this node is a direct child of a "free" layoutMode parent. */
  dimensions?: ElementDimensions;
  /**
   * This node's own children layout mode (Checkpoint 3.4.4) — "flow"
   * (normal document flow, the default when unset) or "free" (children
   * carry independent freeLayout geometry instead of participating in
   * flow). See getLayoutMode in types/layout.ts. Only meaningful when
   * this node can contain children.
   */
  layoutMode?: ContainerLayoutMode;
  /**
   * How this node's direct children respond when this node (a "free"
   * layoutMode container) is itself resized. Only meaningful alongside
   * layoutMode: "free"; unset means "scale" — see resolveChildResizePolicy.
   */
  childResizePolicy?: ChildResizePolicy;
  /**
   * This node's own position and size inside its parent's Free layout
   * space. Only meaningful while the node's parent has layoutMode:
   * "free" — a node's own `dimensions` is what applies otherwise. Set by
   * insertion, drag, resize, paste/duplicate placement, and Flow→Free
   * conversion; cleared on Free→Flow conversion.
   */
  freeLayout?: FreeLayoutGeometry;
  /**
   * Overrides the tag-based default aspect-ratio-lock behavior for corner
   * resizing and container-scale preservation. Unset resolves to
   * getElementCapabilities(tag).supportsIntrinsicAspectRatio (true for
   * img/video/iframe by default). NOT the CSS `aspect-ratio` property —
   * see `aspectRatio` below for that, and its own doc comment for the
   * full distinction between the two similarly-named fields.
   */
  aspectRatioLocked?: boolean;
  /**
   * This node's own children arrangement (Checkpoint 3.5) — block, flex,
   * or grid, plus that mode's settings. Only meaningful while the node
   * is Flow-mode (layoutMode !== "free"); retained (never cleared) while
   * temporarily switched to Free, so it reactivates unchanged on
   * returning to Flow. Unset entirely means "legacy" — see
   * resolveFlowLayoutStyle's fallback to this app's original hardcoded
   * flex-column rendering, which predates this field.
   */
  flowLayout?: FlowLayoutSettings;
  /** This node's own margin + padding (Checkpoint 3.5). Unset means zero on all sides — see getElementSpacing. Meaningful for any node, not just containers. */
  spacing?: ElementSpacing;
  /** This node's own flex-item properties. Only meaningful while its parent's flowLayout.display is "flex". */
  flexChild?: FlexChildSettings;
  /** This node's own grid-item placement. Only meaningful while its parent's flowLayout.display is "grid". */
  gridChild?: GridChildSettings;
  /** The media source URL (Checkpoint 3.5.1, widened to video in Checkpoint 1.15) — only meaningful for a media-capable tag (img, video). Unset renders an empty placeholder rather than a broken/missing image. Iframe deliberately reuses this exact same field for its own `src` (Checkpoint 1.15) — same "source of the embedded content" concern, no `iframeSrc` duplicate. */
  src?: string;
  /**
   * This node's own link destination (Checkpoint 1.4) — only meaningful
   * for a link-capable tag (see getElementCapabilities().supportsHref).
   * A single dedicated field, the same "one field per distinct semantic
   * concern" shape `src` above already established for Image, not a
   * generic HTML-attribute bag — see types/link.ts's own top comment for
   * why. Unset falls back to a safe placeholder (see getLinkHref) rather
   * than an absent href, so a Link node is always a real, focusable
   * anchor from the moment it's created.
   */
  href?: string;
  /** How this node's own visual content fits and aligns within its rendered box — object-fit/object-position (Checkpoint 3.5.1, restructured in Checkpoint 5.6) — only meaningful for a media-fit-capable tag (see getElementCapabilities().supportsMediaFit, a separate flag from supportsIntrinsicAspectRatio — see that flag's own doc comment). Each field (objectFit/objectPositionX/objectPositionY) is independently optional with no synthesized default stored here — see types/mediaFit.ts's own doc comment for the rendering-time fallback and the full distinction from `aspectRatio` below (aspect-ratio shapes the box itself; mediaFit shapes the content inside it — never merge the two). */
  mediaFit?: MediaFitSettings;
  /** This node's own text styling (Checkpoint 4.2) — only meaningful for a text-bearing tag (see getElementCapabilities().supportsTypography). Unlike mediaFit/spacing, unset fields here have no synthesized default; each is genuinely absent until explicitly set — see getTypographySettings and resolveTypographyStyle. */
  typography?: TypographySettings;
  /** This node's own background styling (Checkpoint 4.3) — only meaningful for a background-capable tag (see getElementCapabilities().supportsBackground). Like typography, unset fields here have no synthesized default — see getBackgroundSettings and resolveBackgroundStyle. */
  background?: BackgroundSettings;
  /** This node's own border styling (Checkpoint 4.4) — only meaningful for a border-capable tag (see getElementCapabilities().supportsBorder). Like typography/background, unset fields here have no synthesized default — see getBorderSettings and resolveBorderStyle. */
  border?: BorderSettings;
  /** This node's own border radius (Checkpoint 4.5) — only meaningful for a radius-capable tag (see getElementCapabilities().supportsBorderRadius). Independent of `border` — a radius can round a background/media box's corners with no border present at all. Unset corners have no synthesized default — see getBorderRadiusSettings and resolveBorderRadiusStyle. */
  borderRadius?: BorderRadiusSettings;
  /** This node's own stack of box-shadow layers (Checkpoint 4.6) — only meaningful for a shadow-capable tag (see getElementCapabilities().supportsBoxShadow). A list from day one (not a single-layer object) since real CSS box-shadow natively stacks multiple layers — see getBoxShadowLayers and resolveBoxShadowStyle. An empty/absent list renders no box-shadow CSS at all. */
  boxShadow?: BoxShadowSettings;
  /** This node's own visual effects (CSS filters + opacity, Checkpoint 4.7) — only meaningful for a filter-capable tag (see getElementCapabilities().supportsFilters). Like typography/border/boxShadow, unset fields here have no synthesized default — see getFilterSettings and resolveFilterStyle. */
  filters?: FilterSettings;
  /** This node's own display/visibility/overflow/interaction CSS (Checkpoint 4.8) — only meaningful for a display-capable tag (see getElementCapabilities().supportsDisplay). Like filters, unset fields here have no synthesized default — see getDisplaySettings and resolveDisplayStyle. `display` deliberately excludes "flex"/"grid" — see types/display.ts's own doc comment for why those remain exclusive to flowLayout/resolveFlowLayoutStyle. */
  display?: DisplaySettings;
  /** This node's own CSS `position`, and (Checkpoint 5.2) its top/right/bottom/left offsets — only meaningful for a position-capable tag (see getElementCapabilities().supportsPosition). Like display, unset has no synthesized default — see getPositionSettings and resolvePositionStyle. No inset-shorthand/logical-inset/z-index field exists yet (5.2.1/5.2.2/5.3) — see types/position.ts's own doc comment, including its documented ownership conflict with the pre-existing Free layout mechanism (Checkpoint 3.4.4). */
  position?: PositionSettings;
  /**
   * This node's own CSS `aspect-ratio` (Checkpoint 5.5) — only meaningful
   * for an aspect-ratio-capable tag (see
   * getElementCapabilities().supportsAspectRatio). Like display/position,
   * unset has no synthesized default — see resolveAspectRatioStyle. NOT
   * the same field as `aspectRatioLocked` above — see that field's own
   * doc comment, and types/aspectRatio.ts's own top comment, for the full
   * distinction between this real CSS box-sizing constraint and that
   * unrelated resize-interaction flag.
   */
  aspectRatio?: AspectRatioValue;
  /**
   * This node's own CSS min-width/min-height/max-width/max-height
   * (Checkpoint 5.7) — only meaningful for a sizing-capable tag (see
   * getElementCapabilities().supportsAspectRatio, which also gates this
   * — see that flag's own doc comment). Like aspect-ratio/display/
   * position, unset has no synthesized default — see getSizeConstraints
   * and resolveSizeConstraintsStyle. NOT the same as the pre-existing
   * `ElementResizeConstraints` (types/layout.ts) — that is a pointer-drag
   * interaction floor, never serialized as CSS; this is real, exported
   * CSS min/max — see types/sizeConstraints.ts's own top comment for the
   * full distinction.
   */
  sizeConstraints?: SizeConstraints;
  /**
   * This node's own native form-control type (Checkpoint 1.10, widened
   * through text-like variants in 1.11 and to checkbox/radio in 1.12) —
   * only meaningful for `tag: "input"`. Deliberately a separate field
   * from `tag` itself: the node stays a genuine `input` element
   * regardless of variant, exactly the way Heading Level (Checkpoint
   * 1.7) keeps `tag` as the single source of truth for h1–h6 rather
   * than introducing a parallel field — inputType is the input-specific
   * analogue, not a second copy of that same idea. Unset defaults to
   * "text" (see getInputType in types/input.ts) rather than requiring
   * every factory caller to stamp it explicitly. Checkbox/radio remain
   * this same one `input` tag, never a separate document concept — see
   * this checkpoint's own report.
   */
  inputType?: InputType;
  /**
   * This node's own `name` attribute (Checkpoint 1.10) — only meaningful
   * for a form-control-capable tag (see
   * getElementCapabilities().supportsFormControl). Same dedicated,
   * single-field-per-concern shape `href`/`src` already established;
   * deliberately not a generic attribute bag — see this checkpoint's own
   * report for why. Unset renders no `name` attribute at all.
   */
  name?: string;
  /**
   * This node's own `placeholder` attribute (Checkpoint 1.10) — only
   * meaningful for a form-control-capable tag whose value is free text
   * (text-like Input variants, Textarea — Checkpoint 1.12). Native
   * checkbox/radio ignore `placeholder` entirely, so it's semantically
   * inert (not hidden or deleted) for those two variants — see this
   * checkpoint's own report on non-destructive type switching. Unset
   * renders no `placeholder` attribute.
   */
  placeholder?: string;
  /**
   * This node's own AUTHORED/DEFAULT value (Checkpoint 1.10) — only
   * meaningful for a form-control-capable tag. Deliberately NOT live,
   * continuously-synchronized runtime state: Layoutry is a visual page
   * editor, not a running application, so this field represents the
   * initial value a real `<input>`/`<textarea>` would carry (rendered
   * via `defaultValue`, an uncontrolled DOM prop — see InputElement's
   * own doc comment), never the transient text a user is mid-typing on
   * the Canvas. Committed only at a deliberate edit-session boundary
   * (blur/Enter, or blur-only for Textarea — see
   * useNativeFormValueEditing) via setElementValue. Unset renders no
   * `value` attribute (an empty, unfilled field), the same "store
   * unconditionally, no synthesized default" convention `href` already
   * uses via getLinkHref. For checkbox/radio, this is HTML's own
   * `value` attribute (the submitted identifier) — a different concern
   * from `checked` below, exactly like real `<input type="checkbox"
   * value="...">` HTML.
   */
  value?: string;
  /**
   * This node's own AUTHORED/DEFAULT checked state (Checkpoint 1.12) —
   * only meaningful for `inputType: "checkbox" | "radio"`. Same
   * authored-state principle as `value` above: NOT continuously-
   * synchronized live DOM state, rendered via `defaultChecked` (an
   * uncontrolled DOM prop), committed only through the dedicated
   * setElementChecked command (Inspector-only in this checkpoint — see
   * this checkpoint's report on why Canvas clicks never toggle this).
   * Unset renders unchecked (`defaultChecked={undefined}` behaves the
   * same as `false` for a real `<input>`), the same "store
   * unconditionally, no synthesized default" convention `value` and
   * `href` already use.
   */
  checked?: boolean;
  /**
   * This node's own AUTHORED/DEFAULT selected state (Checkpoint 1.13) —
   * only meaningful for `tag: "option"` (a Select's direct child). Same
   * authored-state principle as `checked` above, but NOT rendered as a
   * DOM `selected` attribute directly: React does not reliably reconcile
   * a plain `<option selected>` HTML attribute the way it does an
   * uncontrolled `<select defaultValue>` matched against its options'
   * `value` props (the officially recommended pattern) — so the parent
   * SelectElement is what reads this field across its own children to
   * compute its own `defaultValue`; see types/select.ts's own doc
   * comment. Mutated only through the dedicated setSelectSelectedOption
   * command, which enforces the single-select invariant (at most one
   * sibling Option may be selected at a time) in one atomic mutation —
   * never toggled independently the way `checked` is, since an
   * independent per-node toggle could leave two siblings both selected.
   * Unset (not explicit false) is how every Option starts and how
   * "clear the authored selection entirely" is represented, letting the
   * native browser's own first-option default apply — the same "store
   * unconditionally, no synthesized default" convention `checked`/
   * `value`/`href` already use.
   */
  selected?: boolean;
  /**
   * This node's own `poster` attribute (Checkpoint 1.15) — only
   * meaningful for `tag: "video"`. A still image URL shown before
   * playback starts; a dedicated field rather than a second child image
   * node, matching the native `<video poster="...">` attribute exactly —
   * see this checkpoint's report on why a synthetic image child was
   * rejected. Same "store unconditionally, no synthesized default"
   * convention `src`/`href`/`checked` already use — unset renders no
   * `poster` attribute at all.
   */
  poster?: string;
  /**
   * This node's own `controls` attribute (Checkpoint 1.15) — only
   * meaningful for `tag: "video"`. Unlike `checked`/`autoplay`/`muted`/
   * `loop` below, unset does NOT mean "attribute absent" here: a freshly
   * created Video with no controls at all would be unusable/invisible on
   * the Canvas, so the renderer treats unset as an effective default of
   * `true` (see getVideoControls in types/video.ts) — the resolver-level
   * fallback pattern DEFAULT_OBJECT_FIT already established for mediaFit,
   * not a value written into the document. An explicit `false` genuinely
   * removes the attribute (a deliberately controls-less video).
   */
  controls?: boolean;
  /**
   * This node's own `autoplay` attribute (Checkpoint 1.15) — only
   * meaningful for `tag: "video"`. Same "store unconditionally, no
   * synthesized default" convention `checked` already uses — unset
   * renders no `autoplay` attribute (the safe, expected default). Never
   * automatically forces `muted` alongside it — see InspectorVideoSection's
   * own doc comment for why that coupling was deliberately NOT built.
   */
  autoplay?: boolean;
  /**
   * This node's own `muted` attribute (Checkpoint 1.15) — only meaningful
   * for `tag: "video"`. Same convention as `autoplay`/`checked` — unset
   * renders no `muted` attribute.
   */
  muted?: boolean;
  /**
   * This node's own `loop` attribute (Checkpoint 1.15) — only meaningful
   * for `tag: "video"`. Same convention as `autoplay`/`muted`/`checked` —
   * unset renders no `loop` attribute.
   */
  loop?: boolean;
  /**
   * This node's own `title` attribute (Checkpoint 1.15) — only meaningful
   * for `tag: "iframe"`, where it is the accessible name a screen reader
   * announces for the embedded content. Deliberately a dedicated field,
   * not folded into `displayName` (a Structure-panel/export-unrelated
   * label) — see this checkpoint's report for why the factory stamps a
   * real, neutral starter value ("Embedded content") rather than leaving
   * this unset, mirroring `href`'s own DEFAULT_LINK_HREF precedent (a
   * concrete, inert default rather than a foreseeable accessibility gap).
   */
  title?: string;
  /**
   * This node's own authored HTML `id` attribute (Checkpoint 1.15.1) —
   * genuine semantic HTML identity, meaningful for essentially any
   * rendered tag, NOT editor-only metadata. Deliberately named `htmlId`,
   * never `id`: this node already has its own internal editor identity at
   * `EditorElementNode.id` (a stable, app-generated string used for
   * selection/history/drag/structural lookups — see generateNodeId), and
   * the two concepts must never collide or be conflatable, even though
   * both would render as the string "id" in casual conversation. Same
   * "store unconditionally, no synthesized default" convention `href`/
   * `name`/`title` already use — unset renders no `id` attribute at all.
   * Only trimmed of accidental surrounding whitespace at the Inspector
   * field layer (see InspectorIdentitySection); never rewritten,
   * deduplicated, or validated beyond that — see this checkpoint's own
   * report for why (no project-wide uniqueness enforcement yet).
   */
  htmlId?: string;
  /**
   * This node's own authored HTML `class` attribute (Checkpoint 1.15.1) —
   * a plain, opaque, space-separated class string, authored exactly the
   * way a hand-written `class="hero-section featured"` attribute would
   * be. Deliberately NOT a token array/visual class editor and NOT a
   * CSS-class stylesheet system — this checkpoint only stores the
   * authored string itself; see this checkpoint's own report for why
   * both are explicitly deferred. Same "store unconditionally, no
   * synthesized default" convention `htmlId` above uses. Renderers must
   * treat this as content to APPEND alongside Layoutry's own required
   * editor/structural Tailwind classes (see documentNodeAttributes' own
   * doc comment and each element component's own className cn() call) —
   * never a replacement for them, and never applied to an editor-only
   * wrapper div when a genuine inner native element exists to own it
   * (Image/Video/Iframe — see this checkpoint's report, section C).
   */
  className?: string;
}
