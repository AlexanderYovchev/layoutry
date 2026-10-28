"use client";

import { useMemo, useRef } from "react";
import { Copy, Download, FolderDown, LoaderCircle, RefreshCw, Save, TriangleAlert } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/dialogButtons";
import { cn } from "@/lib/utils";
import { ExportCodePreview } from "@/features/export/components/ExportCodePreview";
import { ExportDiagnosticsList } from "@/features/export/components/ExportDiagnosticsList";
import type { DesktopExportFiles } from "@/features/export/desktop/desktopExportFiles";
import { useExportCodeSession, type HtmlCssExporter } from "@/features/export/hooks/useExportCodeSession";
import type { ExportEntitlement } from "@/features/export/types/exportEntitlement";
import type { HtmlCssExportMode } from "@/features/export/types/exportResult";
import { countExportDiagnostics, describeExportDiagnostics, summarizeExportDiagnostics } from "@/features/export/utils/describeExportDiagnostics";
import { joinFileNames } from "@/features/export/utils/joinFileNames";
import { developmentExportEntitlement } from "@/features/export/utils/developmentExportEntitlement";
import { summarizeExportAssets } from "@/features/export/utils/summarizeExportAssets";

interface ExportCodeDialogProps {
  open: boolean;
  onClose: () => void;
  /** The exported page's <title>: the project name. */
  title: string;
  /** Native saving in the desktop app; null in a browser (downloads instead). */
  desktop: DesktopExportFiles | null;
  entitlement?: ExportEntitlement;
  /** Tests only: replaces the real engine. */
  exporter?: HtmlCssExporter;
}

const OUTPUT_OPTIONS: { mode: HtmlCssExportMode; label: string; description: string }[] = [
  { mode: "standalone", label: "Single HTML file", description: "index.html with the CSS, and any interaction script, inside it." },
  { mode: "separate", label: "Separate files", description: "index.html, styles.css, and script.js when the page has interactions." },
];

/**
 * File › Export Code… (EXPORT-1.4): generates HTML and CSS from the
 * current design with the existing export engine, shows every generated
 * file as text with the engine's diagnostics, and copies, downloads (in a
 * browser) or saves natively (in the desktop app) exactly the files on
 * screen. Exporting never saves the project or changes its unsaved state.
 */
