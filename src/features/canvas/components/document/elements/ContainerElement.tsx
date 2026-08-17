"use client";

import { useNodeDragSource } from "@/features/canvas/hooks/useNodeDragSource";
import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { elementPositionStyle } from "@/features/canvas/utils/elementDimensionsStyle";
import { resolveBackgroundStyle } from "@/features/canvas/utils/resolveBackgroundStyle";
import { resolveBorderRadiusStyle } from "@/features/canvas/utils/resolveBorderRadiusStyle";
import { resolveBorderStyle } from "@/features/canvas/utils/resolveBorderStyle";
import { resolveBoxShadowStyle } from "@/features/canvas/utils/resolveBoxShadowStyle";
import { resolveAspectRatioStyle } from "@/features/canvas/utils/resolveAspectRatioStyle";
import { resolveDisplayStyle } from "@/features/canvas/utils/resolveDisplayStyle";
import { resolveFilterStyle } from "@/features/canvas/utils/resolveFilterStyle";
import { resolveFlexOrGridChildStyle } from "@/features/canvas/utils/resolveFlexOrGridChildStyle";
import { resolveFlowLayoutStyle } from "@/features/canvas/utils/resolveFlowLayoutStyle";
import { resolvePositionStyle } from "@/features/canvas/utils/resolvePositionStyle";
import { resolveSizeConstraintsStyle } from "@/features/canvas/utils/resolveSizeConstraintsStyle";
import { cn, mergeRefs } from "@/lib/utils";
import { getLayoutMode } from "@/features/editor/types/layout";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

export function ContainerElement({
  node,
  parentId,
  parentLayoutMode,
  parentFlowDisplay,
  children,
}: DocumentElementProps) {
  const dropRef = useNodeDropRegistration(node);
  const { setNodeRef: dragRef, listeners, isDragging } = useNodeDragSource(node, parentLayoutMode);

  const isFreeChild = parentLayoutMode === "free";
  const ownLayoutMode = getLayoutMode(node);
  // A Free child already renders position: absolute (see freeChildStyle),
  // which already qualifies it as a containing block for its own
  // absolutely-positioned Free children — position: relative is only
  // needed to establish that when this container isn't itself a Free
  // child (otherwise flow's default position: static would let its Free
  // children's left/top resolve against some ancestor further up instead
  // of this container).
  const hostsOwnFreeChildren = ownLayoutMode === "free" && !isFreeChild;

  // A node with no explicit flowLayout/spacing predates Checkpoint 3.5 —
  // the Tailwind classes below (originally this app's only container
  // presentation) are its fallback, kept byte-for-byte so nothing already
  // built or tested regresses. Once a container has an explicit
  // flowLayout (every newly created one — see elementFactories.ts) or
  // spacing, the data-driven inline styles below take over instead.
  const usesLegacyFlexClasses = !node.flowLayout;
  const usesLegacyPadding = !node.spacing;
  // The faint "border border-zinc-100" class below predates real border
  // data (Checkpoint 4.4) — pure editor chrome so an empty container
  // still reads as a box in the builder. Once a node has explicit border
  // settings, this chrome must get out of the way entirely (not just on
  // whichever sides happen to be configured), so an "Individual Sides"
  // border on only one edge doesn't leave the other three showing a
  // phantom chrome border that looks like real, if very faint, data.
  const usesLegacyBorderChrome = !node.border;
  // The "rounded-lg" class below is the same kind of pre-4.5 editor
  // chrome as the border classes above — a default cosmetic corner
  // rounding with no relation to real radius data. Gated the same way,
  // for the same reason: left ungated, an "Individual Corners" radius on
  // only one corner would leave the other three still showing this
  // default rounding, indistinguishable from real (if coincidentally
  // identical) data.
  const usesLegacyRadiusChrome = !node.borderRadius;

  // Container (div) and Section (section) are the two tags registered to
  // this component (see documentNodeComponents.ts) — both share every
  // style/behavior below and differ only in semantic DOM identity, so the
  // real element tag is chosen from the document node rather than
  // hardcoded, keeping generated markup a genuine <section> instead of a
  // <div> standing in for one.
  const Tag = node.tag === "section" ? "section" : "div";

  return (
    <Tag
      ref={mergeRefs<HTMLElement>(dropRef, dragRef)}
      {...documentNodeAttributes(node, parentId)}
      className={cn(
        usesLegacyRadiusChrome && "rounded-lg",
        usesLegacyBorderChrome && "border border-zinc-100 dark:border-zinc-900",
        usesLegacyFlexClasses && "flex flex-col items-start gap-4",
        usesLegacyPadding && "p-8",
        isDragging && "opacity-40",
      )}
      style={{
        // resolvePositionStyle spread first, and both elementPositionStyle
        // and the hostsOwnFreeChildren override after (Checkpoint 5.1) — a
        // Free child's own position: absolute (via elementPositionStyle)
        // and a Free-hosting container's own position: relative (right
        // below) must always win over this checkpoint's general Position
        // control; see types/position.ts's own doc comment for the full
        // ownership conflict this resolves.
        ...resolvePositionStyle(node),
        ...elementPositionStyle(node, parentLayoutMode),
        ...resolveAspectRatioStyle(node),
        ...resolveFlexOrGridChildStyle(node, parentFlowDisplay),
        // Spread AFTER resolveFlexOrGridChildStyle deliberately (Checkpoint
        // 5.7) — see HeadingElement's identical comment for the full
        // reasoning (an explicit user min-width/min-height must win over
        // that resolver's own Flex/Grid containment default of 0).
        ...resolveSizeConstraintsStyle(node, parentLayoutMode),
        ...(ownLayoutMode === "flow" ? resolveFlowLayoutStyle(node) : undefined),
        ...(hostsOwnFreeChildren ? { position: "relative" } : {}),
        ...resolveBackgroundStyle(node),
        ...resolveBorderStyle(node),
        ...resolveBorderRadiusStyle(node),
        ...resolveBoxShadowStyle(node),
        ...resolveFilterStyle(node),
        ...resolveDisplayStyle(node),
      }}
      {...listeners}
    >
      {children}
    </Tag>
  );
}
