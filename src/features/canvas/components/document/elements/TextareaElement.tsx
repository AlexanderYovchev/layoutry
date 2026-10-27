"use client";

import { useNativeFormValueEditing } from "@/features/canvas/hooks/useNativeFormValueEditing";
import { useNodeDragSource } from "@/features/canvas/hooks/useNodeDragSource";
import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { documentDefaultClasses } from "@/features/canvas/utils/documentDefaultStyles";
import { resolveControlElementStyle } from "@/features/canvas/utils/elementStyleRecipes";
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
  const recipe = resolveControlElementStyle(node, { parentLayoutMode, parentFlowDisplay, isPreview });

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
        documentDefaultClasses(recipe.defaults),
        editable.isEditing && "cursor-text",
        isDragging && "opacity-40",
        node.className,
      )}
      style={recipe.style}
      {...(editable.isEditing ? undefined : listeners)}
    />
  );
}
