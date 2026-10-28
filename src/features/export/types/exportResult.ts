import type { ExportDiagnostic } from "@/features/export/types/exportDiagnostic";
import type { ExportAsset } from "@/features/export/types/exportIr";

export interface ExportFile {
  /** Relative path inside the export, e.g. "index.html". */
  path: string;
  content: string;
  mediaType: string;
}

/**
 * "standalone": one index.html with the stylesheet embedded in <style>.
 * "separate": index.html linking styles.css by a relative path.
 */
export type HtmlCssExportMode = "standalone" | "separate";

export interface HtmlCssExportOptions {
  mode: HtmlCssExportMode;
  /** Document <title>; defaults to "Untitled page". */
  title?: string;
  /** <html lang>; defaults to "en". */
  lang?: string;
}

export interface HtmlCssExportResult {
  /** False when an error-severity diagnostic refused the export; `files` is then empty. */
  ok: boolean;
  files: ExportFile[];
  diagnostics: ExportDiagnostic[];
  /**
   * Every URL the exported page references (EXPORT-1.4), so the export UI
   * can say which resources stay on the internet or must ship alongside.
   * Empty when the export was refused.
   */
  assets: ExportAsset[];
}
