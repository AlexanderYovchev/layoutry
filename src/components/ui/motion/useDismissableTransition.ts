"use client";

import { useEffect, useState } from "react";

export interface DismissableTransition {
  /** Whether the element should still be mounted (true slightly past isOpen going false, to let the exit transition play). */
  shouldRender: boolean;
  /** Whether the element's "visible" (open) styles should be applied. Toggling this is what drives the CSS transition. */
  isVisible: boolean;
}

/**
 * Keeps a conditionally-rendered element mounted for `exitDurationMs`
 * after `isOpen` becomes false, so a CSS transition can play the element
 * out instead of disappearing instantly. On open, mounts first with
 * isVisible=false and flips to true a frame later so the transition has
 * a starting state to animate from.
 */
export function useDismissableTransition(
  isOpen: boolean,
  exitDurationMs: number,
): DismissableTransition {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to an external open/close toggle, not deriving a render-time value
      setShouldRender(true);
      const frame = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(frame);
    }

    setIsVisible(false);
    const timeout = setTimeout(() => setShouldRender(false), exitDurationMs);
    return () => clearTimeout(timeout);
  }, [isOpen, exitDurationMs]);

  return { shouldRender, isVisible };
}
