/**
 * BC-13.5.1 — the one live pointer interaction (a Free drag or resize) that
 * an editor command must end before it runs (approved keyboard policy,
 * Option B: Escape, or a recognized editor command, cancels; other keys
 * don't).
 *
 * The Canvas registers its cancel function while an interaction is
 * active. Every eligible command's authoritative execution path — the
 * editor store actions (Undo/Redo, clipboard, Duplicate, Delete, Copy/Paste
 * CSS, Preview, replacing the document) and the project workflow
 * (Save/Save As/New/Open/Import/Close) — calls interruptActiveInteraction()
 * first. So the command runs on committed geometry, however it was invoked
 * (shortcut, menu, toolbar, a second touch pointer), and nothing else needs
 * its own list of shortcuts.
 */

let activeCancel: (() => void) | null = null;

/** Registers the active interaction's cancel; returns its unregister (a no-op once replaced). */
export function registerActiveInteraction(cancel: () => void): () => void {
  activeCancel = cancel;
  return () => {
    if (activeCancel === cancel) activeCancel = null;
  };
}

/**
 * Cancels the active interaction (rolled back, no history), if any, so the
 * caller's command acts on committed state. Returns whether one was active.
 */
export function interruptActiveInteraction(): boolean {
  const cancel = activeCancel;
  if (!cancel) return false;
  activeCancel = null;
  cancel();
  return true;
}

export function hasActiveInteraction(): boolean {
  return activeCancel !== null;
}
