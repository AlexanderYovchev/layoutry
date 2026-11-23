// min-w-101 (404px) plus the mx-2 gutters (2 × 8px) is 420px — kept in
// sync with MIN_WORKSPACE_WIDTH in AppShell.tsx, which uses the same
// number when clamping the side panels so the Workspace never has to go
// below this floor.
//
// The user document's own inherited baseline (font, text color,
// background, color-scheme) is set by the page sheet itself — the
// [data-document-surface] boundary in DocumentCanvas.tsx — so it holds
// regardless of what this editor-chrome region inherits.
const WORKSPACE_SURFACE_CLASSES =
  "rounded-surface border-line bg-surface-workspace shadow-panel flex items-start justify-center overflow-y-auto border px-6 py-10 sm:px-10 md:py-14";

// BC-13.3: optional controls (the Canvas control strip) float over the
// Workspace's top-right corner. They sit in a non-scrolling wrapper, so they
// stay put while the page scrolls, never take width from the page (the
// document's own layout width is unchanged), and are never inside the
// document surface. top-3 + their height stays within the Workspace's own
// top padding; right-5 keeps them clear of the scrollbar.
export function Workspace({
  children,
  controls,
}: {
  children: React.ReactNode;
  controls?: React.ReactNode;
}) {
  if (!controls) {
    return (
      <main
        aria-label="Workspace"
        className={`${WORKSPACE_SURFACE_CLASSES} mx-2 min-w-101 flex-1`}
      >
        {children}
      </main>
    );
  }
  return (
    <div className="relative mx-2 flex min-w-101 flex-1">
      <main
        aria-label="Workspace"
        className={`${WORKSPACE_SURFACE_CLASSES} min-w-0 flex-1`}
      >
        {children}
      </main>
      <div className="absolute top-3 right-5 z-10">{controls}</div>
    </div>
  );
}
