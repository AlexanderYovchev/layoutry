"use client";

import { useEffect, useRef, useState } from "react";
import type {
  FocusEvent as ReactFocusEvent,
  FormEvent as ReactFormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from "react";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";

type NativeEditableElement = HTMLInputElement | HTMLTextAreaElement;

export interface NativeFormValueEditingOptions {
  /**
   * Whether Enter commits and exits the editing session (Checkpoint
   * 1.12). True for every text-like Input variant, where a single-line
   * value has nowhere for a newline to go. False for Textarea, whose
   * whole point is multiline content — Enter must insert a literal
   * newline via the browser's own native default behavior instead, so
   * this hook must not call preventDefault()/commit() for it. Escape
   * still cancels either way. Defaults to true (the original,
   * Checkpoint 1.10 Input-only behavior) so every existing call site
   * needs no change.
   */
  commitOnEnter?: boolean;
  /**
   * Live-filters the DOM's own `.value` on every native `input` event —
   * typing, paste, and drag-drop all fire it, unlike `keydown`, which
   * paste bypasses entirely (Checkpoint 1.12.1, added for Telephone's
   * authored-value character restriction — see sanitizeTelValue). Applied
   * directly to the DOM element (value stays uncontrolled — see this
   * hook's own doc comment), never to React/document state: nothing is
   * written to the store until the normal commit boundary, exactly as
   * before. Must be a pure removal filter (only ever strips characters,
   * never reorders/inserts) — the caret-preservation math below assumes
   * this. Undefined (the default) disables filtering entirely, leaving
   * every other Input type's existing behavior untouched.
   */
  sanitizeValue?: (raw: string) => string;
}

export interface NativeFormValueEditingControl {
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
    onInput: (event: ReactFormEvent<NativeEditableElement>) => void;
  };
}

/**
 * Native-focus editing for any value-bearing native form control whose
 * content is a typed string (Checkpoint 1.10, generalized to Textarea in
 * 1.12 via `commitOnEnter` — see that option's own doc comment; NOT used
 * for checkbox/radio, which have no typed value a designer edits on the
 * Canvas at all — see InputElement's own doc comment) — deliberately NOT
 * useEditableText: a real `<input>`/`<textarea>` already owns native
 * typing, caret placement, and text selection the moment it has real DOM
 * focus, none of which contentEditable's model applies to. This hook's
 * whole job is controlling *when* that native focus is allowed to
 * happen, not reimplementing typing itself. (Renamed from
 * useNativeInputEditing in Checkpoint 1.12 — "Input" stopped being
 * accurate the moment a non-`<input>` element, Textarea, became a real
 * consumer of the exact same hook.)
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
 * it, a plain click would leave the real `<input>`/`<textarea>` holding
 * DOM focus, silently blocking Delete/Duplicate/Copy shortcuts for a
 * merely *selected* (not being edited) control.
 *
 * Interactive mode: double-click flips `isEditing` on, which clears
 * `readOnly` and (via a useEffect keyed on isEditing, exactly like
 * useEditableText's own focus effect) programmatically focuses and
 * selects the control once React has committed that DOM change — native
 * typing, caret, and text selection then work exactly as any ordinary
 * web page's input/textarea would, since nothing here intercepts them.
 * Nothing is written to the document while the user types: node.value is
 * only read once, at commit time.
 *
 * Commit boundary: blur (or Enter, only when `commitOnEnter` is true)
 * reads the DOM's own current `.value` and writes it through
 * setElementValue in one call — one editing session is always exactly
 * one undo step, and an unchanged session writes nothing at all
 * (setElementValue's own no-op guard). Escape reverts the DOM's
 * displayed value back to the last authored value and exits without
 * writing to the store. The suppressNextBlurCommitRef guard mirrors
 * useEditableText's identical fix for the same bug class: Enter/Escape
 * call element.blur() to visually release focus, which fires a real
 * native blur event this hook's own onBlur would otherwise treat as an
 * unrelated second commit.
 */
export function useNativeFormValueEditing(
  node: EditorElementNode,
  { commitOnEnter = true, sanitizeValue }: NativeFormValueEditingOptions = {},
): NativeFormValueEditingControl {
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

  // Fires for typing, paste, and drag-drop alike (unlike keydown, which
  // paste never triggers) — see sanitizeValue's own doc comment. Caret
  // math assumes sanitizeValue only ever removes characters: re-running
  // it on just the substring before the original caret gives the correct
  // post-filter caret position without needing a general diff.
  function handleInput(event: ReactFormEvent<NativeEditableElement>) {
    if (!sanitizeValue) return;
    const element = event.currentTarget;
    const raw = element.value;
    const sanitized = sanitizeValue(raw);
    if (sanitized === raw) return;
    const caret = element.selectionStart ?? raw.length;
    const nextCaret = sanitizeValue(raw.slice(0, caret)).length;
    element.value = sanitized;
    element.setSelectionRange(nextCaret, nextCaret);
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

    if (event.key === "Enter" && commitOnEnter) {
      // Prevents this keystroke from also reaching the real <form> as a
      // submit trigger — belt-and-suspenders alongside
      // preventEditorFormSubmission (ContainerElement), and keeps this
      // control single-line/commit-and-exit like every other primitive's
      // Enter behavior. Skipped entirely when commitOnEnter is false
      // (Textarea) — no preventDefault, no commit, so the browser's own
      // default newline-insertion proceeds untouched.
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
      onInput: handleInput,
    },
  };
}