export function ExportCodeDialog({ open, onClose, title, desktop, entitlement = developmentExportEntitlement, exporter }: ExportCodeDialogProps) {
  const session = useExportCodeSession({ open, title, entitlement, desktop, exporter });
  const { generation, snapshot, stale, exportable, files, transfer, busy } = session;
  const cancelRef = useRef<HTMLButtonElement>(null);

  const diagnostics = useMemo(
    () => (snapshot ? describeExportDiagnostics(snapshot.result.diagnostics, snapshot.document) : []),
    [snapshot],
  );
  const diagnosticSummary = useMemo(() => (snapshot ? summarizeExportDiagnostics(countExportDiagnostics(snapshot.result.diagnostics)) : null), [snapshot]);
  const assets = useMemo(() => (snapshot ? summarizeExportAssets(snapshot.result.assets) : null), [snapshot]);
  const refused = snapshot !== null && !snapshot.result.ok;
  const separate = session.mode === "separate";

  const statusText =
    generation.status === "checking" || generation.status === "generating"
      ? "Generating code…"
      : generation.status === "ready" && snapshot
        ? refused
          ? "Export refused: the design has errors that must be fixed first."
          : `Code ready: ${files.length === 1 ? "1 file" : `${files.length} files`}${diagnosticSummary ? `, ${diagnosticSummary}` : ""}.`
        : "";

  return (
    <Dialog open={open} onClose={onClose} title="Export Code" size="xl" closeDisabled={busy} initialFocusRef={cancelRef}>
      <p className="shrink-0">Generate HTML and CSS from your Canvas design.</p>

      <div className="mt-3 flex shrink-0 flex-wrap gap-x-6 gap-y-3">
        <div>
          <p id="export-format-label" className="text-fg-primary text-xs font-semibold">
            Format
          </p>
          <p aria-labelledby="export-format-label" className="mt-1.5 flex h-8 items-center gap-2">
            <span className="rounded-control border-accent bg-surface-selected text-fg-primary border px-2.5 py-1 text-xs font-medium">HTML + CSS</span>
            <span className="text-fg-muted text-xs">Tailwind CSS, React and Vue are planned.</span>
          </p>
        </div>
        <fieldset className="min-w-0 flex-1" disabled={busy}>
          <legend className="text-fg-primary text-xs font-semibold">Output</legend>
          <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
            {OUTPUT_OPTIONS.map((option) => (
              <label
                key={option.mode}
                className={cn(
                  "rounded-control ease-studio has-focus-visible:outline-accent flex cursor-pointer items-start gap-2 border px-2.5 py-1.5 transition-colors duration-150 has-focus-visible:outline has-focus-visible:outline-2 has-focus-visible:outline-offset-2",
                  session.mode === option.mode ? "border-accent bg-surface-selected" : "border-line hover:bg-surface-hover",
                )}
              >
                <input
                  type="radio"
                  name="export-output"
                  value={option.mode}
                  checked={session.mode === option.mode}
                  onChange={() => session.setMode(option.mode)}
                  className="accent-accent mt-0.5 shrink-0"
                />
                <span className="min-w-0">
                  <span className="text-fg-primary block text-xs font-medium">{option.label}</span>
                  <span className="block text-[11px] leading-4">{option.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div
        role="status"
        aria-live="polite"
        className="sr-only"
        data-testid="export-generation-status"
        data-generation-ms={snapshot ? Math.round(snapshot.generationMs) : undefined}
      >
        {statusText}
      </div>

      {stale && (
        <div className="mt-3 flex shrink-0 flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300" data-testid="export-stale">
          <TriangleAlert aria-hidden="true" className="size-3.5 shrink-0" />
          <p className="min-w-0 flex-1">The design changed after this code was generated. Regenerate to export the current design.</p>
          <button type="button" onClick={session.regenerate} disabled={busy} className={secondaryButtonClass}>
            <RefreshCw aria-hidden="true" className="size-3.5" />
            Regenerate
          </button>
        </div>
      )}

      <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3">
        {(generation.status === "checking" || generation.status === "generating") && (
          <p className="flex flex-1 items-center justify-center gap-2" data-testid="export-generating">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
            Generating code…
          </p>
        )}

        {generation.status === "denied" && (
          <p role="alert" className="text-fg-primary">
            {generation.message}
          </p>
        )}

        {generation.status === "failed" && (
          <div role="alert" className="flex flex-col items-start gap-2">
            <p className="text-red-700 dark:text-red-400">{generation.message}</p>
            <button type="button" onClick={session.regenerate} className={secondaryButtonClass}>
              <RefreshCw aria-hidden="true" className="size-3.5" />
              Try again
            </button>
          </div>
        )}

        {snapshot && (
          <>
            <div className="shrink-0">
              {refused && (
                <p role="alert" className="mb-2 text-red-700 dark:text-red-400">
                  This design can&apos;t be exported until the errors below are fixed. No code was generated.
                </p>
              )}
              <ExportDiagnosticsList diagnostics={diagnostics} summary={diagnosticSummary} />
              {assets && assets.remote.length > 0 && (
                <p className="mt-1.5 text-xs" data-testid="export-remote-assets">
                  This page loads {assets.remote.length === 1 ? "1 file" : `${assets.remote.length} files`} (images, fonts or media) from the
                  internet. They are not included in the export, so viewing the page needs a connection to show them.
                </p>
              )}
              {separate && files.length > 0 && (
                <p className="mt-1.5 text-xs" data-testid="export-keep-together">
                  Keep {joinFileNames(files.map((file) => file.path))} together in one folder: index.html links to the other files by name.
                </p>
              )}
            </div>
            {files.length > 0 && <ExportCodePreview files={files} selectedPath={session.selectedPath} onSelect={session.setSelectedPath} />}
          </>
        )}
      </div>

      {transfer.status === "conflict" && (
        <div role="alertdialog" aria-labelledby="export-conflict-message" className="mt-3 flex shrink-0 flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          <p id="export-conflict-message" className="min-w-0 flex-1">
            {transfer.existing.join(", ")} already {transfer.existing.length === 1 ? "exists" : "exist"} in “{transfer.label}”. Replace{" "}
            {transfer.existing.length === 1 ? "it" : "them"}? Other files in the folder are not touched.
          </p>
          <button type="button" onClick={() => session.resolveConflict("cancel")} className={secondaryButtonClass}>
            Keep existing files
          </button>
          <button type="button" onClick={() => session.resolveConflict("overwrite")} className={primaryButtonClass}>
            Replace
          </button>
        </div>
      )}

      <div className="mt-4 flex shrink-0 flex-wrap items-center justify-end gap-2">
        <p
          role={transfer.status === "error" ? "alert" : "status"}
          aria-live={transfer.status === "error" ? "assertive" : "polite"}
          className={cn("mr-auto min-w-0 flex-1 basis-60 text-xs", transfer.status === "error" ? "text-red-700 dark:text-red-400" : "text-fg-secondary")}
          data-testid="export-transfer-status"
        >
          {transfer.status === "busy" || transfer.status === "done" || transfer.status === "error" ? transfer.message : ""}
        </p>
        <button ref={cancelRef} type="button" onClick={onClose} disabled={busy} className={secondaryButtonClass}>
          Cancel
        </button>
        <button type="button" onClick={session.copySelected} disabled={!exportable || busy} className={secondaryButtonClass}>
          <Copy aria-hidden="true" className="size-3.5" />
          Copy code
        </button>
        {desktop ? (
          <button type="button" onClick={session.saveToDesktop} disabled={!exportable || busy} className={primaryButtonClass}>
            {separate ? <FolderDown aria-hidden="true" className="size-3.5" /> : <Save aria-hidden="true" className="size-3.5" />}
            {separate ? "Save to Folder…" : "Save HTML File…"}
          </button>
        ) : separate ? (
          <>
            <button
              type="button"
              onClick={() => session.downloadFiles([session.selectedPath])}
              disabled={!exportable || busy}
              className={secondaryButtonClass}
            >
              <Download aria-hidden="true" className="size-3.5" />
              Download {session.selectedPath}
            </button>
            <button
              type="button"
              onClick={() => session.downloadFiles(files.map((file) => file.path))}
              disabled={!exportable || busy}
              className={primaryButtonClass}
            >
              <Download aria-hidden="true" className="size-3.5" />
              Download all files
            </button>
          </>
        ) : (
          <button type="button" onClick={() => session.downloadFiles(["index.html"])} disabled={!exportable || busy} className={primaryButtonClass}>
            <Download aria-hidden="true" className="size-3.5" />
            Download index.html
          </button>
        )}
      </div>
    </Dialog>
  );
}
