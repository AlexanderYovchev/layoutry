import { MousePointerClick } from "lucide-react";

export function CanvasPlaceholder() {
  return (
    <div className="flex aspect-4/3 max-h-full w-full max-w-4xl flex-col items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white px-8 text-center shadow-sm dark:border-zinc-800 dark:bg-black">
      <MousePointerClick
        aria-hidden="true"
        className="size-6 text-zinc-300 dark:text-zinc-600"
      />
      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
        Start building your page
      </p>
      <p className="max-w-xs text-sm text-zinc-400 dark:text-zinc-500">
        Choose an HTML element from the Creation Toolbar, or begin from a
        template.
      </p>
    </div>
  );
}
