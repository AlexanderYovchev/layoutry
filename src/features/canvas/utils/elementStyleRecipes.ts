import type { CSSProperties } from "react";
import type { DocumentDefaultStyleId } from "@/features/canvas/utils/documentDefaultStyles";
import { elementPositionStyle } from "@/features/canvas/utils/elementDimensionsStyle";
import { resolveAspectRatioStyle } from "@/features/canvas/utils/resolveAspectRatioStyle";
import { resolveBackgroundStyle } from "@/features/canvas/utils/resolveBackgroundStyle";
import { resolveBorderRadiusStyle } from "@/features/canvas/utils/resolveBorderRadiusStyle";
import { resolveBorderStyle } from "@/features/canvas/utils/resolveBorderStyle";
import { resolveBoxShadowStyle } from "@/features/canvas/utils/resolveBoxShadowStyle";
import { resolveDisplayStyle } from "@/features/canvas/utils/resolveDisplayStyle";
import { resolveFilterStyle } from "@/features/canvas/utils/resolveFilterStyle";
import { resolveFlexOrGridChildStyle } from "@/features/canvas/utils/resolveFlexOrGridChildStyle";
import { resolveFlowLayoutStyle } from "@/features/canvas/utils/resolveFlowLayoutStyle";
import { resolveMediaFitStyle } from "@/features/canvas/utils/resolveMediaFitStyle";
import { resolvePositionStyle } from "@/features/canvas/utils/resolvePositionStyle";
import { resolveShapeStyle } from "@/features/canvas/utils/resolveShapeStyle";
import { resolveSizeConstraintsStyle } from "@/features/canvas/utils/resolveSizeConstraintsStyle";
import { resolveTransformStyle } from "@/features/canvas/utils/resolveTransformStyle";
import { resolveTransitionStyle } from "@/features/canvas/utils/resolveTransitionStyle";
import { resolveTypographyStyle } from "@/features/canvas/utils/resolveTypographyStyle";
import { getInputType, isToggleInputType } from "@/features/editor/types/input";
import { getLayoutMode } from "@/features/editor/types/layout";
import type { ElementStyleContext, ElementStyleRecipe, MediaElementStyleRecipe } from "@/features/canvas/types/elementStyleRecipe";
import type { EditorElementNode } from "@/features/editor/types/document";

/*
 * Element style recipes (EXPORT-1.2) — for each family of document
 * elements, which resolvers apply, in which order, and which default
 * presentations (documentDefaultStyles.ts) the node gets. These were
 * previously written inline in each Canvas element component; they live
 * here so the Canvas and HTML/CSS export compose a node's appearance from
 * the exact same rules. Spread order is significant (a later resolver
 * wins for the same property) and is preserved verbatim from the
 * components; the rules behind it are summarized below.
 *
 * Nothing here reads editor runtime state: drag opacity, text-editing
 * outlines, cursors and event handlers stay in the components.
 *
 * Ordering rules every recipe follows (moved here from the components):
 * - Position first, then elementPositionStyle (Checkpoint 5.1): a Free
 *   child's own position: absolute — and a Free host's position:
 *   relative, which establishes the containing block its Free children's
 *   left/top resolve against — must win over the general Position
 *   control. See types/position.ts for that ownership conflict.
 * - Size constraints after the flex/grid child resolver (Checkpoint 5.7):
 *   that resolver's min-width/min-height: 0 is a containment default, and
 *   an explicit user min-width/min-height must win over it.
 *
 * Why each legacy default gives way ("legacy chrome gets out of the way
 * entirely once real data exists"):
 * - Container flex column + gap and p-8 predate flowLayout/spacing
 *   (Checkpoint 3.5); every new container stamps both, so only old nodes
 *   keep them.
 * - Border and radius defaults (Checkpoints 4.4/4.5) yield to ANY authored
 *   border/radius, not per side: a Tailwind shorthand would otherwise keep
 *   governing the sides/corners an inline longhand doesn't touch, leaving
 *   a phantom border or rounding that looks like real data.
 * - The button shadow (Checkpoint 4.6) yields once boxShadow exists at
 *   all — a node whose layers are all disabled has made an explicit
 *   "no shadow" choice the default must not reappear under.
 * - The text elements' resize clip (overflow: hidden from clipOverflowY)
 *   yields to any authored overflow (Checkpoints 4.8/5.4): the shorthand
 *   would otherwise fight the authored overflow-x/-y longhands.
 * - List markers are an unconditional default because Preflight resets
 *   ul/ol to list-style: none; list-inside keeps the marker in the box.
 * - Media/SVG default heights yield to a ratio-mode aspect ratio
 *   (Checkpoints 5.5/5.6): a fixed height blocks aspect-ratio from ever
 *   reshaping an unresized box; an explicit resize already overrides it.
 * - The link underline pair yields to ANY authored text decoration,
 *   including "none" (Checkpoint 1.15.6.10.3).
 */

