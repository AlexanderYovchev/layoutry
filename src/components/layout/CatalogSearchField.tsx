import { Search } from "lucide-react";

interface CatalogSearchFieldProps {
  categoryLabel: string;
}

/**
 * Placeholder search field shown at the top of every category catalog.
 * Not wired to any search logic yet — establishes where a future unified
 * search (HTML, components, templates, assets, favorites, recent items)
 * will live within each dropdown.
 */
export function CatalogSearchField({ categoryLabel }: CatalogSearchFieldProps) {
  return (
    <label className="flex shrink-0 items-center gap-1.5 border-b border-zinc-200 px-3 py-2 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
      <Search aria-hidden="true" className="size-3.5" />
      <span className="sr-only">Search {categoryLabel}</span>
      <input
        type="search"
        disabled
        placeholder={`Search ${categoryLabel.toLowerCase()}`}
        className="w-full bg-transparent text-sm text-zinc-600 placeholder:text-zinc-400 focus:outline-none disabled:cursor-not-allowed dark:text-zinc-300 dark:placeholder:text-zinc-500"
      />
    </label>
  );
}
