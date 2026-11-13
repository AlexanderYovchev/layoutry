"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

const getSnapshot = () => typeof window.matchMedia === "function" && window.matchMedia(QUERY).matches;
// Prerendered and hydrated as "reduce": the strict choice until the real value is known.
const getServerSnapshot = () => true;

/** The viewer's prefers-reduced-motion: reduce (BC-08.3: a Video Embed never autoplays under it). */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
