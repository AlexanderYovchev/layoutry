export function StatusBar() {
  return (
    <footer
      aria-label="Status bar"
      className="border-line bg-surface-statusbar text-fg-secondary flex h-7 shrink-0 items-center justify-between border-t px-3 text-xs"
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
