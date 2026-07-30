import { create } from "zustand";

const MAX_RECENT_FONTS = 5;

interface RecentFontsState {
  /** Most-recently-committed font-family values first, capped at MAX_RECENT_FONTS. */
  recentFonts: string[];
  addRecentFont: (value: string) => void;
}

/**
 * Recently-used Font Family values (Checkpoint 4.2's "future-ready
 * architecture" requirement) — deliberately its own tiny store, separate
 * from useEditorStore, since this is Inspector tool-preference state, not
 * document content: it must never be undoable, never survive into the
 * exported document, and must survive across selecting different
 * elements (including a round trip through a non-text-bearing element,
 * which unmounts InspectorTypographySection entirely) — a plain useState
 * inside the field component would reset in that last case, which this
 * store exists specifically to avoid. In-memory only for now (resets on
 * a full page reload); adding persistence later is a one-line change at
 * this store's own create() call, not something callers need to know about.
 */
export const useRecentFontsStore = create<RecentFontsState>()((set) => ({
  recentFonts: [],
  addRecentFont: (value) =>
    set((state) => ({
      recentFonts: [value, ...state.recentFonts.filter((font) => font !== value)].slice(0, MAX_RECENT_FONTS),
    })),
}));
