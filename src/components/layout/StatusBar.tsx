export function StatusBar() {
  return (
    <footer
      aria-label="Status bar"
      className="flex h-7 shrink-0 items-center justify-between border-t border-zinc-200 px-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400"
    >
      <div className="flex items-center gap-3">
        <span>Ready</span>
        <span>Saved</span>
      </div>
      <div className="flex items-center gap-3">
        <span>Canvas: —</span>
        <span>Zoom: 100%</span>
        <span>0 selected</span>
      </div>
    </footer>
  );
}
