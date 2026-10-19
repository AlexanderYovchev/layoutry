import {
  creationToolbarCategories,
  type CatalogCardPlaceholder,
  type CategorySection,
  type ToolbarCategoryContent,
} from "@/components/layout/creationToolbarCategories";

/** The Resource panel sections that show a real, insertable library. */
export type ResourceCatalogId = "elements" | "components";

/**
 * One filterable group in a Resource panel library — the unit the
 * category filter chips select. Elements: one group per toolbar category
 * (HTML, Layout, Media, Forms), each keeping its own sections.
 * Components: one group per section of the Components category.
 */
export interface CatalogGroup {
  id: string;
  label: string;
  /** The toolbar category this group's cards come from — keys its accent color. */
  categoryId: string;
  sections: CategorySection[];
}

// Styles is deliberately absent: its entries are style presets, not
// insertable elements (and none has a factory yet), so it stays in the
// toolbar only.
const ELEMENT_CATEGORY_IDS = ["html", "layout", "media", "forms"] as const;
const COMPONENT_CATEGORY_ID = "components";

/**
 * Derives a library's groups from the creation toolbar's catalog data —
 * the single source of truth for every insertable entry. Nothing is
 * copied or redefined: groups reference the same section and card
 * objects the toolbar dropdowns render.
 */
export function buildResourceCatalogGroups(
  catalogId: ResourceCatalogId,
  categories: readonly ToolbarCategoryContent[] = creationToolbarCategories,
): CatalogGroup[] {
  if (catalogId === "elements") {
    return ELEMENT_CATEGORY_IDS.flatMap((id) => {
      const category = categories.find((candidate) => candidate.id === id);
      return category
        ? [
            {
              id: category.id,
              label: category.label,
              categoryId: category.id,
              sections: category.sections,
            },
          ]
        : [];
    });
  }

  const components = categories.find(
    (candidate) => candidate.id === COMPONENT_CATEGORY_ID,
  );
  if (!components) return [];
  return components.sections.map((section) => ({
    id: section.id,
    label: section.label,
    categoryId: components.id,
    sections: [section],
  }));
}

function cardMatches(
  card: CatalogCardPlaceholder,
  section: CategorySection,
  group: CatalogGroup,
  terms: readonly string[],
) {
  const haystack =
    `${card.name} ${card.description} ${section.label} ${group.label}`.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

interface CatalogFilter {
  /** Free text; every whitespace-separated term must appear in the card's name, description, section, or group label. */
  query: string;
  /** Restricts results to one group; null shows every group. */
  groupId: string | null;
}

/** Returns only the groups/sections that still contain at least one matching card. */
export function filterCatalogGroups(
  groups: readonly CatalogGroup[],
  { query, groupId }: CatalogFilter,
): CatalogGroup[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

  return groups
    .filter((group) => groupId === null || group.id === groupId)
    .map((group) => ({
      ...group,
      sections: group.sections
        .map((section) => ({
          ...section,
          cards: section.cards.filter((card) =>
            cardMatches(card, section, group, terms),
          ),
        }))
        .filter((section) => section.cards.length > 0),
    }))
    .filter((group) => group.sections.length > 0);
}

export function countCatalogCards(groups: readonly CatalogGroup[]): number {
  return groups.reduce(
    (total, group) =>
      total +
      group.sections.reduce((sum, section) => sum + section.cards.length, 0),
    0,
  );
}
