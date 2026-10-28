import type { EditorElementNode } from "@/features/editor/types/document";
import type { ExportFile, HtmlCssExportOptions, HtmlCssExportResult } from "@/features/export/types/exportResult";
import { buildExportDocument } from "@/features/export/utils/buildExportDocument";
import { EXPORT_INTERACTION_RUNTIME, needsInteractionRuntime } from "@/features/export/utils/exportInteractionRuntime";
import { printExportHtml } from "@/features/export/utils/printExportHtml";
import { printExportStylesheet } from "@/features/export/utils/printExportStylesheet";

export const EXPORT_STYLESHEET_PATH = "styles.css";
export const EXPORT_SCRIPT_PATH = "script.js";
const HTML_MEDIA_TYPE = "text/html; charset=utf-8";
const CSS_MEDIA_TYPE = "text/css; charset=utf-8";
const SCRIPT_MEDIA_TYPE = "text/javascript; charset=utf-8";

/**
 * Exports an authored document as static HTML and CSS (EXPORT-1.2), plus
 * the interaction runtime when the page has interactions (EXPORT-1.3).
 * Pure and deterministic: the same document and options always produce
 * byte-identical files, and nothing touches the DOM, the filesystem, the
 * editor store or any account/billing state. Both modes print the same IR,
 * stylesheet text and runtime:
 * - "standalone": index.html with the stylesheet in <style> and, when
 *   needed, the runtime in a <script> at the end of <body>.
 * - "separate": index.html + styles.css, plus script.js only when needed —
 *   a static page stays exactly two files with no script at all.
 */
export function exportHtmlCss(document: EditorElementNode, options: HtmlCssExportOptions): HtmlCssExportResult {
  const built = buildExportDocument(document);
  if (!built.ok) return { ok: false, files: [], diagnostics: built.diagnostics, assets: [] };

  const diagnostics = [...built.document.diagnostics];
  const css = printExportStylesheet(built.document);
  const title = options.title?.trim() || "Untitled page";
  const lang = options.lang?.trim() || "en";
  const interactive = needsInteractionRuntime(built.document.behaviors);

  let files: ExportFile[];
  if (options.mode === "standalone") {
    const html = printExportHtml(
      built.document,
      { title, lang, stylesheet: { kind: "embedded", css }, ...(interactive ? { script: { kind: "embedded", source: EXPORT_INTERACTION_RUNTIME } } : {}) },
      diagnostics,
    );
    files = [{ path: "index.html", content: html, mediaType: HTML_MEDIA_TYPE }];
  } else {
    const html = printExportHtml(
      built.document,
      { title, lang, stylesheet: { kind: "linked", href: EXPORT_STYLESHEET_PATH }, ...(interactive ? { script: { kind: "linked", src: EXPORT_SCRIPT_PATH } } : {}) },
      diagnostics,
    );
    files = [
      { path: "index.html", content: html, mediaType: HTML_MEDIA_TYPE },
      { path: EXPORT_STYLESHEET_PATH, content: css, mediaType: CSS_MEDIA_TYPE },
      ...(interactive ? [{ path: EXPORT_SCRIPT_PATH, content: EXPORT_INTERACTION_RUNTIME, mediaType: SCRIPT_MEDIA_TYPE }] : []),
    ];
  }

  const ok = !diagnostics.some((diagnostic) => diagnostic.severity === "error");
  return { ok, files: ok ? files : [], diagnostics, assets: ok ? built.document.assets : [] };
}
