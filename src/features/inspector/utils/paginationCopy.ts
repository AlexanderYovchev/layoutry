import { MAX_PAGINATION_PAGES, MIN_PAGINATION_PAGES } from "@/features/editor/commands/paginationCommands";

/**
 * The Pagination section's copy (BC-09.3). Kept out of the component so
 * unit and browser tests assert the exact wording instead of repeating it.
 */
export const PAGINATION_COPY = {
  title: "Pagination",
  pagesList: "Pages",
  addPage: "Add page",
  addPageTitle: "Add a page styled like the other pages.",
  maximumNote: `Maximum of ${MAX_PAGINATION_PAGES} pages. Remove a page to add another.`,
  minimumNote: `A Pagination keeps at least ${MIN_PAGINATION_PAGES} page.`,
  current: "Current page",
  setCurrent: "Set as current",
  labelField: "Label",
  destinationField: "Destination",
  destinationPlaceholder: "/blog/page/2, ?page=2, https://…",
  blankLabel: "A page needs a label. The previous label was kept.",
  invalidDestination:
    "Use https://, http://, mailto:, tel:, a relative path (/blog/2) or #anchor. The previous destination was kept.",
  currentDestinationNote: "The current page isn't a link on the page, but keeps this destination for when another page is current.",
  controlsTitle: "Controls",
  controlsNote:
    "Navigation destinations update automatically when the current page or page URLs change. First, Previous, Next and Last are disabled where they would lead nowhere.",
  hideNote:
    "Hiding a navigation control removes it. Showing it again restores its default label, styled like the other navigation controls.",
  ellipsisNeedsPages: "The ellipsis needs at least 2 pages.",
  ellipsisConsecutive:
    "The pages on both sides of “…” are numbered one after the other, so it suggests pages that don't exist. Rename the last page (e.g. to 10) or turn the ellipsis off.",
} as const;

export const PAGINATION_CONTROL_LABELS = {
  first: "First",
  previous: "Previous",
  next: "Next",
  last: "Last",
  ellipsis: "Ellipsis (…)",
} as const;

/** "1 page", "3 pages, page 2 is current". */
export function formatPaginationSummary(pageCount: number, currentPosition: number): string {
  const count = pageCount === 1 ? "1 page" : `${pageCount} pages`;
  return currentPosition > 0 ? `${count}, page ${currentPosition} is current` : count;
}

/**
 * What the Inspector says about a selected child of a marked Pagination
 * (BC-09.4): why it never activates, or that its destination is managed.
 * Informative only: nothing is removed or locked.
 */
export const PAGINATION_CHILD_COPY = {
  title: "In this Pagination",
  disabled:
    "This navigation control is disabled: it doesn't navigate, and its interactions don't run in Preview or on exported pages. It becomes active automatically when the current page changes.",
  currentPage:
    "This is the current page. It is intentionally not a link and doesn't run interactions in Preview or on exported pages. Its destination is kept for when another page is current.",
  ellipsis:
    "This “…” is a decorative separator. Screen readers skip it, and it doesn't run interactions.",
  managedDestination:
    "This control's destination is set automatically from the pages. Change a page's destination in the Pagination section instead.",
  interactionsInactive:
    "These interactions won't run: this element is disabled, the current page, or a decorative separator in its Pagination.",
} as const;