function hasNoAuthoredOverflow(node: EditorElementNode): boolean {
  return !node.display?.overflow && !node.display?.overflowX && !node.display?.overflowY;
}

/** The visual-effects tail every box-like element shares, in its fixed order. */
function effectStyles(node: EditorElementNode, isPreview: boolean): CSSProperties {
  return {
    ...resolveBorderStyle(node),
    ...resolveBorderRadiusStyle(node),
    ...resolveBoxShadowStyle(node),
    ...resolveFilterStyle(node),
    ...resolveTransitionStyle(node, isPreview),
    ...resolveTransformStyle(node),
  };
}

/** Position, geometry, aspect ratio, flex/grid child and size constraints, in their fixed order. */
function placementStyles(
  node: EditorElementNode,
  context: ElementStyleContext,
  options?: { clipOverflowY?: boolean; aspectRatio?: boolean },
): CSSProperties {
  return {
    ...resolvePositionStyle(node),
    ...elementPositionStyle(node, context.parentLayoutMode, { clipOverflowY: options?.clipOverflowY }),
    ...(options?.aspectRatio === false ? undefined : resolveAspectRatioStyle(node)),
    ...resolveFlexOrGridChildStyle(node, context.parentFlowDisplay),
    // After the flex/grid child resolver: an explicit min-width/min-height
    // must win over that resolver's own containment default of 0.
    ...resolveSizeConstraintsStyle(node, context.parentLayoutMode),
  };
}

/** The virtual page root. */
export function resolvePageRootElementStyle(): ElementStyleRecipe {
  return { defaults: ["page-root"], style: {} };
}

/** A legacy `body` node (pre-dates the page root) — fixed presentation, no authored styling. */
export function resolveLegacyBodyElementStyle(): ElementStyleRecipe {
  return { defaults: ["legacy-body"], style: {} };
}

/** div/section/ul/ol/header/nav/main/article/aside/footer/form/label/fieldset/figure. */
export function resolveContainerElementStyle(node: EditorElementNode, context: ElementStyleContext): ElementStyleRecipe {
  const isFreeChild = context.parentLayoutMode === "free";
  const ownLayoutMode = getLayoutMode(node);
  const hostsOwnFreeChildren = ownLayoutMode === "free" && !isFreeChild;

  const defaults: DocumentDefaultStyleId[] = [];
  if (!node.borderRadius) defaults.push("container-radius");
  if (!node.border) defaults.push("container-border");
  if (!node.flowLayout) defaults.push("container-flow");
  if (!node.spacing) defaults.push("container-padding");
  if (node.tag === "ul") defaults.push("list-disc");
  if (node.tag === "ol") defaults.push("list-decimal");

  return {
    defaults,
    style: {
      // Position first, and both Free geometry and the Free-host override
      // after it: a Free child's own position: absolute and a Free host's
      // own position: relative always win over the general Position control.
      ...resolvePositionStyle(node),
      ...elementPositionStyle(node, context.parentLayoutMode),
      ...resolveAspectRatioStyle(node),
      ...resolveFlexOrGridChildStyle(node, context.parentFlowDisplay),
      ...resolveSizeConstraintsStyle(node, context.parentLayoutMode),
      ...(ownLayoutMode === "flow" ? resolveFlowLayoutStyle(node) : undefined),
      ...(hostsOwnFreeChildren ? { position: "relative" } : {}),
      ...resolveBackgroundStyle(node),
      ...effectStyles(node, context.isPreview),
      ...resolveDisplayStyle(node),
      ...resolveShapeStyle(node),
    },
  };
}

