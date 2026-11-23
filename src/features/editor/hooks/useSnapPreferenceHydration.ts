"use client";

import { useEffect } from "react";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { readSnapPreference } from "@/features/editor/utils/snapPreference";

/**
 * BC-13.3 (D11): applies the remembered Snap preference once, after mount
 * (the server render and the first client render both use the default, on,
 * so hydration matches). A missing or invalid value keeps the default.
 */
export function useSnapPreferenceHydration(): void {
  useEffect(() => {
    const stored = readSnapPreference();
    if (stored !== null && stored !== useEditorStore.getState().snapEnabled) useEditorStore.setState({ snapEnabled: stored });
  }, []);
}
