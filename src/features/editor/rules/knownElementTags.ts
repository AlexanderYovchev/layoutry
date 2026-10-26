import { HEADING_TAGS } from "@/features/editor/types/heading";

/**
 * Every element tag the editor can create or render (PROJECT-1.1). The
 * document root is the virtual "page" tag; the rest are real HTML tags the
 * element factories, compositions, heading-level changes and table
 * commands produce. Loading a project file rejects any other tag — an
 * unknown tag means a corrupted, hostile or newer-format file, never a
 * document this editor wrote.
 *
 * knownElementTags.test.ts instantiates every insertable element type and
 * fails if any tag it creates is missing here, so a new factory cannot
 * silently produce documents that would no longer load.
 */
export const KNOWN_ELEMENT_TAGS: ReadonlySet<string> = new Set([
  "page",
  // Structure and sections
  "body",
  "div",
  "section",
  "header",
  "footer",
  "main",
  "article",
  "aside",
  "nav",
  "figure",
  "figcaption",
  "dialog",
  // Text
  ...HEADING_TAGS,
  "p",
  "blockquote",
  "a",
  "button",
  "hr",
  // Lists
  "ul",
  "ol",
  "li",
  // Forms
  "form",
  "label",
  "input",
  "textarea",
  "select",
  "option",
  "fieldset",
  "legend",
  "progress",
  // Tables
  "table",
  "caption",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  // Media
  "img",
  "video",
  "audio",
  "iframe",
  "svg",
]);

export function isKnownElementTag(tag: string): boolean {
  return KNOWN_ELEMENT_TAGS.has(tag);
}