function textElementDefaults(node: EditorElementNode, context: ElementStyleContext): DocumentDefaultStyleId[] {
  switch (node.tag) {
    case "p":
      return context.parentLayoutMode !== "free" && !node.dimensions ? ["paragraph", "paragraph-prose"] : ["paragraph"];
    case "li":
      return ["list-item"];
    case "legend":
      return ["legend"];
    case "figcaption":
      return ["figcaption"];
    case "a":
      return node.typography?.textDecorationLine === undefined ? ["link", "link-underline"] : ["link"];
    case "button": {
      const defaults: DocumentDefaultStyleId[] = ["button"];
      if (!node.borderRadius) defaults.push("control-radius");
      if (!node.boxShadow) defaults.push("button-shadow");
      return defaults;
    }
    default:
      return ["heading"];
  }
}

/** h1–h6/p/li/legend/figcaption/a/button — text-bearing leaves. */
export function resolveTextElementStyle(node: EditorElementNode, context: ElementStyleContext): ElementStyleRecipe {
  return {
    defaults: textElementDefaults(node, context),
    style: {
      ...placementStyles(node, context, { clipOverflowY: hasNoAuthoredOverflow(node) }),
      ...resolveTypographyStyle(node),
      ...resolveBackgroundStyle(node),
      ...effectStyles(node, context.isPreview),
      ...resolveDisplayStyle(node),
    },
  };
}

function controlElementDefaults(node: EditorElementNode): DocumentDefaultStyleId[] {
  if (node.tag === "table") {
    const defaults: DocumentDefaultStyleId[] = ["table"];
    if (!node.borderRadius) defaults.push("container-radius");
    if (!node.border) defaults.push("container-border");
    return defaults;
  }
  const isToggle = node.tag === "input" && isToggleInputType(getInputType(node));
  const defaults: DocumentDefaultStyleId[] = [isToggle ? "toggle-input" : node.tag === "textarea" ? "textarea" : "text-control"];
  if (!node.borderRadius && !isToggle) defaults.push("control-radius");
  if (!node.border) defaults.push("control-border");
  return defaults;
}

/** input/textarea/select/table. */
export function resolveControlElementStyle(node: EditorElementNode, context: ElementStyleContext): ElementStyleRecipe {
  return {
    defaults: controlElementDefaults(node),
    style: {
      ...placementStyles(node, context),
      ...resolveTypographyStyle(node),
      ...resolveBackgroundStyle(node),
      ...effectStyles(node, context.isPreview),
      ...resolveDisplayStyle(node),
    },
  };
}

/** option — only typography and background apply. */
export function resolveOptionElementStyle(node: EditorElementNode): ElementStyleRecipe {
  return { defaults: [], style: { ...resolveTypographyStyle(node), ...resolveBackgroundStyle(node) } };
}

/** thead/tbody/tfoot/tr. */
export function resolveTableStructureElementStyle(node: EditorElementNode): ElementStyleRecipe {
  return {
    defaults: [],
    style: { ...resolveTypographyStyle(node), ...resolveBackgroundStyle(node), ...resolveBorderStyle(node) },
  };
}

