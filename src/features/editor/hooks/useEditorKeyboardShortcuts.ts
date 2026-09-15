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
        // Checkpoint 1.15.6, section N of its own required report: inside
        // SVG Drawing Mode with one or more vector objects selected,
        // Delete/Backspace removes THOSE objects — never the outer SVG
        // document node itself, even though it's still the outer
        // document's own `selection.primaryId` throughout edit mode (see
        // enterSvgEditMode). Outside Drawing Mode (or with no vector
        // selection), this falls through to the ordinary document
        // deleteSelection() unchanged.
        if (store.svgEditingNodeId && store.selectedSvgObjectIds.length > 0) {
          store.removeSvgObjects(store.svgEditingNodeId, store.selectedSvgObjectIds);
        } else {
          store.deleteSelection();
        }
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // SVG Drawing Mode's own Escape priority (Checkpoint 1.15.6, section N):
  // (1) an unfinished Polygon/Pen draft -> cancel it, (2) else selected
  // vector objects -> clear that selection, (3) else -> exit Drawing Mode
  // entirely. A capture-phase window listener — like every drag-session
  // hook's own Escape handler (useResizeSession, useSvgShapeDrawingSession,
  // etc.) — so it runs before CanvasInteractionBoundary's plain bubble-
  // phase "Escape clears the outer document selection" listener; calling
  // stopPropagation() when this handler actually acts halts the event's
  // entire remaining path (capture and bubble alike), so that outer
  // clear-selection behavior never fires on top of it.
  //
  // Deliberately skips entirely while `transactionSnapshot` is set — that
  // means some OTHER drag/draw session (a live Rectangle/Ellipse/Line
  // drag, an ordinary resize/move, etc.) is already mid-gesture, and that
  // session's own Escape handler is the one responsible for restoring its
  // live-written document changes; this handler firing too on the exact
  // same keypress could otherwise exit edit mode out from under an
  // in-progress drag it knows nothing about (a live-drawn Rectangle isn't
  // `svgDraft` — only Polygon/Pen accumulate through that field).
  useEffect(() => {
    function handleSvgEditModeEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const store = useEditorStore.getState();
      if (!store.svgEditingNodeId || store.transactionSnapshot) return;

      event.stopPropagation();
      if (store.svgDraft) {
        store.cancelSvgDraft();
      } else if (store.selectedSvgObjectIds.length > 0) {
        store.clearSvgObjectSelection();
      } else {
        store.exitSvgEditMode();
      }
    }

    window.addEventListener("keydown", handleSvgEditModeEscape, { capture: true });
    return () => window.removeEventListener("keydown", handleSvgEditModeEscape, { capture: true });
  }, []);
}
