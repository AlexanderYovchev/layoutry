export function ProjectIdentity() {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden px-3 text-sm">
      <span className="text-fg-primary min-w-0 truncate font-medium">
        Untitled Project
      </span>
      <span aria-hidden="true" className="text-fg-muted shrink-0">
        /
      </span>
      <span className="text-fg-secondary min-w-0 truncate">Home</span>
      <span
        title="Saving isn't implemented yet"
        className="border-line bg-surface-panel-secondary text-fg-secondary ml-1 shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium"
      >
        Draft
      </span>
    </div>
  );
}
