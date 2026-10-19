// min-w-101 (404px) plus the mx-2 gutters (2 × 8px) is 420px — kept in
// sync with MIN_WORKSPACE_WIDTH in AppShell.tsx, which uses the same
// number when clamping the side panels so the Workspace never has to go
// below this floor.
//
// font-sans + the zinc text colors deliberately pin what the canvas
// document inherits to exactly what it inherited before the editor
// chrome got its own typeface/text tokens (font-ui, text-fg-primary on
// <body>) — user-authored content must never pick up editor theming.
export function Workspace({ children }: { children: React.ReactNode }) {
  return (
    <main
      aria-label="Workspace"
      className="rounded-surface border-line bg-surface-workspace shadow-panel mx-2 flex min-w-101 flex-1 items-start justify-center overflow-y-auto border px-6 py-10 font-sans text-zinc-950 sm:px-10 md:py-14 dark:text-zinc-50"
    >
      {children}
    </main>
  );
}
