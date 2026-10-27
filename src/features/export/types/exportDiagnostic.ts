/**
 * Severity of one export finding (EXPORT-1.2):
 * - "error": export is refused — no files are produced (an invalid,
 *   oversized or otherwise untrustworthy document).
 * - "warning": something authored was dropped, replaced, or will not
 *   behave like Preview (an unsafe URL, an invalid CSS value, an
 *   interaction that still needs the EXPORT-1.3 runtime).
 * - "info": output is complete but worth knowing about (a relative asset
 *   path that has to ship alongside the page).
 */
export type ExportDiagnosticSeverity = "error" | "warning" | "info";

export type ExportDiagnosticCode =
  | "invalid-document"
  | "document-too-large"
  | "document-too-deep"
  | "unsafe-url"
  | "non-portable-url"
  | "relative-url"
  | "missing-media-source"
  | "invalid-css-value"
  | "invalid-color"
  | "invalid-font-family"
  | "invalid-svg-paint"
  | "unsafe-attribute"
  | "invalid-html-id"
  | "duplicate-html-id"
  | "reserved-class-name"
  | "unsupported-element"
  | "invalid-nesting"
  | "ignored-children"
  | "interaction-requires-runtime"
  | "dialog-requires-runtime"
  | "control-characters-removed";

export interface ExportDiagnostic {
  code: ExportDiagnosticCode;
  severity: ExportDiagnosticSeverity;
  /** Internal editor node id the finding is about, when it concerns one node. */
  nodeId?: string;
  /** The CSS property or HTML attribute concerned. */
  property?: string;
  message: string;
}
