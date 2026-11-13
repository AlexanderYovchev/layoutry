"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
// The desktop shell's sandboxed preload adds window.layoutryDesktop (ADR-0002).
const getSnapshot = () => Reflect.has(window, "layoutryDesktop");
// Prerendered and hydrated as the desktop app: the stricter choice (no fullscreen delegation) until known.
const getServerSnapshot = () => true;

/**
 * Whether the editor runs in the Electron desktop shell (BC-08.3). Video
 * Embeds in the desktop Preview get no fullscreen delegation: the shell
 * denies every permission, which leaves a provider's fullscreen request
 * hanging (BC-08.1 F2). BC-08.4 decides desktop fullscreen.
 */
export function useIsDesktopShell(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
