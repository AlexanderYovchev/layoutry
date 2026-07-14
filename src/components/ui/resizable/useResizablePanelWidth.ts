"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

// useLayoutEffect flushes before the browser paints, so the persisted
// width replaces the default before the user ever sees a frame at the
// default width. It's a no-op (with a dev warning) during SSR, so it
// falls back to useEffect there.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function readStoredWidth(storageKey: string, min: number, max: number) {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === null) return null;
    const parsed = Number(stored);
    return Number.isFinite(parsed) ? clamp(parsed, min, max) : null;
  } catch {
    return null;
  }
}

function writeStoredWidth(storageKey: string, width: number) {
  try {
    window.localStorage.setItem(storageKey, String(width));
  } catch {
    // Storage may be unavailable (private browsing, disabled cookies) —
    // the panel just won't persist across reloads.
  }
}

export interface UseResizablePanelWidthOptions {
  /** localStorage key this panel's width is persisted under. */
  storageKey: string;
  defaultWidth: number;
  minWidth: number;
  /** May change across renders (e.g. a caller narrowing it to fit the viewport or a sibling panel). */
  maxWidth: number;
  /** Pointer-movement direction that increases the panel's width. */
  growDirection: "left" | "right";
}

export interface UseResizablePanelWidthResult {
  /** The user's preferred width, clamped to [minWidth, maxWidth] — this is what should be rendered. */
  width: number;
  isDragging: boolean;
  /**
   * @param displayWidth The width the panel is actually rendered at right
   * now, if it differs from this hook's own `width` (e.g. a caller further
   * narrowed it to fit a sibling panel or the viewport). Dragging starts
   * from this value so the panel never jumps at the start of a drag.
   */
  handlePointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    displayWidth?: number,
  ) => void;
  handlePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handlePointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  /** Restores the default width and persists it, for a future reset command. */
  reset: () => void;
}

/**
 * Drag-to-resize width state for a single side panel, backed by
 * localStorage. Generic and reusable: any panel with a draggable edge
 * (Resource Panel, Inspector, and future regions like a bottom console
 * or AI panel) can use this without duplicating drag or persistence
 * logic.
 *
 * The user's preferred width is only ever changed by dragging, resetting,
 * or restoring a stored value — never by `maxWidth` changing on its own.
 * The returned `width` is a plain clamp of that preference against the
 * current `minWidth`/`maxWidth`, so temporarily narrowing `maxWidth` (a
 * smaller viewport, a sibling panel needing room) never overwrites the
 * preference, and the full preferred width reappears the instant more
 * space is available again.
 */
export function useResizablePanelWidth({
  storageKey,
  defaultWidth,
  minWidth,
  maxWidth,
  growDirection,
}: UseResizablePanelWidthOptions): UseResizablePanelWidthResult {
  const [preferredWidth, setPreferredWidth] = useState(defaultWidth);
  const [isDragging, setIsDragging] = useState(false);
  const dragOrigin = useRef<{ clientX: number; width: number } | null>(null);
  const latestPreferredWidth = useRef(defaultWidth);

  useIsomorphicLayoutEffect(() => {
    const stored = readStoredWidth(storageKey, minWidth, maxWidth);
    if (stored !== null) {
      latestPreferredWidth.current = stored;
      setPreferredWidth(stored);
    }
    // Intentionally run once on mount only.
  }, []);

  const width = clamp(preferredWidth, minWidth, maxWidth);

  function handlePointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
    displayWidth?: number,
  ) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragOrigin.current = {
      clientX: event.clientX,
      width: displayWidth ?? width,
    };
    setIsDragging(true);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragOrigin.current) return;
    const delta = event.clientX - dragOrigin.current.clientX;
    const signedDelta = growDirection === "right" ? delta : -delta;
    const nextWidth = clamp(
      dragOrigin.current.width + signedDelta,
      minWidth,
      maxWidth,
    );
    latestPreferredWidth.current = nextWidth;
    setPreferredWidth(nextWidth);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragOrigin.current) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragOrigin.current = null;
    setIsDragging(false);
    writeStoredWidth(storageKey, latestPreferredWidth.current);
  }

  function reset() {
    latestPreferredWidth.current = defaultWidth;
    setPreferredWidth(defaultWidth);
    writeStoredWidth(storageKey, defaultWidth);
  }

  return {
    width,
    isDragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    reset,
  };
}
