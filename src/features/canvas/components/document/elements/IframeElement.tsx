"use client";

import { useNodeDragSource } from "@/features/canvas/hooks/useNodeDragSource";
import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
import { MediaInteractionShield } from "@/features/canvas/components/document/elements/MediaInteractionShield";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { elementPositionStyle } from "@/features/canvas/utils/elementDimensionsStyle";
import { resolveAspectRatioStyle } from "@/features/canvas/utils/resolveAspectRatioStyle";
import { resolveSizeConstraintsStyle } from "@/features/canvas/utils/resolveSizeConstraintsStyle";
import { resolveBorderRadiusStyle } from "@/features/canvas/utils/resolveBorderRadiusStyle";
import { resolveBorderStyle } from "@/features/canvas/utils/resolveBorderStyle";
import { resolveBoxShadowStyle } from "@/features/canvas/utils/resolveBoxShadowStyle";
import { resolveDisplayStyle } from "@/features/canvas/utils/resolveDisplayStyle";
import { resolveFilterStyle } from "@/features/canvas/utils/resolveFilterStyle";
import { resolveFlexOrGridChildStyle } from "@/features/canvas/utils/resolveFlexOrGridChildStyle";
import { resolvePositionStyle } from "@/features/canvas/utils/resolvePositionStyle";
import { resolveTransitionStyle } from "@/features/canvas/utils/resolveTransitionStyle";
import { resolveTransformStyle } from "@/features/canvas/utils/resolveTransformStyle";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { cn, mergeRefs } from "@/lib/utils";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

/**
 * The same outer-wrapper/inner-native-element ownership Image/Video
 * already use — the outer div is the layout box; the inner `<iframe>` is
 * a genuine, unfaked native element (real `src`/`title`, never a `<div>`
 * standing in for one). Deliberately does NOT resolve object-fit/object-
 * position onto the inner iframe (see elementCapabilities.ts's own
 * iframe doc comment for why that CSS has no effect on an iframe's own
 * embedded document) — the inner element just fills its wrapper's box
 * via plain width/height: 100%, with `border: 0` to neutralize the
 * `<iframe>` tag's own historical default border (the outer wrapper is
 * what owns the visible border via resolveBorderStyle; img/video never
 * needed this since neither has a native default border to override).
 *
 * A MediaInteractionShield is not optional here the way it's a defensive
 * safety net for Video — it is REQUIRED: an embedded page has its own,
 * entirely separate document, and clicks landing on its rendered content
 * never bubble into the PARENT document's event listeners at all (browser
 * security/isolation, not a Layoutry gap). Without this shield, Canvas
 * selection would be unreachable the instant the pointer entered any
 * interactive iframe content — see this checkpoint's report, section H.
 */
export function IframeElement({ node, parentId, parentLayoutMode, parentFlowDisplay }: DocumentElementProps) {
  const dropRef = useNodeDropRegistration(node);
  const { setNodeRef: dragRef, listeners, isDragging } = useNodeDragSource(node, parentLayoutMode);
  const isPreview = useEditorStore((state) => state.editorMode === "preview");

  const usesLegacyBorderChrome = !node.border;
  const usesLegacyRadiusChrome = !node.borderRadius;
  const usesLegacyHeightChrome = node.aspectRatio?.mode !== "ratio";

  return (
    <div
      ref={mergeRefs(dropRef, dragRef)}
      {...documentNodeAttributes(node, parentId)}
      className={cn(
        "w-full overflow-hidden bg-zinc-50 dark:bg-zinc-900",
        usesLegacyHeightChrome && "h-40",
        usesLegacyRadiusChrome && "rounded-md",
        usesLegacyBorderChrome && "border border-dashed border-zinc-200 dark:border-zinc-800",
        isDragging && "opacity-40",
      )}
      style={{
        position: "relative",
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
    >
      <iframe
        src={node.src}
        title={node.title}
        id={node.htmlId}
        className={node.className}
        style={{ width: "100%", height: "100%", border: 0, display: "block" }}
      />
      <MediaInteractionShield />
    </div>
  );
}
