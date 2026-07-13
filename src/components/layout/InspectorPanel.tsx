export function InspectorPanel({ children }: { children: React.ReactNode }) {
  return (
    <aside
      aria-label="Inspector panel"
      className="flex w-72 shrink-0 flex-col border-l border-zinc-200 lg:w-80 dark:border-zinc-800"
    >
      <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Inspector
        </p>
      </div>
      <div className="flex flex-1 items-center justify-center p-3">
        {children}
      </div>
    </aside>
  );
}
