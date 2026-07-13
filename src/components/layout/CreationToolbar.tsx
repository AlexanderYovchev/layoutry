import {
  Code2,
  Component,
  Image,
  LayoutGrid,
  Palette,
  Search,
  TextCursorInput,
} from "lucide-react";

const categories = [
  { label: "HTML", icon: Code2 },
  { label: "Components", icon: Component },
  { label: "Layout", icon: LayoutGrid },
  { label: "Media", icon: Image },
  { label: "Forms", icon: TextCursorInput },
  { label: "Styles", icon: Palette },
] as const;

export function CreationToolbar() {
  return (
    <div
      role="toolbar"
      aria-label="Creation toolbar"
      className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-black"
    >
      <div className="flex items-center gap-1">
        {categories.map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            <Icon aria-hidden="true" className="size-4" />
            {label}
          </button>
        ))}
      </div>

      <label className="flex w-48 shrink-0 items-center gap-1.5 rounded-md border border-zinc-200 px-2 py-1.5 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        <Search aria-hidden="true" className="size-4" />
        <span className="sr-only">Search elements</span>
        <input
          type="search"
          disabled
          placeholder="Search elements"
          className="w-full bg-transparent text-sm text-zinc-600 placeholder:text-zinc-400 focus:outline-none disabled:cursor-not-allowed dark:text-zinc-300 dark:placeholder:text-zinc-500"
        />
      </label>
    </div>
  );
}
