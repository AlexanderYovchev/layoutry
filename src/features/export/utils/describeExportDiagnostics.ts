import type { EditorElementNode } from "@/features/editor/types/document";
import { getElementDisplayName } from "@/features/editor/utils/elementDisplayName";
import type { ExportDiagnostic, ExportDiagnosticSeverity } from "@/features/export/types/exportDiagnostic";

/** A diagnostic as the export dialog lists it (EXPORT-1.4). */
export interface DescribedExportDiagnostic {
  key: string;
  severity: ExportDiagnosticSeverity;
  severityLabel: string;
  message: string;
  /** The affected element as the Structure panel names it, e.g. "Primary Button (button)". */
  element?: string;
  /** The affected CSS property or HTML attribute. */
  property?: string;
}

export interface ExportDiagnosticCounts {
  error: number;
  warning: number;
  info: number;
}

const SEVERITY_LABELS: Record<ExportDiagnosticSeverity, string> = {
  error: "Error",
  warning: "Warning",
  info: "Note",
};

const SEVERITY_ORDER: Record<ExportDiagnosticSeverity, number> = { error: 0, warning: 1, info: 2 };

function indexNodes(root: EditorElementNode): Map<string, EditorElementNode> {
  const nodes = new Map<string, EditorElementNode>();
  const pending = [root];
  for (let node = pending.pop(); node; node = pending.pop()) {
    nodes.set(node.id, node);
    if (node.children) pending.push(...node.children);
  }
  return nodes;
}

function describeElement(node: EditorElementNode | undefined, nodeId: string | undefined): string | undefined {
  if (nodeId === undefined) return undefined;
  if (!node) return "An element that is no longer in the design";
  if (node.tag === "page") return "Page";
  const name = getElementDisplayName(node);
  return name === node.tag ? `<${node.tag}>` : `${name} (${node.tag})`;
}

/**
 * Every diagnostic, most severe first (the engine's order within a
 * severity), with the element it concerns named from the exported
 * snapshot. Nothing is dropped or merged.
 */
export function describeExportDiagnostics(
  diagnostics: readonly ExportDiagnostic[],
  document: EditorElementNode,
): DescribedExportDiagnostic[] {
  const nodes = diagnostics.some((diagnostic) => diagnostic.nodeId !== undefined) ? indexNodes(document) : new Map<string, EditorElementNode>();
  return diagnostics
    .map((diagnostic, index) => ({ diagnostic, index }))
    .sort((a, b) => SEVERITY_ORDER[a.diagnostic.severity] - SEVERITY_ORDER[b.diagnostic.severity] || a.index - b.index)
    .map(({ diagnostic, index }) => ({
      key: `${index}`,
      severity: diagnostic.severity,
      severityLabel: SEVERITY_LABELS[diagnostic.severity],
      message: diagnostic.message,
      element: describeElement(diagnostic.nodeId === undefined ? undefined : nodes.get(diagnostic.nodeId), diagnostic.nodeId),
      property: diagnostic.property,
    }));
}

export function countExportDiagnostics(diagnostics: readonly ExportDiagnostic[]): ExportDiagnosticCounts {
  const counts: ExportDiagnosticCounts = { error: 0, warning: 0, info: 0 };
  for (const diagnostic of diagnostics) counts[diagnostic.severity] += 1;
  return counts;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** "2 warnings, 1 note" — or null when there is nothing to report. */
export function summarizeExportDiagnostics(counts: ExportDiagnosticCounts): string | null {
  const parts = [
    counts.error > 0 ? plural(counts.error, "error", "errors") : null,
    counts.warning > 0 ? plural(counts.warning, "warning", "warnings") : null,
    counts.info > 0 ? plural(counts.info, "note", "notes") : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(", ") : null;
}
