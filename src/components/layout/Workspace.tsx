// min-w-101 (404px) plus the mx-2 gutters (2 × 8px) is 420px — kept in
// sync with MIN_WORKSPACE_WIDTH in AppShell.tsx, which uses the same
// number when clamping the side panels so the Workspace never has to go
// below this floor.
//
// The user document's own inherited baseline (font, text color,
// background, color-scheme) is set by the page sheet itself — the
// [data-document-surface] boundary in DocumentCanvas.tsx — so it holds
// regardless of what this editor-chrome region inherits.
export function Workspace({ children }: { children: React.ReactNode }) {
  return (
    <main
      aria-label="Workspace"
      className="rounded-surface border-line bg-surface-workspace shadow-panel mx-2 flex min-w-101 flex-1 items-start justify-center overflow-y-auto border px-6 py-10 sm:px-10 md:py-14"
    >
      {children}
    </main>
  );
}
