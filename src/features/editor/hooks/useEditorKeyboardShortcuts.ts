"use client";

import { useEffect } from "react";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  // Checked directly rather than relying solely on `isContentEditable`
  // (unreliable in some test environments/jsdom) — the attribute is what
  // actually governs the behavior in real browsers too.
  if (target.isContentEditable || target.getAttribute("contenteditable") === "true") {
    return true;
  }
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
}

/**
 * The one centralized place every editor-level keyboard shortcut is
 * bound — copy/cut/paste/duplicate/delete/undo/redo — mounted once at
 * the composition root (EditorApp) rather than scattered per-component.
 * Reads the store via getState()/setState() inside the handler instead of
 * useEditorStore's reactive selector, so this effect never needs to
 * re-subscribe as document/selection change; the Edit menu and this hook
 * both ultimately call the exact same store actions, so keyboard and menu
 * can never diverge in behavior.
 *
 * Shortcuts never fire while the event's target is a text-input context
 * (input/textarea/select/contenteditable) — Ctrl/Cmd+C inside an
 * Inspector text field must copy the field's own text, not the selected
 * Canvas node.
 */
export function useEditorKeyboardShortcuts(): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return;

      const meta = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      const store = useEditorStore.getState();

      if (meta && key === "z" && event.shiftKey) {
        event.preventDefault();
        store.redo();
        return;
      }
      if (meta && key === "z") {
        event.preventDefault();
        store.undo();
        return;
      }
      if (event.ctrlKey && key === "y") {
        event.preventDefault();
        store.redo();
        return;
      }
      if (meta && key === "c") {
        event.preventDefault();
        store.copySelection();
        return;
      }
      if (meta && key === "x") {
        event.preventDefault();
        store.cutSelection();
        return;
      }
      if (meta && key === "v") {
        event.preventDefault();
        store.pasteClipboard();
        return;
      }
      if (meta && key === "d") {
        event.preventDefault();
        store.duplicateSelection();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        store.deleteSelection();
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
