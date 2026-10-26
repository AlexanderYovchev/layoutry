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
 * The desktop app confirms closing in its main process instead, and lets
 * the page unload once the user has agreed (see desktop/main/main.ts).
 */
export function useUnsavedChangesWarning(): void {
  const hasUnsavedChanges = useHasUnsavedProjectChanges();
  const busy = useProjectStore((project) => project.operation !== null);
  const shouldWarn = hasUnsavedChanges || busy;

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
