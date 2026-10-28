import { CircleCheck, CircleX, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DescribedExportDiagnostic } from "@/features/export/utils/describeExportDiagnostics";

const SEVERITY_ICONS = {
  error: { Icon: CircleX, className: "text-red-600 dark:text-red-400" },
  warning: { Icon: TriangleAlert, className: "text-amber-600 dark:text-amber-400" },
  info: { Icon: Info, className: "text-accent" },
} as const;

interface ExportDiagnosticsListProps {
  diagnostics: readonly DescribedExportDiagnostic[];
  summary: string | null;
}

/**
 * The engine's structured findings for the code on screen (EXPORT-1.4):
 * severity, explanation, and the element and property concerned. Every
 * diagnostic is listed — the list scrolls rather than truncating.
 */
export function ExportDiagnosticsList({ diagnostics, summary }: ExportDiagnosticsListProps) {
  if (diagnostics.length === 0) {
    return (
      <p className="flex items-center gap-1.5 text-xs" data-testid="export-diagnostics-empty">
        <CircleCheck aria-hidden="true" className="text-success size-3.5 shrink-0" />
        No problems found. The code matches your design.
      </p>
    );
  }
  return (
    <section aria-labelledby="export-diagnostics-heading" className="flex min-h-0 flex-col gap-1.5">
      <h3 id="export-diagnostics-heading" className="text-fg-primary text-xs font-semibold">
        Export notes <span className="text-fg-secondary font-normal">({summary})</span>
      </h3>
      <ul
        aria-label="Export diagnostics"
        tabIndex={0}
        className="rounded-control border-line-subtle focus-visible:outline-accent max-h-28 space-y-1 overflow-y-auto border p-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {diagnostics.map((diagnostic) => {
          const { Icon, className } = SEVERITY_ICONS[diagnostic.severity];
          return (
            <li key={diagnostic.key} data-severity={diagnostic.severity} className="flex items-start gap-2 text-xs">
              <Icon aria-hidden="true" className={cn("mt-px size-3.5 shrink-0", className)} />
              <div className="min-w-0">
                <p className="text-fg-primary break-words">
                  <span className="font-semibold">{diagnostic.severityLabel}:</span> {diagnostic.message}
                </p>
                {(diagnostic.element || diagnostic.property) && (
                  <p className="text-fg-secondary break-words">
                    {diagnostic.element && <>Element: {diagnostic.element}</>}
                    {diagnostic.element && diagnostic.property && " · "}
                    {diagnostic.property && (
                      <>
                        Property: <code className="font-mono">{diagnostic.property}</code>
                      </>
                    )}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
