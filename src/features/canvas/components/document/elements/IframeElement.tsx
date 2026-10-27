"use client";

import { useNodeDragSource } from "@/features/canvas/hooks/useNodeDragSource";
import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
import { MediaInteractionShield } from "@/features/canvas/components/document/elements/MediaInteractionShield";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { documentDefaultClasses } from "@/features/canvas/utils/documentDefaultStyles";
import { resolveVideoOrIframeElementStyle } from "@/features/canvas/utils/elementStyleRecipes";
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
  const recipe = resolveVideoOrIframeElementStyle(node, { parentLayoutMode, parentFlowDisplay, isPreview });

  return (
    <div
      ref={mergeRefs(dropRef, dragRef)}
      {...documentNodeAttributes(node, parentId)}
      className={cn(documentDefaultClasses(recipe.defaults), isDragging && "opacity-40")}
      style={recipe.style}
      {...listeners}
    >
      <iframe
        src={node.src}
        title={node.title}
        id={node.htmlId}
        className={node.className}
        style={recipe.innerStyle}
      />
      <MediaInteractionShield />
    </div>
  );
}
