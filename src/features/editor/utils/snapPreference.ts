/**
 * BC-13.3 (D11) — the global Snap On/Off preference: one value for every
 * project, kept across restarts, never part of a project file, never in
 * history, never exported. Stored like the panel widths
 * (useResizablePanelWidth): localStorage, every access guarded, so private
 * browsing or blocked storage simply means "not remembered". In the desktop
 * app this is the app:// origin's storage. Anything other than the exact
 * strings "true"/"false" counts as missing, so the default (on) applies.
 */
export const SNAP_PREFERENCE_KEY = "layoutry.editor.snapEnabled";

export function readSnapPreference(): boolean | null {
  try {
    const stored = window.localStorage.getItem(SNAP_PREFERENCE_KEY);
    if (stored === "true") return true;
    if (stored === "false") return false;
    return null;
  } catch {
    return null;
  }
}

export function writeSnapPreference(enabled: boolean): void {
  try {
    window.localStorage.setItem(SNAP_PREFERENCE_KEY, String(enabled));
  } catch {
    // Storage unavailable: the choice just isn't remembered.
  }
}
