"use client";

import { useNativeFormValueEditing } from "@/features/canvas/hooks/useNativeFormValueEditing";
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
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { cn, mergeRefs } from "@/lib/utils";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

/**
 * A genuine native `<textarea>` (Checkpoint 1.12) — a real, distinct
 * multiline control, not `tag: "input"` with a variant; never a div
 * standing in for one. Reuses Input's exact `name`/`placeholder`/`value`
 * fields (the same semantic concern deserves the same document field
 * across compatible controls — see createTextareaNode's own doc
 * comment) and Input's exact `defaultValue`-not-`value` discipline for
 * the same reason (see InputElement's own doc comment on the
 * controlled-native-input footgun).
 *
 * Reuses useNativeFormValueEditing completely unchanged except for one
 * configuration flag: `commitOnEnter: false`. Unlike a single-line
 * Input, Textarea's whole point is multiline content — Enter must
 * insert a literal newline via the browser's own native default
 * behavior, not commit-and-exit the editing session (see that hook's
 * own doc comment on the `commitOnEnter` option). Everything else —
 * normal-mode readOnly/mousedown-prevent focus safety, double-click
 * entry, blur commit, Escape cancel, one-session-one-history-entry, and
 * the external-value resync effect for Undo/Redo/Reset — applies
 * identically to Textarea with zero hook code changes, proving the
 * hook was already generalized correctly in Checkpoint 1.10.
 */
export function TextareaElement({ node, parentId, parentLayoutMode, parentFlowDisplay }: DocumentElementProps) {
  const dropRef = useNodeDropRegistration(node);
  const { setNodeRef: dragRef, listeners, isDragging } = useNodeDragSource(node, parentLayoutMode);
  const editable = useNativeFormValueEditing(node, { commitOnEnter: false });
  const isPreview = useEditorStore((state) => state.editorMode === "preview");

  const usesLegacyRadiusChrome = !node.borderRadius;
  const usesLegacyBorderChrome = !node.border;

  return (
    <textarea
      name={node.name}
      placeholder={node.placeholder}
      defaultValue={node.value}
      id={node.htmlId}
      ref={mergeRefs<HTMLTextAreaElement>(dropRef, dragRef, editable.elementRef)}
      {...documentNodeAttributes(node, parentId)}
      {...editable.editableProps}
      className={cn(
        "h-24 w-full min-w-0 resize-none bg-white px-3 py-2 text-sm text-zinc-900 outline-none dark:bg-zinc-950 dark:text-zinc-100",
        usesLegacyRadiusChrome && "rounded-md",
        usesLegacyBorderChrome && "border border-zinc-200 dark:border-zinc-800",
        editable.isEditing && "cursor-text",
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
        ...elementPositionStyle(node, parentLayoutMode),
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
    />
  );
}
