import { SlidersHorizontal } from "lucide-react";

export function InspectorPlaceholder() {
  return (
    <div className="animate-fade-in flex flex-col items-center gap-2 text-center">
      <SlidersHorizontal
        aria-hidden="true"
        className="size-5 text-zinc-300 dark:text-zinc-600"
      />
      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
        No element selected
      </p>
      <p className="max-w-56 text-sm text-zinc-400 dark:text-zinc-500">
        Select an element on the canvas to view and edit its properties here.
      </p>
    </div>
  );
}
