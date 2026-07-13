import { Blocks, FileStack, Image, Shapes } from "lucide-react";

const categories = [
  { label: "Elements", icon: Shapes },
  { label: "Components", icon: Blocks },
  { label: "Templates", icon: FileStack },
  { label: "Assets", icon: Image },
] as const;

export function ResourceSidebar() {
  return (
    <aside
      aria-label="Resource panel"
      className="flex shrink-0 border-r border-zinc-200 dark:border-zinc-800"
    >
      <nav
        aria-label="Resource categories"
        className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-zinc-200 py-2 dark:border-zinc-800"
      >
        {categories.map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            disabled
            aria-label={label}
            className="flex size-10 items-center justify-center rounded-md text-zinc-300 disabled:cursor-not-allowed dark:text-zinc-700"
          >
            <Icon aria-hidden="true" className="size-5" />
          </button>
        ))}
      </nav>

      <div className="w-52 shrink-0 overflow-hidden p-3 transition-[width] duration-200 ease-in-out lg:w-60">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Elements
        </p>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Resource library — coming soon
        </p>
      </div>
    </aside>
  );
}
