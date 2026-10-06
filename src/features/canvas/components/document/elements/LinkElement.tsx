"use client";

import type { MouseEvent as ReactMouseEvent } from "react";
import { useEditableText } from "@/features/canvas/hooks/useEditableText";
import { useNodeDragSource } from "@/features/canvas/hooks/useNodeDragSource";
import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { elementPositionStyle } from "@/features/canvas/utils/elementDimensionsStyle";
import { resolveBackgroundStyle } from "@/features/canvas/utils/resolveBackgroundStyle";
import { resolveBorderRadiusStyle } from "@/features/canvas/utils/resolveBorderRadiusStyle";
import { resolveBorderStyle } from "@/features/canvas/utils/resolveBorderStyle";
import { resolveBoxShadowStyle } from "@/features/canvas/utils/resolveBoxShadowStyle";
import { resolveAspectRatioStyle } from "@/features/canvas/utils/resolveAspectRatioStyle";
import { resolveSizeConstraintsStyle } from "@/features/canvas/utils/resolveSizeConstraintsStyle";
import { resolveDisplayStyle } from "@/features/canvas/utils/resolveDisplayStyle";
import { resolveFilterStyle } from "@/features/canvas/utils/resolveFilterStyle";
import { resolveFlexOrGridChildStyle } from "@/features/canvas/utils/resolveFlexOrGridChildStyle";
import { resolvePositionStyle } from "@/features/canvas/utils/resolvePositionStyle";
import { resolveTransitionStyle } from "@/features/canvas/utils/resolveTransitionStyle";
import { resolveTypographyStyle } from "@/features/canvas/utils/resolveTypographyStyle";
import { getLinkHref } from "@/features/editor/types/link";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { cn, mergeRefs } from "@/lib/utils";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

/**
 * Genuine navigation is never appropriate while designing a page —
 * clicking a Link on the Canvas must select/edit it, not carry the
 * whole Layoutry app away to its destination. preventDefault() is the
 * smallest possible fix: it stops the browser's default anchor-click
 * navigation for both mouse and keyboard (Enter-on-a-focused-anchor)
 * activation — both dispatch a real "click" event a browser handles
 * identically — while leaving `href` itself completely real and intact,
 * and without touching event propagation at all, so the click still
 * bubbles up to CanvasInteractionBoundary's own window listener for
 * ordinary selection exactly as it would on any other element. Preview/
 * Export are explicitly out of this checkpoint's scope; a real anchor
 * with a real href is what those future features will need to read.
 */
function preventEditorNavigation(event: ReactMouseEvent) {
  event.preventDefault();
}

export function LinkElement({ node, parentId, parentLayoutMode, parentFlowDisplay }: DocumentElementProps) {
  const dropRef = useNodeDropRegistration(node);
  const { setNodeRef: dragRef, listeners, isDragging } = useNodeDragSource(node, parentLayoutMode);
  const editable = useEditableText(node);
  const isPreview = useEditorStore((state) => state.editorMode === "preview");
  const usesLegacyOverflowClip = !node.display?.overflow && !node.display?.overflowX && !node.display?.overflowY;
  // Checkpoint 1.15.6.10.3 — the same "legacy chrome gets out of the way
  // entirely once real data exists" rule usesLegacyBorderChrome/
  // usesLegacyRadiusChrome (ContainerElement, ImageElement, ...) already
  // established, now for Link's own starter underline: the 1.15.6.10
  // audit found this was previously an unconditional class with no
  // authored-CSS override path at all (unlike every other Typography
  // field, which already yields to resolveTypographyStyle's own inline
  // style). `underline-offset-2` yields together with `underline` — not
  // independently — since it's purely decorative to that specific legacy
  // treatment and there is no authored text-underline-offset field (out
  // of this checkpoint's own narrow scope); once ANY real decoration
  // value is authored (including "none"), the whole legacy pairing steps
  // aside for resolveTypographyStyle's own inline text-decoration-line.
  const usesLegacyUnderline = node.typography?.textDecorationLine === undefined;

  return (
    <a
      href={getLinkHref(node)}
      onClick={preventEditorNavigation}
      id={node.htmlId}
      ref={mergeRefs<HTMLElement>(dropRef, dragRef, editable.elementRef)}
      {...documentNodeAttributes(node, parentId)}
      {...editable.editableProps}
      className={cn(
        // Checkpoint 1.15.6.10.3 — `w-fit` removed entirely, not made
        // conditional: `inline-block` (kept, still needed for Canvas
        // selection/resize/padding/border/background exactly as before —
        // real Chromium QA confirmed removing it broke nothing this
        // checkpoint changed) already sizes via the same shrink-to-fit
        // algorithm `w-fit` was forcing, so ordinary Flow appearance is
        // unaffected; the one case where the two genuinely differed was
        // inside a Flex parent with align-items: stretch, where `w-fit`'s
        // explicit `width: fit-content` — unlike inline-block's own
        // `width: auto`, which a flex item's blockification step lets
        // align-self: stretch act on — silently defeated natural
        // stretching. Grid/Free/explicit-resize were never affected
        // either way: each already sets a stronger inline width that
        // already won over `w-fit`.
        "inline-block text-blue-600 dark:text-blue-400",
        usesLegacyUnderline && "underline underline-offset-2",
        editable.isEditing && "outline-none",
        isDragging && "opacity-40",
        node.className,
      )}
      style={{
        // resolvePositionStyle spread first, and elementPositionStyle after
        // (Checkpoint 5.1) — a Free child's own position: absolute (see
        // freeChildStyle, applied inside elementPositionStyle) must always
        // win over this checkpoint's general Position control; see
        // types/position.ts's own doc comment for the full ownership
        // conflict this resolves.
        ...resolvePositionStyle(node),
        ...elementPositionStyle(node, parentLayoutMode, { clipOverflowY: usesLegacyOverflowClip }),
        ...resolveAspectRatioStyle(node),
        ...resolveFlexOrGridChildStyle(node, parentFlowDisplay),
        // Spread AFTER resolveFlexOrGridChildStyle deliberately (Checkpoint
        // 5.7) — see HeadingElement's identical comment for the full
        // reasoning (an explicit user min-width/min-height must win over
        // that resolver's own Flex/Grid containment default of 0).
        ...resolveSizeConstraintsStyle(node, parentLayoutMode),
        ...resolveTypographyStyle(node),
        ...resolveBackgroundStyle(node),
        ...resolveBorderStyle(node),
        ...resolveBorderRadiusStyle(node),
        ...resolveBoxShadowStyle(node),
        ...resolveFilterStyle(node),
        ...resolveTransitionStyle(node, isPreview),
        ...resolveDisplayStyle(node),
      }}
      {...(editable.isEditing ? undefined : listeners)}
    >
      {node.text}
    </a>
  );
}
