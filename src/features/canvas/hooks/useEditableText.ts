"use client";

import { useEffect, useRef, useState } from "react";
import type {
  FocusEvent as ReactFocusEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from "react";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";

export interface EditableTextControl {
  isEditing: boolean;
  /** Ref callback for the rendered DOM element itself — merge into the element's existing ref chain (see mergeRefs). */
  elementRef: (element: HTMLElement | null) => void;
  editableProps: {
    contentEditable: boolean;
    suppressContentEditableWarning: true;
    onDoubleClick: (event: ReactMouseEvent) => void;
    onBlur: (event: ReactFocusEvent) => void;
    onKeyDown: (event: ReactKeyboardEvent) => void;
  };
}

/**
 * Generic plain-text editing for any text-bearing document node
 * (Checkpoint 1.3). Heading and Paragraph share this unchanged; nothing
 * here reads or branches on node.tag, so a future Button/Link/List Item
 * label can reuse it identically — see this checkpoint's report for the
 * reuse story.
 *
 * Lifecycle: a double-click flips contentEditable on and focuses the
 * element, handing the DOM to the browser's own native text editing
 * (caret placement, native selection, typing) — nothing here reimplements
 * any of that. Nothing is written to the document while the user types:
 * node.text is only read once, at the moment editing starts, to know
 * what to revert to on Escape. Because the store's `document` (and this
 * node's `text` field specifically) never changes mid-edit, React's own
 * text-child reconciliation never touches the live DOM text a re-render
 * might otherwise cause elsewhere in the tree — this is what keeps the
 * caret from jumping around while editing, with no special caret-
 * preservation code needed (see the checkpoint report for the full
 * reasoning). Ending the session (blur, or Enter) reads the DOM's own
 * current textContent and commits it through the store's setElementText
 * in one call — one editing session is always exactly one undo step.
 * Escape reverts the DOM back to the last committed text and exits
 * without writing to the store at all. This is the same "local draft,
 * commit on blur/Enter, revert on Escape" shape every Inspector text/
 * numeric field already uses (see InspectorNumberFieldRow), applied to
 * the Canvas instead of a side-panel input.
 *
 * Entering edit mode both focuses the element AND explicitly places the
 * browser's native Selection inside it (Checkpoint 1.15.6.2.1 — see the
 * effect below) — not merely a UX nicety (selecting all text so typing
 * immediately replaces it), but the fix for a real, reproducible bug
 * found during 1.15.6.2's own browser QA: `.focus()` alone moves
 * `document.activeElement` but never relocates `document.getSelection()`.
 * After committing a PRIOR edit elsewhere (Enter -> commit() -> blur()),
 * the browser's Selection Range is left stale, still anchored inside
 * that now-non-contentEditable element. Double-clicking a SECOND
 * text-bearing element then correctly flips it to contentEditable and
 * correctly focuses it (confirmed via document.activeElement) — but the
 * stale Selection never moves into it on its own. Chromium's native
 * Ctrl+A ("select all") resolves relative to the CURRENT Selection's own
 * scope, not simply "whatever's focused" — with a stale Selection still
 * rooted in a no-longer-editable element, that scope silently promotes
 * to the whole document body, so Ctrl+A selects the entire page's text
 * instead of the newly-focused element's, and typing does nothing useful
 * to it. This only ever reproduced as the SECOND edit in a sequence
 * (never on a fresh page, where there is no stale Selection yet to
 * inherit) — see this checkpoint's own report for the full diagnosis via
 * `document.getSelection()` before/after each step. Explicitly
 * re-anchoring the Selection inside the element every time editing
 * starts — regardless of whatever a previous session left behind — closes
 * this generically for every text-bearing tag that shares this hook, with
 * no per-tag or per-sequence special-casing.
 *
 * The suppressNextBlurCommitRef guard mirrors InspectorNumberFieldRow's
 * own fix for the identical bug class it already found (Checkpoint 5.7):
 * Enter/Escape call element.blur() to visually release focus, which
 * fires a real native blur event that this hook's own onBlur would
 * otherwise treat as an unrelated second commit of the same
 * already-committed (Enter) or just-reverted (Escape) text.
 *
 * Keyboard isolation while editing is handled by the pre-existing,
 * fully generic isEditableTarget guard in useEditorKeyboardShortcuts
 * (it already checks `target.isContentEditable`, not a Heading/Paragraph
 * tag) — nothing new was added there. The one other conflicting
 * listener, CanvasInteractionBoundary's window-level Escape-clears-
 * selection handler, already has its own escape hatch for exactly this
 * situation (`if (event.defaultPrevented) return`), which this hook's
 * own `event.preventDefault()` on Escape satisfies for free.
 */
export function useEditableText(node: EditorElementNode): EditableTextControl {
  const [isEditing, setIsEditing] = useState(false);
  const domRef = useRef<HTMLElement | null>(null);
  const suppressNextBlurCommitRef = useRef(false);
  const setElementText = useEditorStore((state) => state.setElementText);

  useEffect(() => {
    const element = domRef.current;
    if (!isEditing || !element) return;
    element.focus();
    // Explicitly re-anchors the native Selection inside this element —
    // see this function's own doc comment above for the real, reproduced
    // bug this fixes (a stale Selection left over from a PRIOR edit
    // elsewhere breaks native Ctrl+A/typing on this one otherwise).
    // Selecting the full existing text also means typing immediately
    // replaces it, matching how a freshly-focused field commonly behaves.
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(element);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }, [isEditing]);

  function commit() {
    const nextText = domRef.current?.textContent ?? "";
    if (nextText !== (node.text ?? "")) {
      setElementText(node.id, nextText);
    }
    setIsEditing(false);
  }

  function cancel() {
    if (domRef.current) domRef.current.textContent = node.text ?? "";
    setIsEditing(false);
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
      // Both Heading and Paragraph stay single-line, plain-text content —
      // node.text is a flat string with no newline-preserving CSS
      // (white-space: pre-wrap is a typography/CSS Inspector concern,
      // out of this checkpoint's scope), so Enter commits and exits
      // rather than ever letting contentEditable insert a `<div>`/`<br>`
      // into the DOM that would have nowhere to go in the document model.
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
      contentEditable: isEditing,
      suppressContentEditableWarning: true,
      onDoubleClick: handleDoubleClick,
      onBlur: handleBlur,
      onKeyDown: handleKeyDown,
    },
  };
}
