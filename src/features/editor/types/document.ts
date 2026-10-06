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
import type { ShapePreset } from "@/features/editor/types/shape";
import type { SvgPrimitiveKind, SvgViewBox } from "@/features/editor/types/svg";
import type { SvgScene } from "@/features/editor/types/svgScene";
import type { InteractionBinding } from "@/features/editor/types/interactions";
import type { InitialPreviewVisibility } from "@/features/editor/types/previewVisibility";
import type { TransitionSettings } from "@/features/editor/types/transition";

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
  /** The media source URL (Checkpoint 3.5.1, widened to video in Checkpoint 1.15, widened to audio in Checkpoint 1.15.6.12.3) — only meaningful for a media-capable tag (img, video, audio). Unset renders an empty placeholder rather than a broken/missing image. Iframe deliberately reuses this exact same field for its own `src` (Checkpoint 1.15) — same "source of the embedded content" concern, no `iframeSrc`/`audioSrc` duplicate. */
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
  /**
   * This node's own visual clipping shape (Checkpoint 1.15.4) — only
   * meaningful for a shape-capable tag (see
   * getElementCapabilities().supportsShape, deliberately a narrow
   * container/layout-primitive allowlist, not every visual-box tag the
   * way supportsBorderRadius is). A CSS styling capability, NOT a new
   * document node type or a synthetic HTML primitive: the element stays
   * exactly the same semantic tag, only its authored `clip-path` changes
   * — see resolveShapeStyle and types/shape.ts's own top comment.
   * Unset (the ordinary case) renders as a plain rectangle with no
   * clip-path CSS at all — see getShapePreset, which resolves that case
   * to the concrete "none" preset for reads. Independent of
   * `borderRadius`: changing Shape never resets or overwrites stored
   * border-radius data, even though clip-path visually overrides its
   * effect for a non-rectangular preset (see this checkpoint's own
   * report, section 19) — both fields are preserved and restored exactly
   * as authored if the user switches back and forth.
   */
  shape?: ShapePreset;
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
   * meaningful for `tag: "video"` (NOT reused by Audio — Checkpoint
   * 1.15.6.12.3 deliberately gave Audio no poster-equivalent field; see
   * InspectorAudioSection's own doc comment). A still image URL shown
   * before playback starts; a dedicated field rather than a second child
   * image node, matching the native `<video poster="...">` attribute
   * exactly — see this checkpoint's report on why a synthetic image child
   * was rejected. Same "store unconditionally, no synthesized default"
   * convention `src`/`href`/`checked` already use — unset renders no
   * `poster` attribute at all.
   */
  poster?: string;
  /**
   * This node's own `controls` attribute (Checkpoint 1.15, widened to
   * `tag: "audio"` in Checkpoint 1.15.6.12.3 — the identical field, no
   * `audioControls` duplicate). Unlike `checked`/`autoplay`/`muted`/
   * `loop` below, unset does NOT mean "attribute absent" here: a freshly
   * created Video or Audio with no controls at all would be unusable/
   * invisible on the Canvas, so the renderer treats unset as an effective
   * default of `true` (see getMediaControls in types/video.ts, renamed
   * from getVideoControls once Audio became a second caller) — the
   * resolver-level fallback pattern DEFAULT_OBJECT_FIT already established
   * for mediaFit, not a value written into the document. An explicit
   * `false` genuinely removes the attribute (a deliberately controls-less
   * video/audio).
   */
  controls?: boolean;
  /**
   * This node's own `autoplay` attribute (Checkpoint 1.15, widened to
   * `tag: "audio"` in Checkpoint 1.15.6.12.3 — the identical field, no
   * `audioAutoplay` duplicate). Same "store unconditionally, no
   * synthesized default" convention `checked` already uses — unset
   * renders no `autoplay` attribute (the safe, expected default). Never
   * automatically forces `muted` alongside it — see
   * InspectorMediaPlaybackFields's own doc comment for why that coupling
   * was deliberately NOT built. The authored value here is always
   * preserved as-is; VideoElement/AudioElement additionally gate the
   * render-time `autoPlay` DOM attribute on Preview mode (Checkpoint
   * 1.15.6.12.3 — see either component's own doc comment), a rendering
   * concern that never touches this field.
   */
  autoplay?: boolean;
  /**
   * This node's own `muted` attribute (Checkpoint 1.15, widened to
   * `tag: "audio"` in Checkpoint 1.15.6.12.3 — the identical field, no
   * `audioMuted` duplicate). Same convention as `autoplay`/`checked` —
   * unset renders no `muted` attribute.
   */
  muted?: boolean;
  /**
   * This node's own `loop` attribute (Checkpoint 1.15, widened to
   * `tag: "audio"` in Checkpoint 1.15.6.12.3 — the identical field, no
   * `audioLoop` duplicate). Same convention as `autoplay`/`muted`/
   * `checked` — unset renders no `loop` attribute.
   */
  loop?: boolean;
  /**
   * This node's own `value` for `tag: "progress"` (Checkpoint 1.15.6.12.4)
   * — NOT reused from `value` above (that field is a plain `string`, this
   * is a `number`; widening `value` to `string | number` would have been a
   * worse, more ambiguous shared field than one dedicated one, the same
   * "one field per distinct semantic concern" reasoning `svgFill`/
   * `svgStroke` already establish rather than overloading `background`).
   * `undefined` is NOT "attribute absent meaning zero" — it is the real,
   * distinct native indeterminate state (no `value` attribute at all; see
   * getProgressValue/isProgressIndeterminate in types/progress.ts). There
   * is deliberately no separate `progressIndeterminate` boolean — absence
   * of this field IS that state, the single source of truth. A defined
   * value is clamped to `[0, effective progressMax]` by
   * setElementProgressValue/setElementProgressMax at write time, so the
   * document itself never drifts out of the range it visually renders.
   */
  progressValue?: number;
  /**
   * This node's own `max` for `tag: "progress"` (Checkpoint 1.15.6.12.4).
   * Unset resolves to DEFAULT_PROGRESS_MAX (100) via getProgressMax's own
   * resolver-level fallback — not native HTML's own obscure default of 1
   * (verified live in real Chromium), since this app's factory always
   * stamps a concrete starter value; the stored field itself carries no
   * synthesized default, same convention `controls` uses. Native Max must
   * be greater than zero — setElementProgressMax enforces this at write
   * time (clamped to a minimum of 1) rather than relying on browser
   * coercion, which only affects the rendered IDL property, never the
   * document's own stored value.
   */
  progressMax?: number;
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
   * This node's own starter vector geometry (Checkpoint 1.15.5) — only
   * meaningful for `tag: "svg"`. A genuine `<svg>` document primitive,
   * NOT arbitrary editable descendant geometry (that belongs to the
   * later SVG Drawing Tool checkpoint) — see types/svg.ts's own top
   * comment for the full architectural framing. Content/vector data, not
   * CSS styling: unlike svgFill/svgStroke/svgStrokeWidth below, changing
   * svgKind is NOT guarded by Parent Style Protection (see
   * commands/svgCommands.ts's setSvgKind). Unset renders the default
   * starter Rectangle — see getSvgKind.
   */
  svgKind?: SvgPrimitiveKind;
  /**
   * This node's own `viewBox` (Checkpoint 1.15.5) — only meaningful for
   * `tag: "svg"`. Like svgKind, this is vector content, not CSS styling,
   * and is NOT guarded by Parent Style Protection. Resizing the SVG's
   * outer layout box (ordinary `dimensions`/`freeLayout`, exactly like
   * every other element) never rewrites this field — the browser scales
   * the vector to fit, native SVG behavior this checkpoint deliberately
   * relies on rather than reimplementing. Unset renders the default
   * "0 0 100 100" — see resolveSvgViewBox.
   */
  svgViewBox?: SvgViewBox;
  /**
   * This node's own SVG `fill` (Checkpoint 1.15.5) — only meaningful for
   * `tag: "svg"`, applied as a real SVG presentation attribute on the
   * starter geometry's own child element (`<rect>`/`<circle>`/
   * `<polygon>`), never as CSS — see this checkpoint's own report,
   * section F, for why. A CSS-like visual styling concern, unlike
   * svgKind/svgViewBox above — guarded by Parent Style Protection (see
   * commands/svgCommands.ts's setSvgFill). Unset renders native SVG's
   * own initial fill (black) — see resolveSvgFill. Deliberately distinct
   * from `background` (CSS background on the `<svg>` box itself, which
   * SVG also independently supports — see this checkpoint's report,
   * section on Background/Border).
   */
  svgFill?: string;
  /**
   * This node's own SVG `stroke` (Checkpoint 1.15.5) — only meaningful
   * for `tag: "svg"`, a real SVG presentation attribute, guarded by
   * Parent Style Protection exactly like svgFill. NOT the same concept
   * as CSS `border` (see types/border.ts) — a stroke traces the starter
   * geometry's own vector outline, a border draws around the `<svg>`
   * box's rectangular edge; both may be set independently. Unset means
   * no stroke at all (native SVG's own initial value) — see
   * resolveSvgStroke.
   */
  svgStroke?: string;
  /**
   * This node's own SVG `stroke-width` (Checkpoint 1.15.5) — only
   * meaningful for `tag: "svg"`, guarded by Parent Style Protection
   * exactly like svgFill/svgStroke. Deliberately preserved independently
   * of svgStroke: toggling Stroke to "None" never clears this field (see
   * this checkpoint's own report, section on Stroke Width) — a later
   * re-enabled stroke picks the previous width back up rather than
   * resetting to the native default. Unset resolves to native SVG's own
   * initial stroke-width (1) — see resolveSvgStrokeWidth.
   */
  svgStrokeWidth?: number;
  /**
   * This node's own SVG Drawing Tool vector scene (Checkpoint 1.15.6) —
   * only meaningful for `tag: "svg"`. A closed set of typed vector
   * objects (rect/ellipse/line/polygon/path — see types/svgScene.ts's
   * own top comment), NOT a tree of further `EditorElementNode`s; the
   * SVG remains exactly one document node regardless of how many vector
   * objects its scene holds. Absent/empty means this SVG is still in
   * Checkpoint 1.15.5's "legacy/simple" mode, rendering its single
   * svgKind starter primitive — see resolveSvgScene and SvgElement.tsx's
   * own legacy-vs-scene render branch. Once populated (via entering SVG
   * Edit Mode, which materializes the starter primitive into an
   * equivalent scene object — see commands/svgSceneCommands.ts's
   * materializeSvgStarterIntoScene), the scene becomes the sole
   * rendering source of truth; svgKind/svgViewBox are never read again
   * for that node, though they remain stored (never destructively
   * cleared) so a duplicate or an old in-memory reference stays coherent.
   * Vector object geometry lives in SVG viewBox coordinates, exactly
   * like svgViewBox itself. Each object's own fill/stroke/strokeWidth is
   * a real SVG presentation attribute, guarded by Parent Style
   * Protection exactly like the legacy svgFill/svgStroke/svgStrokeWidth
   * fields; adding/removing/moving/resizing an object (and svgKind/
   * svgViewBox above) is vector CONTENT and is never guarded.
   */
  svgScene?: SvgScene;
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
  /**
   * This node's own "Lock child styles" toggle (Checkpoint 1.15.3) —
   * editor-only protection metadata, NOT a CSS property and NOT exported.
   * When true, every descendant's authored CSS/style mutations (Typography,
   * Background, Border, Size, Spacing, Position, Media Fit, Filters,
   * Display, Flex/Grid child settings, Free-layout geometry, resize, ...)
   * are blocked by the centralized style-protection guard (see
   * rules/styleProtection.ts) until this is turned back off. Semantic and
   * structural edits (text, href, src, form fields, Identity, table/list/
   * select structure, reordering, delete, duplicate) are entirely
   * unaffected — this is deliberately a STYLE lock, not a content or
   * structure lock. Applies recursively to every descendant, not just
   * direct children; the node that OWNS the lock is never protected by its
   * own lock (see findNearestStyleLockingAncestor, which walks ancestors
   * only, never the node itself). Same "store unconditionally, no
   * synthesized default" convention `htmlId`/`className` already use —
   * unset (the default) means unlocked.
   */
  lockChildStyles?: boolean;
  /**
   * This node's own authored interaction bindings (Checkpoint 1.15.6.8) —
   * generic, persistent, history-aware authored behavior ("when this node
   * is clicked, show/hide/toggle that node"), never component-specific
   * state (no `modalOpen`/`dropdownOpen`/`accordionOpen`/`activeTab`
   * field exists or is planned). Deliberately NOT the same concern as
   * `lockChildStyles` above (an editor-only protection flag with no CSS
   * meaning) — this is genuinely authored document content, the FIRST
   * node-to-node reference this document model has ever had (see
   * types/interactions.ts's own top comment). Same "store unconditionally,
   * no synthesized default" convention `htmlId`/`className` already use,
   * except normalized back to `undefined` rather than `[]` once empty —
   * see withInteractions. Whether a target is CURRENTLY visible during a
   * Preview session is unrelated runtime state, never stored here (see
   * useEditorStore's own `runtimeVisibility` slice).
   */
  interactions?: InteractionBinding[];
  /**
   * This node's own authored initial visibility the moment a Preview
   * session begins (Checkpoint 1.15.6.8.1) — genuinely generic, working
   * on any node regardless of whether anything currently targets it; NOT
   * the same field as `display`/`filters` CSS visibility (a real Design-
   * time CSS box property, unaffected by this) and NOT the ephemeral
   * CURRENT-visibility-during-Preview slice that lives on the store
   * instead (`runtimeVisibility`) — see types/previewVisibility.ts's own
   * top comment for the full three-way distinction. Read exactly once,
   * at Preview-entry time, to seed that ephemeral slice; toggling a node
   * via a click interaction during Preview never rewrites this field.
   * Same "store unconditionally, no synthesized default" convention
   * `lockChildStyles` already uses — unset (the default, and the only
   * value every pre-1.15.6.8.1 node has) means "visible."
   */
  initialPreviewVisibility?: InitialPreviewVisibility;
  /**
   * This node's own CSS Transition (Checkpoint 1.15.6.14.1) — only
   * meaningful for a transition-capable tag (see
   * getElementCapabilities().supportsTransition). Like Display/Position/
   * AspectRatio, has no synthesized default — absent means "no authored
   * transition at all," the state every pre-existing node already has;
   * never stamped by any factory. Unlike those three, this field's own
   * four sub-fields are only ever meaningful together — see
   * types/transition.ts's own top comment for why there is no per-field
   * "collapse to undefined once empty" case the way Filters/Display have.
   * Rendered via resolveTransitionStyle, which ALSO reads the current
   * Design/Preview mode (not just this field) — Design must never run an
   * authored transition (this checkpoint's own mandatory Design Safety
   * Invariant), so the real `transition-*` CSS longhands only ever reach
   * the rendered element while Preview is active, even though this field
   * itself is stored and preserved identically in both modes.
   */
  transition?: TransitionSettings;
}