/** th/td/caption — table-internal boxes, no position/flex-child/display controls. */
export function resolveTableCellElementStyle(node: EditorElementNode, context: ElementStyleContext): ElementStyleRecipe {
  let defaults: DocumentDefaultStyleId[];
  if (node.tag === "caption") {
    defaults = ["caption"];
  } else {
    defaults = node.tag === "th" ? ["table-cell", "table-header-cell"] : ["table-cell"];
    if (!node.border) defaults.push("container-border");
  }
  return {
    defaults,
    style: {
      ...elementPositionStyle(node, context.parentLayoutMode),
      ...resolveAspectRatioStyle(node),
      ...resolveSizeConstraintsStyle(node, context.parentLayoutMode),
      ...resolveTypographyStyle(node),
      ...resolveBackgroundStyle(node),
      ...effectStyles(node, context.isPreview),
    },
  };
}

/** hr/progress — boxes with no typography or background. */
export function resolveBoxElementStyle(node: EditorElementNode, context: ElementStyleContext): ElementStyleRecipe {
  return {
    defaults: node.tag === "hr" && !node.border ? ["divider-border"] : [],
    style: {
      ...placementStyles(node, context),
      ...effectStyles(node, context.isPreview),
      ...resolveDisplayStyle(node),
    },
  };
}

function mediaFrameDefaults(
  node: EditorElementNode,
  frame: "image-frame" | "media-frame",
  height: "media-height" | "audio-height",
): DocumentDefaultStyleId[] {
  const defaults: DocumentDefaultStyleId[] = [frame];
  if (node.aspectRatio?.mode !== "ratio") defaults.push(height);
  if (!node.borderRadius) defaults.push("control-radius");
  if (!node.border) defaults.push("media-placeholder-border");
  return defaults;
}

/** img — the outer layout box plus the inner `<img>`'s own media-fit style. */
export function resolveImageElementStyle(node: EditorElementNode, context: ElementStyleContext): MediaElementStyleRecipe {
  return {
    defaults: mediaFrameDefaults(node, "image-frame", "media-height"),
    style: {
      ...placementStyles(node, context),
      ...effectStyles(node, context.isPreview),
      ...resolveDisplayStyle(node),
    },
    innerStyle: resolveMediaFitStyle(node),
  };
}

const IFRAME_INNER_STYLE: CSSProperties = { width: "100%", height: "100%", border: 0, display: "block" };
const AUDIO_INNER_STYLE: CSSProperties = { width: "100%", height: "100%" };

/** video/iframe — position: relative first (any authored Position wins over it). */
export function resolveVideoOrIframeElementStyle(node: EditorElementNode, context: ElementStyleContext): MediaElementStyleRecipe {
  return {
    defaults: mediaFrameDefaults(node, "media-frame", "media-height"),
    style: {
      position: "relative",
      ...placementStyles(node, context),
      ...effectStyles(node, context.isPreview),
      ...resolveDisplayStyle(node),
    },
    innerStyle: node.tag === "iframe" ? IFRAME_INNER_STYLE : resolveMediaFitStyle(node),
  };
}

/** audio — unlike video, no aspect ratio, but a background. */
export function resolveAudioElementStyle(node: EditorElementNode, context: ElementStyleContext): MediaElementStyleRecipe {
  return {
    defaults: mediaFrameDefaults(node, "media-frame", "audio-height"),
    style: {
      position: "relative",
      ...placementStyles(node, context, { aspectRatio: false }),
      ...resolveBackgroundStyle(node),
      ...effectStyles(node, context.isPreview),
      ...resolveDisplayStyle(node),
    },
    innerStyle: AUDIO_INNER_STYLE,
  };
}

/**
 * svg — the vector box itself; its geometry is content, not CSS. The fixed
 * default height yields to a ratio-mode Aspect Ratio (it would otherwise
 * block the ratio from ever reshaping an unresized SVG — the Checkpoint 5.6
 * bug); width stays fixed because aspect-ratio computes height FROM width.
 */
