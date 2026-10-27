"use client";

import { useEffect } from "react";
import type { ProjectWorkflow } from "@/features/project/commands/projectWorkflow";
import type { DesktopProjectFiles } from "@/features/project/desktop/desktopProjectFiles";
import { useHasUnsavedProjectChanges } from "@/features/project/hooks/useHasUnsavedProjectChanges";
import { useProjectStore } from "@/features/project/stores/useProjectStore";

/**
 * Desktop app only (PROJECT-1.3), mounted once by ProjectWorkspace:
 * - tells the main process whether closing would lose work (unsaved
 *   changes, or a save still being written), so a clean window closes
 *   without a prompt;
 * - answers the main process's close requests with the editor's own
 *   Save / Don't Save / Cancel dialog;
 * - opens `.layoutry` files forwarded later by Explorer or a second
 *   launch. (A file named on Layoutry's own command line is opened by
 *   workflow.startup(), after any recovery prompt.)
 */
export function useDesktopIntegration(
  workflow: ProjectWorkflow,
  desktop: DesktopProjectFiles | null,
): void {
  const hasUnsavedChanges = useHasUnsavedProjectChanges();
  const busy = useProjectStore((state) => state.operation !== null);
  const wouldLoseWork = hasUnsavedChanges || busy;

  useEffect(() => {
    desktop?.setUnsavedChanges(wouldLoseWork);
  }, [desktop, wouldLoseWork]);

  useEffect(() => {
    if (!desktop) return;
    const stopClose = desktop.onCloseRequested(
      () => void workflow.requestClose(),
    );
    const stopPending = desktop.onPendingProjectFile(
      () => void workflow.openPendingFile(),
    );
    return () => {
      stopClose();
      stopPending();
    };
  }, [desktop, workflow]);
}
