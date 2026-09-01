"use client";

import { Image as ImageIcon } from "lucide-react";
import { useNodeDragSource } from "@/features/canvas/hooks/useNodeDragSource";
import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
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
import { resolveMediaFitStyle } from "@/features/canvas/utils/resolveMediaFitStyle";
import { resolvePositionStyle } from "@/features/canvas/utils/resolvePositionStyle";
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
  // The default placeholder height (h-40) predates Aspect Ratio
  // (Checkpoint 5.5) and unconditionally fixed this wrapper's height —
  // CSS aspect-ratio only influences a box's shape when at least one
  // dimension isn't already fixed by something else, so a fixed h-40
  // silently blocked an explicit ratio-mode aspect ratio from ever
  // visibly reshaping an unresized Image (it kept rendering at h-40's
  // fixed 160px height regardless of the chosen ratio). Found via
  // Checkpoint 5.6's own real-browser verification of Aspect Ratio +
  // Object Fit combinations. Same "legacy chrome gets out of the way
  // once real data exists" rule as usesLegacyBorderChrome/
  // usesLegacyRadiusChrome above — an explicit resize already overrides
  // this class via elementDimensionsStyle's own inline height regardless,
  // so this only needs to key off aspectRatio.
  const usesLegacyHeightChrome = node.aspectRatio?.mode !== "ratio";

  return (
    <div
      ref={mergeRefs(dropRef, dragRef)}
      {...documentNodeAttributes(node, parentId)}
      className={cn(
        "flex w-full items-center justify-center overflow-hidden bg-zinc-50 dark:bg-zinc-900",
        usesLegacyHeightChrome && "h-40",
        usesLegacyRadiusChrome && "rounded-md",
        usesLegacyBorderChrome && "border border-dashed border-zinc-200 dark:border-zinc-800",
        isDragging && "opacity-40",
      )}
      style={{
        // resolvePositionStyle spread first, and elementPositionStyle after
        // (Checkpoint 5.1) — a Free child's own position: absolute (see
        // freeChildStyle, applied inside elementPositionStyle) must always
        // win over this checkpoint's general Position control; see
        // types/position.ts's own doc comment for the full ownership
        // conflict this resolves.
        ...resolvePositionStyle(node),
        ...elementPositionStyle(node, parentLayoutMode),
        ...resolveAspectRatioStyle(node),
        ...resolveFlexOrGridChildStyle(node, parentFlowDisplay),
        // Spread AFTER resolveFlexOrGridChildStyle deliberately (Checkpoint
        // 5.7) — see HeadingElement's identical comment for the full
        // reasoning (an explicit user min-width/min-height must win over
        // that resolver's own Flex/Grid containment default of 0).
        ...resolveSizeConstraintsStyle(node, parentLayoutMode),
        ...resolveBorderStyle(node),
        ...resolveBorderRadiusStyle(node),
        ...resolveBoxShadowStyle(node),
        ...resolveFilterStyle(node),
        ...resolveDisplayStyle(node),
      }}
      {...listeners}
    >
      {node.src ? (
        // eslint-disable-next-line @next/next/no-img-element -- this renders arbitrary, dynamically-sized user document content (mirroring the export feature's plain HTML output), not a build-known app asset next/image could optimize.
        <img
          src={node.src}
          alt={node.displayName ?? ""}
          id={node.htmlId}
          className={node.className}
          style={resolveMediaFitStyle(node)}
        />
      ) : (
        <ImageIcon aria-hidden="true" className="size-8 text-zinc-300 dark:text-zinc-700" />
      )}
    </div>
  );
}
