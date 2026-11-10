import { MAX_NAVIGATION_LINKS, NAVIGATION_LINK_WRAP_HINT_THRESHOLD } from "@/features/editor/commands/navigationLinkCommands";

/**
 * The Navigation links section's copy (BC-06.2). Kept out of the component
 * so unit and browser tests assert the exact wording instead of repeating it.
 */
export const NAVIGATION_LINKS_COPY = {
  title: "Navigation links",
  addLink: "Add link",
  addLinkTitle: "Add a link styled like the last one.",
  maximum: `Maximum of ${MAX_NAVIGATION_LINKS} navigation links.`,
  maximumNote: `Maximum of ${MAX_NAVIGATION_LINKS} navigation links. Remove a link to add another.`,
  wrapHint: `With ${NAVIGATION_LINK_WRAP_HINT_THRESHOLD} or more links, consider turning on Wrap in Content Layout to avoid overflow on smaller screens.`,
  empty: "No links yet",
  untitled: "Untitled link",
  selectTitle: "Select this link to edit its text and destination.",
} as const;

/** The section's count line: "No links yet", "1 link", "4 links". */
export function formatNavigationLinkCount(count: number): string {
  if (count === 0) return NAVIGATION_LINKS_COPY.empty;
  return count === 1 ? "1 link" : `${count} links`;
}
