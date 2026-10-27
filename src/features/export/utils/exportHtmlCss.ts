import type { EditorElementNode } from "@/features/editor/types/document";
import type { ExportFile, HtmlCssExportOptions, HtmlCssExportResult } from "@/features/export/types/exportResult";
import { buildExportDocument } from "@/features/export/utils/buildExportDocument";
import { printExportHtml } from "@/features/export/utils/printExportHtml";
import { printExportStylesheet } from "@/features/export/utils/printExportStylesheet";

export const EXPORT_STYLESHEET_PATH = "styles.css";
const HTML_MEDIA_TYPE = "text/html; charset=utf-8";
const CSS_MEDIA_TYPE = "text/css; charset=utf-8";

/**
 * Exports an authored document as static HTML and CSS (EXPORT-1.2).
 * Pure and deterministic: the same document and options always produce
 * byte-identical files, and nothing touches the DOM, the filesystem, the
 * editor store or any account/billing state. Both modes print the same IR
 * and the same stylesheet text — "standalone" embeds it in <style>,
 * "separate" writes it to styles.css and links it relatively.
 */
export function exportHtmlCss(document: EditorElementNode, options: HtmlCssExportOptions): HtmlCssExportResult {
  const built = buildExportDocument(document);
  if (!built.ok) return { ok: false, files: [], diagnostics: built.diagnostics };

  const diagnostics = [...built.document.diagnostics];
  const css = printExportStylesheet(built.document);
  const title = options.title?.trim() || "Untitled page";
  const lang = options.lang?.trim() || "en";

  let files: ExportFile[];
  if (options.mode === "standalone") {
    const html = printExportHtml(built.document, { title, lang, stylesheet: { kind: "embedded", css } }, diagnostics);
    files = [{ path: "index.html", content: html, mediaType: HTML_MEDIA_TYPE }];
  } else {
    const html = printExportHtml(built.document, { title, lang, stylesheet: { kind: "linked", href: EXPORT_STYLESHEET_PATH } }, diagnostics);
    files = [
      { path: "index.html", content: html, mediaType: HTML_MEDIA_TYPE },
      { path: EXPORT_STYLESHEET_PATH, content: css, mediaType: CSS_MEDIA_TYPE },
    ];
  }

  const ok = !diagnostics.some((diagnostic) => diagnostic.severity === "error");
  return { ok, files: ok ? files : [], diagnostics };
}
