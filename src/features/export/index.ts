// Public API of the export feature (EXPORT-1.2): the pure HTML/CSS export
// engine and the target-independent Export IR future Tailwind/React/Vue
// printers will read. No UI, download or entitlement logic lives here.
export { exportHtmlCss, EXPORT_STYLESHEET_PATH } from "@/features/export/utils/exportHtmlCss";
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