export function resolveSvgElementStyle(node: EditorElementNode, context: ElementStyleContext): ElementStyleRecipe {
  return {
    defaults: node.aspectRatio?.mode !== "ratio" ? ["svg-width", "svg-height"] : ["svg-width"],
    style: {
      ...placementStyles(node, context),
      ...resolveBackgroundStyle(node),
      ...effectStyles(node, context.isPreview),
      ...resolveDisplayStyle(node),
    },
  };
}

/**
 * dialog — Design keeps it in normal flow (position: static, opened
 * non-modally); Preview lets the authored Position apply and centers an
 * unpositioned dialog with margin: auto, the way the native modal top
 * layer does. No Display control: the dialog's own open state owns that.
 * The rationale below moved here from DialogElement with the code.
 */
export function resolveDialogElementStyle(node: EditorElementNode, context: ElementStyleContext): ElementStyleRecipe {
  const { isPreview } = context;
  // Checkpoint 1.15.6.11.3 — generic centering-vs-explicit-positioning
  // split, verified live via an isolated CSS ground-truth probe before
  // being written here (see this checkpoint's own report, Part C). Chrome's
  // real `dialog:modal` UA rule is effectively `inset: 0; width/height:
  // fit-content; margin: auto` — exactly what makes Modal's own
  // no-authored-position case center correctly. The unconditional
  // `margin: auto` this file already applied in Preview (Checkpoint
  // 1.15.6.9.1) is scoped here to ONLY the case where the author hasn't
  // opted into an explicit CSS `position` (the pre-existing, already-
  // generic PositionSettings field — no new field) — once an author sets
  // e.g. `position: fixed` with authored offsets (an edge-anchored Drawer),
  // margin: auto would silently re-center the box over those offsets
  // (confirmed live: it ignores authored top/right/bottom entirely and
  // centers using the dialog's own intrinsic content size instead).
  //
  // The companion `height: auto` override undoes the OTHER half of that
  // same UA rule — `height: fit-content` — which is not something
  // resolvePositionStyle (top/right/bottom/left/zIndex only) can ever
  // touch, and which otherwise silently prevents an author's own
  // `top: 0; bottom: 0` from stretching the box to fill the viewport
  // (confirmed live: with fit-content still in effect, bottom is ignored
  // as over-constrained and the box just shrink-wraps its own content at
  // the top edge instead of spanning full height). Explicit `auto` restores
  // the ordinary CSS abspos rule ("top and bottom both set, height auto ->
  // solve height to fill the gap"), which is also confirmed live to track
  // the viewport dynamically, not a one-time computed pixel value. Applied
  // only in Preview (Design never uses showModal()/the top layer, so
  // neither UA rule is ever in effect there) and only when the author has
  // an explicit non-static position, so Modal's own centering path is
  // untouched by construction — this reads an existing generic field, adds
  // no new one, and does not know Drawer/Modal/any composition by name.
  const hasExplicitPosition = node.position?.position !== undefined && node.position.position !== "static";
  const defaults: DocumentDefaultStyleId[] = ["dialog"];
  if (!node.borderRadius) defaults.push("container-radius");
  if (!node.border) defaults.push("container-border");
  return {
    defaults,
    style: {
      // Chrome's own UA stylesheet gives even a non-modal `<dialog
      // open>` `position: absolute` by default (confirmed directly
      // during this checkpoint's own live QA — a fresh `<dialog open>`
      // with no authored styling computes `position: absolute`,
      // floating centered over its own siblings instead of
      // participating in normal flow) — genuinely unlike every other
      // tag this app renders, none of which need a base default here
      // since their own UA defaults already are static/in-flow. This
      // base default restores ordinary Design-mode flow participation
      // (Part 7/8 of this checkpoint's own brief: Dialog must remain
      // inside Canvas flow/layout, fully editable); resolvePositionStyle
      // is still spread AFTER it, so an authored Position setting (or
      // Free-child placement) still wins exactly like every other
      // element already allows. Deliberately Design-only (`!isPreview`):
      // while modally shown via showModal(), the SAME inline override
      // would just as forcefully fight the UA's own `dialog:modal`
      // top-layer centering (`position: fixed`) — an inline style always
      // outranks any stylesheet rule for the same property regardless of
      // origin — corrupting the real native modal's own presentation.
      // Every Preview mount of this component already IS a showModal()
      // case by construction (see this file's own top comment), so
      // `isPreview` alone is sufficient to distinguish the two.
      ...(!isPreview ? { position: "static" as const } : {}),
      // Checkpoint 1.15.6.9.1 — the companion fix to the `position`
      // override just above, but for the opposite direction: Tailwind's
      // own Preflight resets `margin: 0` on literally every element
      // (`*, ::before, ::after, ::backdrop` — confirmed live via this
      // checkpoint's own QA by inspecting the actual parsed `@layer
      // base` rule, not assumed), which is an AUTHOR-origin rule and so
      // unconditionally wins over the UA's own `dialog:modal { margin:
      // auto }` centering rule regardless of specificity — origin beats
      // specificity in the cascade, so no amount of removing our OWN
      // classes could ever "lose" to the UA rule on purpose (this file
      // briefly tried a Design-only `m-0` utility class for the
      // Design-mode side of this same conflict; it turned out to be
      // entirely redundant with Preflight's own reset and was removed).
      // Explicitly restoring `margin: auto` only while Preview's real
      // showModal() is active reclaims the browser's own centering
      // trick (inset: 0 + margin: auto + a fit-content intrinsic width,
      // all still supplied by the UA `dialog`/`dialog:modal` rules,
      // none of which this component overrides) without touching
      // Design at all, where Preflight's margin: 0 is exactly the
      // ordinary-flow-participation behavior Part 7/8 already wants.
      ...(isPreview && !hasExplicitPosition ? { margin: "auto" as const } : {}),
      // Checkpoint 1.15.6.11.3 — a real, live-QA-caught finding: Position
      // (Checkpoint 5.1) is unconditional for every OTHER element
      // (ContainerElement etc. always spread resolvePositionStyle
      // regardless of Design/Preview), and initially this component did
      // the same. That is exactly correct for an ordinary box, but not
      // here: Dialog already has its own bespoke Design-mode positioning
      // story distinct from every other tag (the `position: static`
      // override immediately above exists solely because Design must
      // never let this box escape ordinary flow) — Part 16 of this
      // checkpoint's own brief explicitly says Design showing the Dialog
      // as ordinary inline/non-modal content, while only Preview uses the
      // real top-layer/edge-anchored presentation, is an already-accepted
      // difference, not something to make WYSIWYG-perfect. Confirmed live
      // during this checkpoint's own QA that spreading an authored
      // `position: fixed; inset: 0 auto 0 0` unconditionally (matching
      // every other element) makes a real Drawer's own Dialog float fixed
      // over the ENTIRE viewport in Design too — physically covering the
      // app's own toolbar chrome, making it unclickable. Gating this
      // resolver's own spread on `isPreview` keeps Design's dialog exactly
      // where the `position: static` restoration above already puts it —
      // an ordinary, fully editable, in-flow box — and defers the
      // authored Position entirely to Preview, the only mode where a
      // Dialog's own CSS position is ever actually meaningful (native
      // top-layer promotion). Generic to Dialog, not Drawer: any future
      // composition that authors Position on a Dialog gets the same
      // Design-safe behavior with no per-composition code.
      ...(isPreview ? resolvePositionStyle(node) : {}),
      ...elementPositionStyle(node, context.parentLayoutMode),
      ...(isPreview && hasExplicitPosition ? { height: "auto" as const } : {}),
      ...resolveAspectRatioStyle(node),
      ...resolveFlexOrGridChildStyle(node, context.parentFlowDisplay),
      ...resolveSizeConstraintsStyle(node, context.parentLayoutMode),
      ...resolveBackgroundStyle(node),
      ...effectStyles(node, isPreview),
    },
  };
}
