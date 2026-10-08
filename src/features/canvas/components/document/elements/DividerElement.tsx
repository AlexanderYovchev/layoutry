"use client";

import { useNodeDragSource } from "@/features/canvas/hooks/useNodeDragSource";
import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { elementPositionStyle } from "@/features/canvas/utils/elementDimensionsStyle";
import { resolveAspectRatioStyle } from "@/features/canvas/utils/resolveAspectRatioStyle";
import { resolveBorderRadiusStyle } from "@/features/canvas/utils/resolveBorderRadiusStyle";
import { resolveBorderStyle } from "@/features/canvas/utils/resolveBorderStyle";
import { resolveBoxShadowStyle } from "@/features/canvas/utils/resolveBoxShadowStyle";
import { resolveDisplayStyle } from "@/features/canvas/utils/resolveDisplayStyle";
import { resolveFilterStyle } from "@/features/canvas/utils/resolveFilterStyle";
import { resolveFlexOrGridChildStyle } from "@/features/canvas/utils/resolveFlexOrGridChildStyle";
import { resolvePositionStyle } from "@/features/canvas/utils/resolvePositionStyle";
import { resolveSizeConstraintsStyle } from "@/features/canvas/utils/resolveSizeConstraintsStyle";
import { resolveTransitionStyle } from "@/features/canvas/utils/resolveTransitionStyle";
import { resolveTransformStyle } from "@/features/canvas/utils/resolveTransformStyle";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { cn, mergeRefs } from "@/lib/utils";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

/**
 * Divider (Checkpoint 1.15.6.12.1) — a genuine `<hr>`, not a styled `<div>`
 * standing in for one. No children slot, no text: `canContainChildren("hr")`
 * is false (not in CONTAINER_TAGS) and "hr" is not in TEXT_BEARING_TAGS, so
 * this is the app's first leaf renderer with neither a children prop nor
 * `useEditableText` — closest in shape to ImageElement, but without that
 * component's own wrapper-plus-inner-content split: `<hr>` IS its own
 * visual content (drawn entirely by CSS border/background), so it renders
 * as the outer layout box directly, the same "native tag rendered as its
 * own box" shape DialogElement/HeadingElement already use.
 *
 * NATIVE STYLE HANDLING — verified directly against Tailwind's own
 * preflight.css (not assumed): the universal `*, ::before, ::after,
 * ::backdrop, ::file-selector-button { margin: 0; padding: 0; border: 0
 * solid; }` reset already zeroes every side's border-width (and margin) on
 * `<hr>` like every other element, and Preflight's own dedicated `hr {
 * height: 0; color: inherit; border-top-width: 1px; }` rule (more specific,
 * cascades after the universal reset) restores exactly a 1px solid top
 * border and a 0 own-height box — meaning a completely UNSTYLED `<hr>` in
 * this app already renders as a real, visible divider line, not an
 * invisible collapsed box. usesLegacyBorderChrome only replaces Preflight's
 * own `border-color: currentColor` (which would render in whatever text
 * color happens to be inherited) with a proper neutral gray, the same
 * "sensible default appearance only until real authored Border data
 * exists" role ImageElement/ContainerElement's own usesLegacyBorderChrome
 * already plays — once real Border data exists, resolveBorderStyle alone
 * governs and this class gets out of the way entirely. No capability
 * override was needed in elementCapabilities.ts: "hr" is neither a
 * container nor text-bearing, so DEFAULT_CAPABILITIES' own border/border-
 * radius/box-shadow/filters/display/position/aspect-ratio-and-sizing
 * defaults (already true for any unlisted tag) are exactly right with zero
 * entries, the same "nothing else needs an override" shape Iframe/Svg's
 * own minimal entries already established.
 */
export function DividerElement({ node, parentId, parentLayoutMode, parentFlowDisplay }: DocumentElementProps) {
  const dropRef = useNodeDropRegistration(node);
  const { setNodeRef: dragRef, listeners, isDragging } = useNodeDragSource(node, parentLayoutMode);
  const isPreview = useEditorStore((state) => state.editorMode === "preview");

  const usesLegacyBorderChrome = !node.border;

  return (
    <hr
      id={node.htmlId}
      ref={mergeRefs<HTMLElement>(dropRef, dragRef)}
      {...documentNodeAttributes(node, parentId)}
      className={cn(
        usesLegacyBorderChrome && "border-zinc-200 dark:border-zinc-800",
        isDragging && "opacity-40",
        node.className,
      )}
      style={{
        ...resolvePositionStyle(node),
        ...elementPositionStyle(node, parentLayoutMode),
        ...resolveAspectRatioStyle(node),
        ...resolveFlexOrGridChildStyle(node, parentFlowDisplay),
        ...resolveSizeConstraintsStyle(node, parentLayoutMode),
        ...resolveBorderStyle(node),
        ...resolveBorderRadiusStyle(node),
        ...resolveBoxShadowStyle(node),
        ...resolveFilterStyle(node),
        ...resolveTransitionStyle(node, isPreview),
        ...resolveTransformStyle(node),
        ...resolveDisplayStyle(node),
      }}
      {...listeners}
    />
  );
}
