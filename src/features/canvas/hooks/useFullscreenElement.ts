"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
}

const getSnapshot = () => document.fullscreenElement;
const getServerSnapshot = () => null;

/** The editor document's current fullscreen element (BC-08.4), re-read on every fullscreenchange. */
export function useFullscreenElement(): Element | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
