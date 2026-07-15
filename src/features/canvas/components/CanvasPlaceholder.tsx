import { MousePointerClick } from "lucide-react";

/**
 * The page sheet: a fixed-identity "desktop page" artboard. Width is
 * capped at 1440px but yields to the available workspace width so the
 * canvas never forces horizontal scrolling; height is tall enough to
 * suggest a real page that will eventually scroll.
 */
export function CanvasPlaceholder() {
  return (
    <div className="animate-fade-in-up relative flex min-h-500 w-full max-w-360 shrink-0 flex-col rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-black">
      <span className="absolute top-4 left-4 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs leading-tight shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <span className="block font-medium text-zinc-600 dark:text-zinc-300">
          Desktop
        </span>
        <span className="block text-zinc-500 dark:text-zinc-400">
          1440 &times; Auto
        </span>
      </span>

      <div className="flex flex-col items-center gap-2 px-8 pt-28 text-center">
        <MousePointerClick
          aria-hidden="true"
          className="size-6 text-zinc-300 dark:text-zinc-600"
        />
        <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
          Build your page
        </h2>
        <p className="max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
          Start by adding HTML elements or Components from the Creation Toolbar.
        </p>
      </div>
    </div>
  );
}
