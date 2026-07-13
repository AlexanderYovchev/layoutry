export function ProjectIdentity() {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden px-3 text-sm">
      <span className="min-w-0 truncate font-medium text-zinc-700 dark:text-zinc-300">
        Untitled Project
      </span>
      <span
        aria-hidden="true"
        className="shrink-0 text-zinc-300 dark:text-zinc-700"
      >
        /
      </span>
      <span className="min-w-0 truncate text-zinc-500 dark:text-zinc-400">
        Home
      </span>
      <span
        title="Saving isn't implemented yet"
        className="ml-1 shrink-0 rounded-full border border-zinc-200 px-2 py-0.5 text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-500"
      >
        Draft
      </span>
    </div>
  );
}
