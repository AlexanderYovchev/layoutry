export function Workspace({ children }: { children: React.ReactNode }) {
  return (
    <main
      aria-label="Workspace"
      className="flex min-w-0 flex-1 items-center justify-center overflow-auto bg-zinc-100 p-8 dark:bg-zinc-950"
    >
      {children}
    </main>
  );
}
