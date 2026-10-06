"use client";

import { useNodeDragSource } from "@/features/canvas/hooks/useNodeDragSource";
import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
import { MediaInteractionShield } from "@/features/canvas/components/document/elements/MediaInteractionShield";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { elementPositionStyle } from "@/features/canvas/utils/elementDimensionsStyle";
import { resolveBackgroundStyle } from "@/features/canvas/utils/resolveBackgroundStyle";
import { resolveSizeConstraintsStyle } from "@/features/canvas/utils/resolveSizeConstraintsStyle";
import { resolveBorderRadiusStyle } from "@/features/canvas/utils/resolveBorderRadiusStyle";
import { resolveBorderStyle } from "@/features/canvas/utils/resolveBorderStyle";
import { resolveBoxShadowStyle } from "@/features/canvas/utils/resolveBoxShadowStyle";
import { resolveDisplayStyle } from "@/features/canvas/utils/resolveDisplayStyle";
import { resolveFilterStyle } from "@/features/canvas/utils/resolveFilterStyle";
import { resolveFlexOrGridChildStyle } from "@/features/canvas/utils/resolveFlexOrGridChildStyle";
import { resolvePositionStyle } from "@/features/canvas/utils/resolvePositionStyle";
import { resolveTransitionStyle } from "@/features/canvas/utils/resolveTransitionStyle";
import { getMediaControls } from "@/features/editor/types/video";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { cn, mergeRefs } from "@/lib/utils";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

/**
 * The same outer-wrapper/inner-native-element ownership Image/Video/
 * Iframe already use (Checkpoint 1.15.6.12.3) — the outer div is the
 * layout box (geometry/position/resize/Flow-Flex-Grid participation), the
 * inner `<audio>` is the real, genuine native element (real `src`/
 * `controls`/`autoplay`/`muted`/`loop`, never a faked player UI — no
 * `<source>`/`<track>` children, no custom playback widget).
 *
 * No resolveMediaFitStyle/resolveAspectRatioStyle here, unlike Video —
 * audio has no visual replaced content for object-fit to apply to, and no
 * intrinsic ratio worth locking (see elementCapabilities.ts's own audio
 * doc comment: supportsMediaFit/supportsIntrinsicAspectRatio both stay at
 * their default false, no override). The inner `<audio>` still fills its
 * wrapper via plain width/height: 100% (not resolveMediaFitStyle, which
 * also carries object-fit/object-position — meaningless, not just unused,
 * on a tag with no visual content to fit).
 *
 * `resolveBackgroundStyle` IS spread on the wrapper here, unlike Video/
 * Iframe — confirmed live this checkpoint (Chromium screenshot): a native
 * `<audio controls>` bar keeps its own fixed ~54px intrinsic height
 * regardless of how tall its box is stretched (bottom-anchored, never
 * distorted taller), so a wrapper resized beyond that height genuinely
 * reveals empty space above the control bar — a real, visible background
 * use case Video/img never have (their own content always fills the
 * entire box via object-fit).
 *
 * Fallback height (`usesLegacyHeightChrome`) is `h-13.5` (54px), not Video's
 * `h-40` (160px) — measured directly against a real Chromium
 * `<audio controls>` with no explicit size (300×54, the browser's own
 * intrinsic default), not assumed; a 160px-tall empty-ish bar would be a
 * poor, oversized starting point for a control that is naturally this
 * short. Default Free-layout size (DEFAULT_FREE_ELEMENT_SIZE.audio) uses
 * the exact same measured 300×54.
 *
 * `autoPlay` is gated on `isPreview` exactly like VideoElement's own
 * fix this same checkpoint applies — see that component's doc comment for
 * the full Design-mode-safety reasoning, identical here.
 *
 * A MediaInteractionShield sits after the `<audio>` in DOM order, exactly
 * like Video's own — renders nothing in Preview (see that component's own
 * doc comment for the live Chromium proof this checkpoint found and fixed
 * generically), which is what makes Audio's native controls genuinely
 * interactive once Preview begins.
 */
export function AudioElement({ node, parentId, parentLayoutMode, parentFlowDisplay }: DocumentElementProps) {
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
        usesLegacyHeightChrome && "h-13.5",
        usesLegacyRadiusChrome && "rounded-md",
        usesLegacyBorderChrome && "border border-dashed border-zinc-200 dark:border-zinc-800",
        isDragging && "opacity-40",
      )}
      style={{
        position: "relative",
        ...resolvePositionStyle(node),
        ...elementPositionStyle(node, parentLayoutMode),
        ...resolveFlexOrGridChildStyle(node, parentFlowDisplay),
        ...resolveSizeConstraintsStyle(node, parentLayoutMode),
        ...resolveBackgroundStyle(node),
        ...resolveBorderStyle(node),
        ...resolveBorderRadiusStyle(node),
        ...resolveBoxShadowStyle(node),
        ...resolveFilterStyle(node),
        ...resolveTransitionStyle(node, isPreview),
        ...resolveDisplayStyle(node),
      }}
      {...listeners}
    >
      <audio
        src={node.src}
        controls={getMediaControls(node)}
        autoPlay={isPreview && !!node.autoplay}
        muted={node.muted}
        loop={node.loop}
        id={node.htmlId}
        className={node.className}
        style={{ width: "100%", height: "100%" }}
      />
      <MediaInteractionShield />
    </div>
  );
}
