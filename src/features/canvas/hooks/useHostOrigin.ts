"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const getOrigin = () => window.location.origin;
const getServerOrigin = () => null;

/**
 * The editor page's own origin (BC-02.3), which the iframe policy compares
 * embed URLs against. null while prerendering on the server, and during
 * hydration, so an embed is never loaded before its sandbox is decided.
 */
export function useHostOrigin(): string | null {
  return useSyncExternalStore(subscribe, getOrigin, getServerOrigin);
}
