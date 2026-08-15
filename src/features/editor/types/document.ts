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
  /** The media source URL (Checkpoint 3.5.1) — only meaningful for a media-capable tag (img; video/iframe once those exist). Unset renders an empty placeholder rather than a broken/missing image. */
  src?: string;
  /** How this node's own visual content fits its rendered box (Checkpoint 3.5.1) — only meaningful for a media-capable tag (see getElementCapabilities().supportsIntrinsicAspectRatio). Unset means contain/center/preserveAspectRatio:true — see getMediaFitSettings. */
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
}
