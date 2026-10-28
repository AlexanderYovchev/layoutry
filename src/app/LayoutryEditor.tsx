"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { ExportCodeDialogHost, getDesktopExportFiles, openExportCodeDialog } from "@/features/export";
import { ProjectWorkspace, type CodeExportIntegration } from "@/features/project";

function subscribeToNothing(): () => void {
  return () => undefined;
}

/**
 * The editor page's composition root (EXPORT-1.4): the project workspace
 * plus code export. The two features stay independent of each other — the
 * project feature only receives a menu callback and a dialog to render.
 */
export function LayoutryEditor() {
  const [desktopExport] = useState(getDesktopExportFiles);
  // Prerendered as the browser editor: the desktop variant (Save instead of
  // Download) only after hydration, so the first client render matches.
  const isDesktop = useSyncExternalStore(
    subscribeToNothing,
    () => desktopExport !== null,
    () => false,
  );

  const codeExport = useMemo<CodeExportIntegration>(
    () => ({
      onOpen: openExportCodeDialog,
      renderDialog: (projectName) => (
        <ExportCodeDialogHost
          title={projectName}
          desktop={isDesktop ? desktopExport : null}
        />
      ),
    }),
    [isDesktop, desktopExport],
  );

  return <ProjectWorkspace codeExport={codeExport} />;
}
