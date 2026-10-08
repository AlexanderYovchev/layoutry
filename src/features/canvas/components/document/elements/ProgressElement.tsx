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
import { getProgressMax, getProgressValue } from "@/features/editor/types/progress";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { cn, mergeRefs } from "@/lib/utils";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

/**
 * Progress (Checkpoint 1.15.6.12.4) — a genuine `<progress>`, not a styled
 * `<div>` standing in for one. Closest in shape to DividerElement, not
 * Image/Video/Audio/Iframe's own wrapper-plus-inner-native-element split:
 * Progress has no interactive native controls to shield (no play/pause/
 * seek, no embedded document), no Media Fit concept, and — confirmed live
 * this checkpoint via Chromium screenshots — its own rendered bar always
 * fills whatever box it's given on BOTH axes with no fixed intrinsic
 * footprint the way Audio's control bar has, so there is no "wrapper
 * reveals empty space" case that would justify a separate layout box
 * either. `canContainChildren("progress")` is false (not in
 * CONTAINER_TAGS) and "progress" is not in TEXT_BEARING_TAGS, so this is a
 * genuine leaf with neither a children prop nor `useEditableText`,
 * rendering as the outer layout box directly.
 *
 * NATIVE STYLE HANDLING — verified directly against Tailwind's own
 * preflight.css (not assumed): the only progress-specific Preflight rule
 * is `progress { vertical-align: baseline; }` — no width/height/border
 * reset beyond the universal `*, ::before, ::after, ::backdrop,
 * ::file-selector-button { margin: 0; padding: 0; border: 0 solid; }`
 * every element already gets. No capability override was needed in
 * elementCapabilities.ts: "progress" is neither a container nor
 * text-bearing, so DEFAULT_CAPABILITIES' own border/border-radius/
 * box-shadow/filters/display/position/aspect-ratio-and-sizing/resize
 * defaults are exactly right with zero entries — the same "nothing else
 * needs an override" shape Divider's own entry (or lack of one)
 * established, confirmed live: a real Chromium screenshot this checkpoint
 * (border:4px solid blue, border-radius:12px, opacity:0.5, all applied)
 * showed border/border-radius/opacity all visibly take effect on the real
 * element. `supportsBackground` deliberately stays at its DEFAULT_CAPABILITIES
 * false (Progress is neither a container nor text-bearing, so no override
 * was added either way) — also confirmed live: Chromium's own native
 * track/fill pseudo-elements fully occlude an authored `background`, the
 * same "own rendered content already fills the box" reasoning Video/img's
 * own exclusion already documents, just independently re-verified here
 * rather than assumed by analogy.
 */
export function ProgressElement({ node, parentId, parentLayoutMode, parentFlowDisplay }: DocumentElementProps) {
  const dropRef = useNodeDropRegistration(node);
  const { setNodeRef: dragRef, listeners, isDragging } = useNodeDragSource(node, parentLayoutMode);
  const isPreview = useEditorStore((state) => state.editorMode === "preview");

  return (
    <progress
      id={node.htmlId}
      ref={mergeRefs<HTMLElement>(dropRef, dragRef)}
      {...documentNodeAttributes(node, parentId)}
      value={getProgressValue(node)}
      max={getProgressMax(node)}
      className={cn(isDragging && "opacity-40", node.className)}
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
