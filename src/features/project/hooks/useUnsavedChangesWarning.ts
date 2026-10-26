"use client";

import { useEffect } from "react";
import { useHasUnsavedProjectChanges } from "@/features/project/hooks/useHasUnsavedProjectChanges";
import { useProjectStore } from "@/features/project/stores/useProjectStore";

/**
 * Asks the browser to confirm closing or reloading the tab while the
 * project has unsaved changes or a library write is still in flight.
 * Browsers show their own generic text and ignore custom messages, so
 * none is set.
 *
 * Disabled in the desktop app, where closing is coordinated with the main
 * process instead (useDesktopIntegration).
 */
export function useUnsavedChangesWarning(enabled = true): void {
  const hasUnsavedChanges = useHasUnsavedProjectChanges();
  const busy = useProjectStore((project) => project.operation !== null);
  const shouldWarn = enabled && (hasUnsavedChanges || busy);

  useEffect(() => {
    if (!shouldWarn) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      // Older Chromium-based browsers also need returnValue set.
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [shouldWarn]);
}
