"use client";

import { useEffect, useRef } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useNativeFormValueEditing } from "@/features/canvas/hooks/useNativeFormValueEditing";
import { useNodeDragSource } from "@/features/canvas/hooks/useNodeDragSource";
import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { documentDefaultClasses } from "@/features/canvas/utils/documentDefaultStyles";
import { resolveControlElementStyle } from "@/features/canvas/utils/elementStyleRecipes";
import { getInputType, isToggleInputType, sanitizeTelValue } from "@/features/editor/types/input";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { cn, mergeRefs } from "@/lib/utils";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

/**
 * Checkbox/radio have their own native "activation behavior": a click
 * toggles the control as part of the click event's own default action —
 * a genuinely different mechanism from a text-like Input's native
 * typing/focus (Checkpoint 1.12). Ordinary Canvas selection must not
 * silently toggle authored state that only the Inspector's Checked
 * control is meant to own (Checkpoint 1.9's own recommendation, carried
 * out here) — preventDefault() on both mousedown (blocks the same
 * focus-stealing hazard useNativeFormValueEditing's own mousedown guard
 * blocks for text-like Input — see that hook's doc comment for why this
 * matters to useEditorKeyboardShortcuts) and click (blocks the toggle
 * itself; MDN documents this as the standard way to intercept a
 * checkbox's own default activation) fully neutralizes native
 * interaction while leaving Canvas selection's own click bubbling
 * completely untouched.
 */
function preventCheckedToggle(event: ReactMouseEvent) {
  event.preventDefault();
}

/**
 * A genuine native `<input type="text">` (Checkpoint 1.10), widened to
 * every text-like variant in 1.11 and to checkbox/radio in 1.12 — never
 * a styled div standing in for one, matching every primitive's
 * semantic-DOM philosophy since Checkpoint 1.1.
 *
 * Text-like variants (text/email/password/number/search/url/tel) render
 * `defaultValue`, never `value`: node.value is authored/default document
 * state, not continuously-synchronized live runtime state (see
 * EditorElementNode.value's own doc comment). An uncontrolled
 * `defaultValue` is what lets the browser own real typing during an
 * editing session while the document is only ever written to at
 * useNativeFormValueEditing's deliberate commit boundary — a `value`
 * prop with no matched `onChange` would instead lock the field,
 * reproducing the exact controlled-native-input footgun this project has
 * already hit once (the Checkpoint 4.3.0.1 color picker).
 *
 * Checkbox/radio are architecturally different enough to skip that hook
 * entirely rather than force-fit them into its edit-session lifecycle:
 * neither has a typed "value" a designer edits via double-click on the
 * Canvas (Checkpoint 1.9's own recommendation — authored checked state
 * is Inspector-only), so there's no commit/cancel/Enter/Escape session
 * to manage. What they DO need — the same imperative-resync problem
 * `defaultValue` already had — is handled by this component's own
 * `checkedResyncRef` effect below: `defaultChecked` only ever applies at
 * mount, so an Undo/Redo/Inspector-Reset change to node.checked would
 * otherwise leave the mounted control visually stale exactly the way an
 * unhandled `defaultValue` did in Checkpoint 1.10.
 */
export function InputElement({ node, parentId, parentLayoutMode, parentFlowDisplay }: DocumentElementProps) {
  const dropRef = useNodeDropRegistration(node);
  const { setNodeRef: dragRef, listeners, isDragging } = useNodeDragSource(node, parentLayoutMode);
  const inputType = getInputType(node);
  const isToggle = isToggleInputType(inputType);
  const editable = useNativeFormValueEditing(node, {
    sanitizeValue: inputType === "tel" ? sanitizeTelValue : undefined,
  });
  const checkedResyncRef = useRef<HTMLInputElement | null>(null);
  const isPreview = useEditorStore((state) => state.editorMode === "preview");
  const recipe = resolveControlElementStyle(node, { parentLayoutMode, parentFlowDisplay, isPreview });

  useEffect(() => {
    if (!isToggle) return;
    if (checkedResyncRef.current) checkedResyncRef.current.checked = node.checked ?? false;
  }, [isToggle, node.checked]);

  return (
    <input
      type={inputType}
      name={node.name}
      placeholder={node.placeholder}
      defaultValue={node.value}
      defaultChecked={node.checked}
      id={node.htmlId}
      ref={mergeRefs<HTMLInputElement>(dropRef, dragRef, editable.elementRef, (element) => {
        checkedResyncRef.current = element;
      })}
      {...documentNodeAttributes(node, parentId)}
      {...(isToggle ? { onMouseDown: preventCheckedToggle, onClick: preventCheckedToggle } : editable.editableProps)}
      className={cn(
        documentDefaultClasses(recipe.defaults),
        !isToggle && editable.isEditing && "cursor-text",
        isDragging && "opacity-40",
        node.className,
      )}
      style={recipe.style}
      {...(!isToggle && editable.isEditing ? undefined : listeners)}
    />
  );
}
