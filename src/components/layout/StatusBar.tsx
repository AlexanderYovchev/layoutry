import { cn } from "@/lib/utils";

interface StatusBarProps {
  /** The editor's real Design/Preview mode — the same value the header's Preview button reflects. */
  mode: "design" | "preview";
}

/**
 * Shows only information that is true (UI-1.7). The earlier placeholders
 * ("Saved", "Zoom: 100%", "0 selected", "Canvas: —") looked live but were
 * static, so they were removed rather than wired up: saving, zoom and
 * selection reporting don't exist in the status bar yet. The mode comes
 * from AppShell's existing previewControl — no new editor subscription.
 * Since PROJECT-1.2 the right side states where projects are kept; the
 * live save status is in the header, next to the project name.
 */
export function StatusBar({ mode }: StatusBarProps) {
  const isPreview = mode === "preview";

  return (
    <footer
      aria-label="Status bar"
      className="border-line bg-surface-statusbar text-fg-secondary flex h-7 shrink-0 items-center justify-between gap-3 border-t px-3 text-xs"
    >
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className={cn(
            "size-1.5 rounded-full",
            isPreview ? "bg-accent-violet" : "bg-success",
          )}
        />
        {isPreview ? "Preview mode" : "Design mode"}
      </span>
      <span className="truncate">Projects are saved on this device</span>
    </footer>
  );
}
