"use client";

import { ExportCodeDialog } from "@/features/export/components/ExportCodeDialog";
import type { DesktopExportFiles } from "@/features/export/desktop/desktopExportFiles";
import { useExportDialogStore } from "@/features/export/stores/useExportDialogStore";
import { interruptActiveInteraction } from "@/features/editor/utils/activeInteraction";

interface ExportCodeDialogHostProps {
  title: string;
  desktop: DesktopExportFiles | null;
}

/** The export dialog bound to useExportDialogStore: open it with openExportCodeDialog(). */
export function ExportCodeDialogHost({ title, desktop }: ExportCodeDialogHostProps) {
  const open = useExportDialogStore((state) => state.open);
  const closeDialog = useExportDialogStore((state) => state.closeDialog);
  return <ExportCodeDialog open={open} onClose={closeDialog} title={title} desktop={desktop} />;
}

export function openExportCodeDialog(): void {
  // BC-13.5.1: the export reads the document, so a live Free drag/resize ends
  // first (rolled back) and the code is generated from committed geometry.
  interruptActiveInteraction();
  useExportDialogStore.getState().openDialog();
}
