import { ShieldAlert, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * PROJECT-1.2 — plain data, since components/layout must not import
 * src/features/* (see applicationMenus.ts). The project feature derives it.
 * - `saved`: in the library and unchanged since the last save or open
 * - `unsaved`: edited or renamed since then (or its library copy was deleted)
 * - `new`: a new project that was never saved and has no changes yet
 * - `saving`: a library write is in flight
 *
 * PROJECT-1.3 — `source` says where the project is stored, e.g. a file
 * name ("Website.layoutry") or "Desktop library". Never a full path.
 *
 * PROJECT-1.4 — `recovery`: whether unsaved changes have a recovery copy.
 * "protected" never means saved; it is shown next to "Unsaved changes".
 */
export interface ProjectIdentityInfo {
  name: string;
  status: "saved" | "unsaved" | "new" | "saving";
  source?: { label: string; description: string };
  recovery?: { state: "protected" | "unavailable"; description: string };
  onRename: () => void;
}

const STATUS_LABELS: Record<ProjectIdentityInfo["status"], string> = {
  saved: "Saved",
  unsaved: "Unsaved changes",
  new: "Not saved",
  saving: "Saving…",
};

interface ProjectIdentityProps {
  /** Absent when the shell is rendered without a project (tests). */
  project?: ProjectIdentityInfo;
}

export function ProjectIdentity({ project }: ProjectIdentityProps) {
  const name = project?.name ?? "Untitled Project";
  const status = project?.status ?? "new";

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden px-3 text-sm">
      {project ? (
        <button
          type="button"
          onClick={project.onRename}
          title="Rename project"
          aria-label={`Project: ${name}. Rename project`}
          className="text-fg-primary rounded-control-sm hover:bg-surface-hover focus-visible:outline-accent ease-studio -mx-1 min-w-0 truncate px-1 py-0.5 font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {name}
        </button>
      ) : (
        <span className="text-fg-primary min-w-0 truncate font-medium">
          {name}
        </span>
      )}
      <span aria-hidden="true" className="text-fg-muted shrink-0">
        /
      </span>
      <span className="text-fg-secondary min-w-0 truncate">Home</span>
      <span
        data-project-status={status}
        className="border-line bg-surface-panel-secondary text-fg-secondary ml-1 flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium"
      >
        <span
          aria-hidden="true"
          className={cn(
            "size-1.5 rounded-full",
            status === "saved" && "bg-success",
            status === "unsaved" && "bg-amber-500",
            status === "new" && "bg-fg-muted",
            status === "saving" && "bg-accent animate-pulse",
          )}
        />
        {STATUS_LABELS[status]}
      </span>
      {project?.recovery && (
        <span
          data-recovery-status={project.recovery.state}
          title={project.recovery.description}
          className={cn(
            "flex shrink-0 items-center gap-1 text-xs",
            project.recovery.state === "protected"
              ? "text-fg-secondary"
              : "text-amber-700",
          )}
        >
          {project.recovery.state === "protected" ? (
            <ShieldCheck aria-hidden="true" className="size-3.5" />
          ) : (
            <ShieldAlert aria-hidden="true" className="size-3.5" />
          )}
          {project.recovery.state === "protected"
            ? "Recovery protected"
            : "Recovery unavailable"}
        </span>
      )}
      {project?.source && (
        <span
          data-project-source
          title={project.source.description}
          className="text-fg-secondary min-w-0 truncate text-xs"
        >
          <span className="sr-only">Stored in: </span>
          {project.source.label}
        </span>
      )}
    </div>
  );
}
