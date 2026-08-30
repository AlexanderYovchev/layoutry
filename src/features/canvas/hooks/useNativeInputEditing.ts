"use client";

import { useEffect, useRef, useState } from "react";
import type {
  FocusEvent as ReactFocusEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from "react";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";

type NativeEditableElement = HTMLInputElement | HTMLTextAreaElement;

export interface NativeInputEditingControl {
  isEditing: boolean;
  /** Ref callback for the rendered native control itself — merge into the element's existing ref chain (see mergeRefs). */
  elementRef: (element: NativeEditableElement | null) => void;
  editableProps: {
    /** Blocks keystroke-driven edits outside a deliberate editing session — the first of two independent safeguards (see onMouseDown) against a plain single click accidentally behaving like a live application field. */
    readOnly: boolean;
    onMouseDown: (event: ReactMouseEvent) => void;
    onDoubleClick: (event: ReactMouseEvent) => void;
    onBlur: (event: ReactFocusEvent) => void;
    onKeyDown: (event: ReactKeyboardEvent) => void;
  };
}

/**
 * Native-focus editing for any value-bearing native form control
 * (Checkpoint 1.10) — deliberately NOT useEditableText: a real
 * `<input>`/`<textarea>` already owns native typing, caret placement, and
 * text selection the moment it has real DOM focus, none of which
 * contentEditable's model applies to. This hook's whole job is
 * controlling *when* that native focus is allowed to happen, not
 * reimplementing typing itself.
 *
 * Normal mode: a plain single click must behave like every other Canvas
 * element (select, don't edit) even though the rendered element is a
 * genuinely focusable native control. Two independent safeguards enforce
 * this — `readOnly` blocks keystrokes even if focus somehow lands, and
 * `onMouseDown`'s preventDefault stops the browser from focusing the
 * control on an ordinary click at all (mousedown preventDefault is the
 * standard cross-browser way to suppress native focus without blocking
 * the click/dblclick events themselves from still firing, so
 * onDoubleClick below is unaffected). This second safeguard is what keeps
 * useEditorKeyboardShortcuts' isEditableTarget check meaningful: without
 * it, a plain click would leave the real `<input>` holding DOM focus,
 * silently blocking Delete/Duplicate/Copy shortcuts for a merely
 * *selected* (not being edited) Input.
 *
 * Interactive mode: double-click flips `isEditing` on, which clears
 * `readOnly` and (via a useEffect keyed on isEditing, exactly like
 * useEditableText's own focus effect) programmatically focuses and
 * selects the control once React has committed that DOM change — native
 * typing, caret, and text selection then work exactly as any ordinary
 * web page's input would, since nothing here intercepts them. Nothing is
 * written to the document while the user types: node.value is only read
 * once, at commit time.
 *
 * Commit boundary: blur or Enter reads the DOM's own current `.value`
 * and writes it through setElementValue in one call — one editing
 * session is always exactly one undo step, and an unchanged session
 * writes nothing at all (setElementValue's own no-op guard). Escape
 * reverts the DOM's displayed value back to the last authored value and
 * exits without writing to the store. The suppressNextBlurCommitRef
 * guard mirrors useEditableText's identical fix for the same bug class:
 * Enter/Escape call element.blur() to visually release focus, which
 * fires a real native blur event this hook's own onBlur would otherwise
 * treat as an unrelated second commit.
 */
export function useNativeInputEditing(node: EditorElementNode): NativeInputEditingControl {
  const [isEditing, setIsEditing] = useState(false);
  const domRef = useRef<NativeEditableElement | null>(null);
  const suppressNextBlurCommitRef = useRef(false);
  const setElementValue = useEditorStore((state) => state.setElementValue);

  useEffect(() => {
    if (isEditing) {
      domRef.current?.focus();
      domRef.current?.select();
    }
  }, [isEditing]);

  // Imperative sync for any authored-value change that happens OUTSIDE an
  // active editing session — Undo/Redo, an Inspector Default Value edit/
  // Reset, or a duplicate landing with its own authored value. `value`
  // is deliberately rendered via `defaultValue` (see InputElement's own
  // doc comment) precisely so live typing stays uncontrolled — but
  // `defaultValue` only ever applies once, at mount; React does NOT
  // resync an already-mounted uncontrolled input's DOM value when
  // `defaultValue` changes on a later render. Left unhandled, this
  // exact gap silently breaks Undo/Redo/Reset: the store's node.value
  // would revert correctly while the Canvas kept showing the stale,
  // pre-undo text. This effect is the same imperative-sync fix already
  // established in this codebase for the same class of bug (see
  // feedback_controlled_native_input_footgun.md's color-picker fix) —
  // skipped while isEditing so it never fights the user's own live
  // keystrokes mid-session.
  useEffect(() => {
    if (isEditing) return;
    if (domRef.current) domRef.current.value = node.value ?? "";
  }, [node.value, isEditing]);

  function commit() {
    const nextValue = domRef.current?.value ?? "";
    if (nextValue !== (node.value ?? "")) {
      setElementValue(node.id, nextValue || undefined);
    }
    setIsEditing(false);
  }

  function cancel() {
    if (domRef.current) domRef.current.value = node.value ?? "";
    setIsEditing(false);
  }

  function handleMouseDown(event: ReactMouseEvent) {
    if (isEditing) return;
    // Stops the browser from focusing the native control on an ordinary
    // click (see this hook's own doc comment) — click/dblclick still
    // fire normally afterward, so this never blocks entering edit mode.
    event.preventDefault();
  }

  function handleDoubleClick() {
    setIsEditing(true);
  }

  function handleBlur() {
    if (suppressNextBlurCommitRef.current) {
      suppressNextBlurCommitRef.current = false;
      return;
    }
    if (isEditing) commit();
  }

  function handleKeyDown(event: ReactKeyboardEvent) {
    if (!isEditing) return;

    if (event.key === "Enter") {
      // Prevents this keystroke from also reaching the real <form> as a
      // submit trigger — belt-and-suspenders alongside
      // preventEditorFormSubmission (ContainerElement), and keeps this
      // control single-line/commit-and-exit like every other primitive's
      // Enter behavior.
      event.preventDefault();
      commit();
      suppressNextBlurCommitRef.current = true;
      domRef.current?.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancel();
      suppressNextBlurCommitRef.current = true;
      domRef.current?.blur();
    }
  }

  return {
    isEditing,
    elementRef: (element) => {
      domRef.current = element;
    },
    editableProps: {
      readOnly: !isEditing,
      onMouseDown: handleMouseDown,
      onDoubleClick: handleDoubleClick,
      onBlur: handleBlur,
      onKeyDown: handleKeyDown,
    },
  };
}
