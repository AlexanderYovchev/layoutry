export function InspectorPanel({ children }: { children: React.ReactNode }) {
  return (
    <aside
      aria-label="Inspector panel"
      className="flex w-72 shrink-0 flex-col overflow-hidden border-l border-zinc-200 transition-[width] duration-200 ease-in-out lg:w-80 dark:border-zinc-800"
    >
      {children}
    </aside>
  );
}
