"use client";

import { useId, useMemo, useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import type { ExportFile } from "@/features/export/types/exportResult";
import { boundExportPreview } from "@/features/export/utils/exportPreviewText";

interface ExportCodePreviewProps {
  files: readonly ExportFile[];
  selectedPath: string;
  onSelect: (path: string) => void;
}

function formatSize(content: string): string {
  const bytes = new TextEncoder().encode(content).length;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Generated files as plain text (EXPORT-1.4): one tab per file and a <pre>
 * holding the file's text as a single text node — never parsed or
 * rendered as HTML, so no generated markup or script can run here. Very
 * long files are cut at a line boundary for display only.
 */
export function ExportCodePreview({ files, selectedPath, onSelect }: ExportCodePreviewProps) {
  const baseId = useId();
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const selected = files.find((file) => file.path === selectedPath) ?? files[0];
  const preview = useMemo(() => (selected ? boundExportPreview(selected.content) : null), [selected]);
  const sizes = useMemo(() => new Map(files.map((file) => [file.path, formatSize(file.content)])), [files]);

  if (!selected || !preview) return null;

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = files.length - 1;
    const target =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (target === null) return;
    event.preventDefault();
    const path = files[target].path;
    onSelect(path);
    tabRefs.current.get(path)?.focus();
  }

  const tabId = (path: string) => `${baseId}-tab-${path}`;
  const panelId = `${baseId}-panel`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="tablist" aria-label="Generated files" className="flex shrink-0 flex-wrap gap-1">
        {files.map((file, index) => {
          const active = file.path === selected.path;
          return (
            <button
              key={file.path}
              ref={(element) => {
                if (element) tabRefs.current.set(file.path, element);
                else tabRefs.current.delete(file.path);
              }}
              type="button"
              role="tab"
              id={tabId(file.path)}
              aria-selected={active}
              aria-controls={panelId}
              tabIndex={active ? 0 : -1}
              onClick={() => onSelect(file.path)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              className={cn(
                "rounded-control ease-studio focus-visible:outline-accent flex h-8 items-center gap-1.5 border px-2.5 font-mono text-xs transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
                active
                  ? "border-accent bg-surface-selected text-fg-primary"
                  : "border-line bg-surface-panel text-fg-secondary hover:bg-surface-hover hover:text-fg-primary",
              )}
            >
              {file.path}
              <span className="text-fg-muted font-sans text-[11px]">{sizes.get(file.path)}</span>
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={tabId(selected.path)}
        className="mt-2 flex min-h-32 flex-1 flex-col"
      >
        {preview.truncated && (
          <p className="mb-1.5 shrink-0 text-xs" data-testid="export-preview-truncated">
            Showing the first {preview.shownLines.toLocaleString("en-US")} of {preview.totalLines.toLocaleString("en-US")} lines. Copy and download
            always use the complete file.
          </p>
        )}
        <pre
          tabIndex={0}
          aria-label={`${selected.path} source code`}
          data-testid="export-code"
          className="rounded-control border-line bg-surface-panel-secondary text-fg-primary focus-visible:outline-accent min-h-0 flex-1 overflow-auto border p-3 font-mono text-xs leading-5 whitespace-pre select-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {preview.text}
        </pre>
      </div>
    </div>
  );
}
