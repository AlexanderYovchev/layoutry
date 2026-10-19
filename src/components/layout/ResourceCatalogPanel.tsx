"use client";

import {
  memo,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Search, SearchX, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CatalogCard } from "@/components/layout/CatalogCard";
import { categoryAppearance } from "@/components/layout/creationToolbarCategoryAppearance";
import type { CatalogCardPlaceholder } from "@/components/layout/creationToolbarCategories";
import {
  buildResourceCatalogGroups,
  countCatalogCards,
  filterCatalogGroups,
  type CatalogGroup,
  type ResourceCatalogId,
} from "@/components/layout/resourceCatalog";

interface ResourceCatalogPanelProps {
  catalogId: ResourceCatalogId;
  /** The Resource panel section's label, e.g. "Elements" — used for the search field's name and messages. */
  label: string;
  onActivateCard?: (card: CatalogCardPlaceholder) => void;
}

/**
 * The Resource panel's insertable library (Elements / Components): a
 * functional search, category filter chips, and a responsive tile grid.
 * Every tile is the shared CatalogCard, so click-to-insert and
 * drag-to-insert go through exactly the same paths as the toolbar
 * dropdowns (EditorApp's handleActivateCard / handleDragEnd).
 */
export function ResourceCatalogPanel({
  catalogId,
  label,
  onActivateCard,
}: ResourceCatalogPanelProps) {
  const groups = useMemo(
    () => buildResourceCatalogGroups(catalogId),
    [catalogId],
  );
  const [query, setQuery] = useState("");
  const [groupId, setGroupId] = useState<string | null>(null);
  const filterRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const searchId = useId();
  const resultsId = useId();

  const visibleGroups = useMemo(
    () => filterCatalogGroups(groups, { query, groupId }),
    [groups, query, groupId],
  );

  // EditorApp passes a new onActivateCard every render; routing it through
  // a ref gives the memoized tile list one stable callback that still
  // always calls the latest handler.
  const onActivateCardRef = useRef(onActivateCard);
  useLayoutEffect(() => {
    onActivateCardRef.current = onActivateCard;
  });
  const handleActivateCard = useCallback((card: CatalogCardPlaceholder) => {
    onActivateCardRef.current?.(card);
  }, []);
  const resultCount = countCatalogCards(visibleGroups);
  const isFiltered = query.trim() !== "" || groupId !== null;
  // Elements groups are whole toolbar categories with several sections
  // each, so they get their own heading; Components groups are single
  // sections, so the section heading is the only heading.
  const showGroupHeadings = catalogId === "elements";

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape" && query !== "") {
      event.preventDefault();
      event.stopPropagation();
      setQuery("");
    }
  }

  function clearFilters() {
    setQuery("");
    setGroupId(null);
  }

  const filterOptions: { id: string | null; label: string }[] = [
    { id: null, label: "All" },
    ...groups.map((group) => ({ id: group.id, label: group.label })),
  ];

  // WAI-ARIA radio group: one tab stop (the checked option); arrow keys
  // move the selection and focus together, wrapping at either end.
  function handleFilterKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (index + step + filterOptions.length) % filterOptions.length;
    setGroupId(filterOptions[next].id);
    filterRefs.current[next]?.focus();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-2.5 px-3 pt-3 pb-2">
        <label
          htmlFor={searchId}
          className="rounded-control border-line bg-surface-panel text-fg-muted ease-studio focus-within:border-accent focus-within:ring-accent/20 flex h-9 items-center gap-2 border px-2.5 transition-colors duration-150 focus-within:ring-2"
        >
          <Search aria-hidden="true" className="size-4 shrink-0" />
          <span className="sr-only">Search {label.toLowerCase()}</span>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={`Search ${label.toLowerCase()}…`}
            aria-controls={resultsId}
            autoComplete="off"
            className="text-fg-primary placeholder:text-fg-muted w-full min-w-0 bg-transparent text-sm focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {query !== "" && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="text-fg-secondary hover:bg-surface-hover hover:text-fg-primary focus-visible:outline-accent flex size-5 shrink-0 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2"
            >
              <X aria-hidden="true" className="size-3.5" />
            </button>
          )}
        </label>

        <div
          role="radiogroup"
          aria-label={`Filter ${label.toLowerCase()} by category`}
          // One scrollable row rather than wrapping: Components has eight
          // filters, which would otherwise wrap into ~7 rows and push the
          // tiles below the fold. Focus (arrow keys) scrolls the checked
          // option into view; py-1 keeps focus rings from being clipped.
          className="-mx-3 flex [scrollbar-width:thin] gap-1.5 overflow-x-auto px-3 py-1"
        >
          {filterOptions.map((option, index) => {
            const isActive = option.id === groupId;
            const accent = option.id
              ? categoryAppearance[
                  groups.find((group) => group.id === option.id)?.categoryId ??
                    ""
                ]
              : undefined;
            const showDot = catalogId === "elements" && accent;
            return (
              <button
                key={option.id ?? "all"}
                ref={(el) => {
                  filterRefs.current[index] = el;
                }}
                type="button"
                role="radio"
                aria-checked={isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setGroupId(option.id)}
                onKeyDown={(event) => handleFilterKeyDown(event, index)}
                className={cn(
                  "ease-studio focus-visible:outline-accent flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1",
                  isActive
                    ? "border-accent/45 bg-surface-selected text-fg-primary"
                    : "border-line bg-surface-panel text-fg-secondary hover:bg-surface-hover hover:text-fg-primary",
                )}
              >
                {showDot && accent && (
                  <accent.icon
                    aria-hidden="true"
                    className={cn("size-3.5", accent.accent.icon)}
                  />
                )}
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {isFiltered
          ? `${resultCount} ${resultCount === 1 ? "result" : "results"}`
          : ""}
      </p>

      <div
        id={resultsId}
        className="@container min-h-0 flex-1 overflow-y-auto px-3 pt-1 pb-4"
      >
        {visibleGroups.length === 0 ? (
          <div className="animate-fade-in flex flex-col items-center gap-2 px-2 py-10 text-center">
            <SearchX aria-hidden="true" className="text-fg-muted size-6" />
            <p className="text-fg-primary text-sm font-medium">No matches</p>
            <p className="text-fg-secondary max-w-52 text-xs">
              Nothing in {label} matches
              {query.trim() !== "" ? ` “${query.trim()}”` : " this filter"}.
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-control border-line bg-surface-panel text-fg-primary hover:bg-surface-hover focus-visible:outline-accent mt-1 border px-3 py-1.5 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <CatalogTileGroups
            groups={visibleGroups}
            showGroupHeadings={showGroupHeadings}
            onActivate={handleActivateCard}
          />
        )}
      </div>
    </div>
  );
}

interface CatalogTileGroupsProps {
  groups: readonly CatalogGroup[];
  showGroupHeadings: boolean;
  onActivate: (card: CatalogCardPlaceholder) => void;
}

/**
 * The tile list, memoized: the Resource panel re-renders with every
 * editor state change (EditorApp re-renders AppShell), but this list of
 * ~100 drag-enabled tiles only needs to re-render when the search,
 * filter, or catalog actually changes.
 */
const CatalogTileGroups = memo(function CatalogTileGroups({
  groups,
  showGroupHeadings,
  onActivate,
}: CatalogTileGroupsProps) {
  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => {
        const appearance = categoryAppearance[group.categoryId];
        const GroupIcon = appearance?.icon;
        return (
          <section
            key={group.id}
            aria-label={group.label}
            className="flex flex-col gap-3"
          >
            {showGroupHeadings && (
              <h3 className="text-fg-primary flex items-center gap-2 text-[13px] font-semibold">
                {GroupIcon && (
                  <GroupIcon
                    aria-hidden="true"
                    className={cn("size-4", appearance.accent.icon)}
                  />
                )}
                {group.label}
              </h3>
            )}
            {group.sections.map((section) => {
              const SectionHeading = showGroupHeadings ? "h4" : "h3";
              return (
                <div key={section.id} className="flex flex-col gap-2">
                  <SectionHeading
                    className={cn(
                      showGroupHeadings
                        ? "text-fg-secondary text-[11px] font-semibold tracking-wider uppercase"
                        : "text-fg-primary text-[13px] font-semibold",
                    )}
                  >
                    {section.label}
                  </SectionHeading>
                  <div className="grid grid-cols-1 gap-2 @min-[11rem]:grid-cols-2">
                    {section.cards.map((card) => (
                      <CatalogCard
                        key={card.id}
                        card={card}
                        variant="tile"
                        dragId={`resource-${card.id}`}
                        iconClassName={appearance?.accent.icon}
                        onActivate={onActivate}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
});
