"use client";

import { useEffect, useLayoutEffect, useState } from "react";

// useLayoutEffect flushes before the browser paints, so the real width
// replaces the SSR fallback before the user ever sees a frame using it.
// It's a no-op (with a dev warning) during SSR, so it falls back to
// useEffect there.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Assumes a full desktop viewport during SSR/first paint so the
// unsupported-viewport gate never flashes before the real width is known.
const SSR_FALLBACK_WIDTH = 1920;

/**
 * Tracks window.innerWidth reactively. Resize events are coalesced to at
 * most one update per animation frame, so continuous window dragging
 * doesn't trigger a re-render per pixel.
 */
export function useViewportWidth(): number {
  const [width, setWidth] = useState(SSR_FALLBACK_WIDTH);

  useIsomorphicLayoutEffect(() => {
    setWidth(window.innerWidth);

    let frame: number | null = null;
    function handleResize() {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        setWidth(window.innerWidth);
      });
    }

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);

  return width;
}
