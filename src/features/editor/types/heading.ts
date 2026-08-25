/**
 * The single source of truth for "which tags are a Heading" (Checkpoint
 * 1.7) — previously duplicated as a local HEADING_TAGS/isHeadingTag pair
 * inside HeadingElement.tsx alone (Checkpoint 1.3). Centralized here now
 * that a second consumer (elementCapabilities.ts's supportsHeadingLevel
 * gate) needs the exact same list; HeadingElement.tsx imports this
 * instead of keeping its own copy.
 */
export const HEADING_TAGS = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;

export type HeadingTag = (typeof HEADING_TAGS)[number];

export function isHeadingTag(tag: string): tag is HeadingTag {
  return (HEADING_TAGS as readonly string[]).includes(tag);
}
