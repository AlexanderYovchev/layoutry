import { ListTree } from "lucide-react";

export function StructureEmptyState() {
  return (
    <div className="animate-fade-in flex flex-col items-center gap-2 px-4 py-8 text-center">
      <ListTree
        aria-hidden="true"
        className="size-5 text-zinc-300 dark:text-zinc-600"
      />
      <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
        No elements yet
      </h3>
      <p className="max-w-56 text-sm text-zinc-500 dark:text-zinc-400">
        Add a component from the library and it will appear here.
      </p>
    </div>
  );
}
