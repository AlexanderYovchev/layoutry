"use client";

import { useNodeDragSource } from "@/features/canvas/hooks/useNodeDragSource";
import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
import { MediaInteractionShield } from "@/features/canvas/components/document/elements/MediaInteractionShield";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { documentDefaultClasses } from "@/features/canvas/utils/documentDefaultStyles";
import { resolveVideoOrIframeElementStyle } from "@/features/canvas/utils/elementStyleRecipes";
import { getMediaControls } from "@/features/editor/types/video";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { cn, mergeRefs } from "@/lib/utils";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

/**
 * Same outer-wrapper/inner-native-element ownership Image already
 * established (Checkpoint 5.6, reused here per this checkpoint's own
 * brief) — the *outer* div is the layout box (geometry/position/resize/
 * Flow-Flex-Grid participation; what Selection/ResizeOverlay track), the
 * *inner* `<video>` is the real native element, genuine and unfaked (see
 * this checkpoint's report, section D — a real `<video>` with real
 * attributes, never a screenshot/placeholder standing in for it), with
 * resolveMediaFitStyle applying object-fit/object-position so its own
 * proportions are preserved within whatever size the outer box ends up
 * being. `overflow-hidden` on the wrapper (matching ImageElement exactly)
 * is what actually makes border-radius reliably clip video content —
 * relying on the `<video>` tag's own border-radius is a well-known
 * cross-browser gotcha with composited video layers.
 *
 * A MediaInteractionShield sits after the `<video>` in DOM order (see its
 * own doc comment) so normal Canvas selection/drag never accidentally
 * triggers native play/pause/seek/volume/fullscreen — verified live, not
 * assumed (this checkpoint's own report, section G), since `<video
 * controls>` renders browser-native shadow-DOM chrome that a simple
 * preventDefault on the video element itself cannot reliably suppress
 * across browsers. The shield itself now renders nothing in Preview
 * (Checkpoint 1.15.6.12.3 fixed this generically — see
 * MediaInteractionShield's own doc comment), so this exact same element
 * is also what makes the native controls genuinely interactive once
 * Preview begins.
 *
 * `autoPlay` is gated on `isPreview` (Checkpoint 1.15.6.12.3) — a real,
 * pre-existing Design-mode safety gap this checkpoint's own Audio brief
 * asked to be investigated: an authored `autoplay: true` was previously
 * passed to the native element completely unconditionally, in both
 * modes, with nothing in this component (or anywhere else) suppressing
 * it while designing. The authored `node.autoplay` field itself is
 * completely unaffected by this — still fully editable, still preserved
 * through duplication/undo/redo — only the attribute actually handed to
 * the DOM element is now conditioned on mode, the same isPreview-gated-
 * render-time-attribute shape DialogElement already established for a
 * different field.
 */
export function VideoElement({ node, parentId, parentLayoutMode, parentFlowDisplay }: DocumentElementProps) {
  const dropRef = useNodeDropRegistration(node);
  const { setNodeRef: dragRef, listeners, isDragging } = useNodeDragSource(node, parentLayoutMode);
  const isPreview = useEditorStore((state) => state.editorMode === "preview");
  const recipe = resolveVideoOrIframeElementStyle(node, { parentLayoutMode, parentFlowDisplay, isPreview });

  return (
    <div
      ref={mergeRefs(dropRef, dragRef)}
      {...documentNodeAttributes(node, parentId)}
      className={cn(documentDefaultClasses(recipe.defaults), isDragging && "opacity-40")}
      style={recipe.style}
      {...listeners}
    >
      <video
        src={node.src}
        poster={node.poster}
        controls={getMediaControls(node)}
        autoPlay={isPreview && !!node.autoplay}
        muted={node.muted}
        loop={node.loop}
        id={node.htmlId}
        className={node.className}
        style={recipe.innerStyle}
      />
      <MediaInteractionShield />
    </div>
  );
}
