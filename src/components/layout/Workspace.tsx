// min-w-105 is 420px — kept in sync with MIN_WORKSPACE_WIDTH in
// AppShell.tsx, which uses the same number when clamping the side
// panels so the Workspace never has to go below this floor.
export function Workspace({ children }: { children: React.ReactNode }) {
  return (
    <main
      aria-label="Workspace"
      className="flex min-w-105 flex-1 items-start justify-center overflow-y-auto bg-zinc-100 px-6 py-10 sm:px-10 md:py-14 dark:bg-zinc-950"
    >
      {children}
    </main>
  );
}
