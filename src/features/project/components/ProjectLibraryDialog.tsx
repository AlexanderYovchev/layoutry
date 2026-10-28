"use client";

import { FileWarning, FolderOpen, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import {
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/dialogButtons";
import type { ProjectLibraryState } from "@/features/project/stores/useProjectStore";

const iconButtonClass =
  "flex size-8 shrink-0 items-center justify-center rounded-control text-fg-secondary transition-colors duration-150 ease-studio hover:bg-surface-hover hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60";

export function formatProjectDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

interface ProjectLibraryDialogProps {
  open: boolean;
  library: ProjectLibraryState;
  activeProjectId: string;
  busy: boolean;
  onOpenProject: (id: string) => void;
  onDeleteProject: (id: string, name: string | null) => void;
  onRetry: () => void;
  onClose: () => void;
  /**
   * "desktop": the same IndexedDB library inside the desktop app's profile,
   * holding projects saved before native files (PROJECT-1.3).
   */
  variant?: "browser" | "desktop";
}

/** File › Open Project (browser) or Open from Desktop Library (desktop). */
export function ProjectLibraryDialog({
  open,
  library,
  activeProjectId,
  busy,
  onOpenProject,
  onDeleteProject,
  onRetry,
  onClose,
  variant = "browser",
}: ProjectLibraryDialogProps) {
  const desktop = variant === "desktop";
  const isFirstLoad =
    library.status === "loading" && library.entries.length === 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={desktop ? "Desktop Library" : "Open Project"}
      size="lg"
    >
      {library.status === "error" ? (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="text-fg-primary">{library.error}</p>
          <button
            type="button"
            onClick={onRetry}
            className={secondaryButtonClass}
          >
            Try Again
          </button>
        </div>
      ) : isFirstLoad || library.status === "idle" ? (
        <p aria-live="polite">Loading projects…</p>
      ) : library.entries.length === 0 ? (
        desktop ? (
          <p>
            The desktop library is empty. Projects are saved as .layoutry files
            — use File › Open File… to open one.
          </p>
        ) : (
          <p>
            No saved projects yet. Use{" "}
            <span className="text-fg-primary font-medium">File › Save</span> to
            add the current project to your library.
          </p>
        )
      ) : (
        <ul
          aria-label="Saved projects"
          className="-mx-1 max-h-[min(24rem,60vh)] space-y-1 overflow-y-auto px-1"
        >
          {library.entries.map((entry) => {
            if (entry.status === "unreadable")
              return (
                <li
                  key={entry.id}
                  className="rounded-card border-line-subtle flex items-center gap-3 border px-3 py-2"
                >
                  <FileWarning
                    aria-hidden="true"
                    className="size-4 shrink-0 text-amber-500"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-fg-primary truncate font-medium">
                      Unreadable project
                    </p>
                    <p className="text-xs">
                      This saved record is damaged and can&apos;t be opened.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteProject(entry.id, null)}
                    disabled={busy}
                    aria-label="Delete unreadable project"
                    className={iconButtonClass}
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                </li>
              );

            const { summary } = entry;
            const isActive = summary.id === activeProjectId;
            return (
              <li
                key={summary.id}
                className="rounded-card border-line-subtle hover:bg-surface-hover flex items-center gap-3 border px-3 py-2 transition-colors duration-150"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-fg-primary flex items-center gap-2 font-medium">
                    <span className="truncate">{summary.name}</span>
                    {isActive && (
                      <span className="bg-surface-selected text-fg-secondary shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-medium">
                        Open now
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs">
                    Edited {formatProjectDate(summary.updatedAt)} · Created{" "}
                    {formatProjectDate(summary.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenProject(summary.id)}
                  disabled={busy}
                  aria-label={`Open ${summary.name}`}
                  className={primaryButtonClass}
                >
                  <FolderOpen aria-hidden="true" className="size-3.5" />
                  Open
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteProject(summary.id, summary.name)}
                  disabled={busy}
                  aria-label={`Delete ${summary.name}`}
                  className={iconButtonClass}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="border-line-subtle text-fg-secondary mt-4 border-t pt-3 text-xs">
        {desktop
          ? "Projects saved inside Layoutry before .layoutry files existed. They stay here until you delete them. Use File › Save As… to keep one as a .layoutry file."
          : "Projects are stored in this browser on this device. Clearing site data, or using another browser or device, makes them unavailable — use File › Download Project to keep a backup."}
      </p>
    </Dialog>
  );
}
