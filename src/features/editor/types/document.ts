import type {
  ChildResizePolicy,
  ContainerLayoutMode,
  FreeLayoutGeometry,
} from "@/features/editor/types/layout";
import type { FlexChildSettings, FlowLayoutSettings, GridChildSettings } from "@/features/editor/types/flowLayout";
import type { ElementSpacing } from "@/features/editor/types/spacing";
import type { MediaFitSettings } from "@/features/editor/types/mediaFit";

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
   * img/video/iframe by default).
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
}
