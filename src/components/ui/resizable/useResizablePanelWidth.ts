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
  maxWidth: number;
  /** Pointer-movement direction that increases the panel's width. */
  growDirection: "left" | "right";
}

export interface UseResizablePanelWidthResult {
  width: number;
  isDragging: boolean;
  handlePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
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
 */
export function useResizablePanelWidth({
  storageKey,
  defaultWidth,
  minWidth,
  maxWidth,
  growDirection,
}: UseResizablePanelWidthOptions): UseResizablePanelWidthResult {
  const [width, setWidth] = useState(defaultWidth);
  const [isDragging, setIsDragging] = useState(false);
  const dragOrigin = useRef<{ clientX: number; width: number } | null>(null);
  const latestWidth = useRef(defaultWidth);

  useIsomorphicLayoutEffect(() => {
    const stored = readStoredWidth(storageKey, minWidth, maxWidth);
    if (stored !== null) {
      latestWidth.current = stored;
      setWidth(stored);
    }
    // Intentionally run once on mount only.
  }, []);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragOrigin.current = { clientX: event.clientX, width };
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
    latestWidth.current = nextWidth;
    setWidth(nextWidth);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragOrigin.current) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragOrigin.current = null;
    setIsDragging(false);
    writeStoredWidth(storageKey, latestWidth.current);
  }

  function reset() {
    latestWidth.current = defaultWidth;
    setWidth(defaultWidth);
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
