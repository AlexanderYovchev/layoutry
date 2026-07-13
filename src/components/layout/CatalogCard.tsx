import type { CatalogCardPlaceholder } from "@/components/layout/creationToolbarCategories";

interface CatalogCardProps {
  card: CatalogCardPlaceholder;
  registerRef?: (el: HTMLButtonElement | null) => void;
}

/**
 * Represents one future catalog entry (an HTML element, component, template,
 * or asset). Every card is disabled today — this establishes the card shape
 * (icon slot + name + description) so a real, selectable catalog can replace
 * the placeholder content later without restructuring the layout.
 */
export function CatalogCard({ card, registerRef }: CatalogCardProps) {
  return (
    <button
      ref={registerRef}
      type="button"
      role="menuitem"
      disabled={card.disabled}
      tabIndex={-1}
      className="flex w-full items-start gap-2.5 rounded-md px-3 py-2 text-left disabled:cursor-not-allowed"
    >
      <span
        aria-hidden="true"
        className="mt-0.5 size-8 shrink-0 rounded-md border border-dashed border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-zinc-600 dark:text-zinc-400">
          {card.name}
        </span>
        <span className="block truncate text-xs text-zinc-400 dark:text-zinc-500">
          {card.description}
        </span>
      </span>
    </button>
  );
}
