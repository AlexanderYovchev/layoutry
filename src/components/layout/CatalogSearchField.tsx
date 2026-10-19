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
    <label className="rounded-control border-line bg-surface-panel-secondary text-fg-muted m-1.5 mb-0 flex h-8 shrink-0 items-center gap-2 border px-2.5">
      <Search aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="sr-only">Search {categoryLabel}</span>
      <input
        type="search"
        disabled
        placeholder={`Search ${categoryLabel.toLowerCase()}`}
        className="text-fg-primary placeholder:text-fg-muted w-full min-w-0 bg-transparent text-sm focus:outline-none disabled:cursor-not-allowed"
      />
    </label>
  );
}
