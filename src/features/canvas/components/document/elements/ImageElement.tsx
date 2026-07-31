"use client";

import { Image as ImageIcon } from "lucide-react";
import { useNodeDragSource } from "@/features/canvas/hooks/useNodeDragSource";
import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { elementPositionStyle } from "@/features/canvas/utils/elementDimensionsStyle";
import { resolveBorderRadiusStyle } from "@/features/canvas/utils/resolveBorderRadiusStyle";
import { resolveBorderStyle } from "@/features/canvas/utils/resolveBorderStyle";
import { resolveBoxShadowStyle } from "@/features/canvas/utils/resolveBoxShadowStyle";
import { resolveFilterStyle } from "@/features/canvas/utils/resolveFilterStyle";
import { resolveFlexOrGridChildStyle } from "@/features/canvas/utils/resolveFlexOrGridChildStyle";
import { resolveMediaFitStyle } from "@/features/canvas/utils/resolveMediaFitStyle";
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

  // The dashed placeholder border predates real border data (Checkpoint
  // 4.4) — pure editor chrome marking this as an editable image box, even
  // once a real image is chosen. Once the node has explicit border
  // settings, that chrome must get out of the way entirely (see the
  // identical rationale on ContainerElement) so it never bleeds through
  // as a phantom border on whichever sides the user didn't configure.
  const usesLegacyBorderChrome = !node.border;
  // Same rationale as ContainerElement's usesLegacyRadiusChrome — the
  // default "rounded-md" placeholder rounding must get out of the way
  // entirely once real radius data exists, not just on whichever corners
  // happen to be configured.
  const usesLegacyRadiusChrome = !node.borderRadius;

  return (
    <div
      ref={mergeRefs(dropRef, dragRef)}
      {...documentNodeAttributes(node, parentId)}
      className={cn(
        "flex h-40 w-full items-center justify-center overflow-hidden bg-zinc-50 dark:bg-zinc-900",
        usesLegacyRadiusChrome && "rounded-md",
        usesLegacyBorderChrome && "border border-dashed border-zinc-200 dark:border-zinc-800",
        isDragging && "opacity-40",
      )}
      style={{
        ...elementPositionStyle(node, parentLayoutMode),
        ...resolveFlexOrGridChildStyle(node, parentFlowDisplay),
        ...resolveBorderStyle(node),
        ...resolveBorderRadiusStyle(node),
        ...resolveBoxShadowStyle(node),
        ...resolveFilterStyle(node),
      }}
      {...listeners}
    >
      {node.src ? (
        // eslint-disable-next-line @next/next/no-img-element -- this renders arbitrary, dynamically-sized user document content (mirroring the export feature's plain HTML output), not a build-known app asset next/image could optimize.
        <img src={node.src} alt={node.displayName ?? ""} style={resolveMediaFitStyle(node)} />
      ) : (
        <ImageIcon aria-hidden="true" className="size-8 text-zinc-300 dark:text-zinc-700" />
      )}
    </div>
  );
}
