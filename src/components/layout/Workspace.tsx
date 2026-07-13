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
