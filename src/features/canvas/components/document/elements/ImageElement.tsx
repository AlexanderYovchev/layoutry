"use client";

import { Image as ImageIcon } from "lucide-react";
import { useNodeDragSource } from "@/features/canvas/hooks/useNodeDragSource";
import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { documentDefaultClasses } from "@/features/canvas/utils/documentDefaultStyles";
import { resolveImageElementStyle } from "@/features/canvas/utils/elementStyleRecipes";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { cn, mergeRefs } from "@/lib/utils";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

/**
 * The *outer* div is the layout box: it participates in Flow/Free/Flex/
 * Grid exactly like any other element (elementPositionStyle +
 * resolveFlexOrGridChildStyle), and is what Selection/ResizeOverlay track
 * — a Grid/Flex child is deliberately stretched to fill its track/cell
 * for containment (see resolveFlexOrGridChildStyle), so this box's own
 * size is never constrained by the image's intrinsic ratio.
 *
 * The *inner* <img> is the visual content: resolveMediaFitStyle applies
 * object-fit/object-position so the picture's own proportions are
 * preserved within whatever size the outer box ends up being, instead of
 * stretching to match it. A node with no src yet (this app has no asset
 * picker) falls back to the original icon-only placeholder — matches the
 * pattern most visual builders use before an asset is chosen.
 */
export function ImageElement({ node, parentId, parentLayoutMode, parentFlowDisplay }: DocumentElementProps) {
  const dropRef = useNodeDropRegistration(node);
  const { setNodeRef: dragRef, listeners, isDragging } = useNodeDragSource(node, parentLayoutMode);
  const isPreview = useEditorStore((state) => state.editorMode === "preview");
  const recipe = resolveImageElementStyle(node, { parentLayoutMode, parentFlowDisplay, isPreview });

  return (
    <div
      ref={mergeRefs(dropRef, dragRef)}
      {...documentNodeAttributes(node, parentId)}
      className={cn(documentDefaultClasses(recipe.defaults), isDragging && "opacity-40")}
      style={recipe.style}
      {...listeners}
    >
      {node.src ? (
        // eslint-disable-next-line @next/next/no-img-element -- this renders arbitrary, dynamically-sized user document content (mirroring the export feature's plain HTML output), not a build-known app asset next/image could optimize.
        <img
          src={node.src}
          alt={node.displayName ?? ""}
          id={node.htmlId}
          className={node.className}
          style={recipe.innerStyle}
        />
      ) : (
        <ImageIcon aria-hidden="true" className="size-8 text-zinc-300 dark:text-zinc-700" />
      )}
    </div>
  );
}
