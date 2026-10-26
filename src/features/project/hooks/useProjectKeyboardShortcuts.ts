"use client";

import { useEffect } from "react";

export interface ProjectShortcutHandlers {
  onNewProject: () => void;
  onOpenProject: () => void;
  onSave: () => void;
  onSaveAs: () => void;
}

export type ProjectShortcut = keyof ProjectShortcutHandlers;

/**
 * Ctrl/Cmd+S → Save, Ctrl/Cmd+Shift+S → Save As, Ctrl/Cmd+O → Open,
 * Ctrl/Cmd+N → New. None of these collide with the editor's own
 * shortcuts (useEditorKeyboardShortcuts: Z, Y, C, X, V, D, Delete).
 * Alt combinations and key repeats are ignored.
 */
export function matchProjectShortcut(
  event: Pick<
    KeyboardEvent,
    "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey" | "repeat"
  >,
): ProjectShortcut | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.repeat)
    return null;
  const key = event.key.toLowerCase();
  if (key === "s") return event.shiftKey ? "onSaveAs" : "onSave";
  if (event.shiftKey) return null;
  if (key === "o") return "onOpenProject";
  if (key === "n") return "onNewProject";
  return null;
}

/**
 * Project shortcuts, mounted once by ProjectWorkspace. They also work while
 * an Inspector field has focus — Ctrl+S is never text input, and the
 * browser's own "Save page" must not open instead — but not while any
 * modal dialog is open. The default is prevented only for a handled key.
 *
 * Browsers keep Ctrl+N for a new window and never deliver it to the page,
 * so New Project's shortcut works in the desktop app only.
 */
export function useProjectKeyboardShortcuts(
  handlers: ProjectShortcutHandlers,
): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      const shortcut = matchProjectShortcut(event);
      if (!shortcut) return;
      if (document.querySelector("dialog[open]")) return;
      event.preventDefault();
      handlers[shortcut]();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlers]);
}
