// Public API of the export feature (EXPORT-1.2): the pure HTML/CSS export
// engine and the target-independent Export IR future Tailwind/React/Vue
// printers will read. The engine has no UI, download or entitlement logic;
// those are the EXPORT-1.4 exports at the end of this file.
export { exportHtmlCss, EXPORT_SCRIPT_PATH, EXPORT_STYLESHEET_PATH } from "@/features/export/utils/exportHtmlCss";
export type {
  ExportBehaviorAction,
  ExportBehaviors,
  ExportBehaviorTarget,
  ExportBehaviorTrigger,
} from "@/features/export/types/exportBehavior";
export { buildExportDocument, type BuildExportDocumentResult } from "@/features/export/utils/buildExportDocument";
export type {
  ExportFile,
  HtmlCssExportMode,
  HtmlCssExportOptions,
  HtmlCssExportResult,
} from "@/features/export/types/exportResult";
export type {
  ExportDiagnostic,
  ExportDiagnosticCode,
  ExportDiagnosticSeverity,
} from "@/features/export/types/exportDiagnostic";
export type {
  ExportAsset,
  ExportAssetKind,
  ExportAttribute,
  ExportAttributeValue,
  ExportDocument,
  ExportElement,
  ExportInteraction,
  ExportNode,
  ExportText,
} from "@/features/export/types/exportIr";

// EXPORT-1.4: the user-facing export — dialog, native desktop saving and
// the entitlement boundary. The engine above stays free of all three.
export { ExportCodeDialog } from "@/features/export/components/ExportCodeDialog";
export { ExportCodeDialogHost, openExportCodeDialog } from "@/features/export/components/ExportCodeDialogHost";
export {
  createDesktopExportFiles,
  getDesktopExportFiles,
  type DesktopExportFiles,
} from "@/features/export/desktop/desktopExportFiles";
export type { ExportEntitlement, ExportEntitlementDecision } from "@/features/export/types/exportEntitlement";
export { developmentExportEntitlement } from "@/features/export/utils/developmentExportEntitlement";
