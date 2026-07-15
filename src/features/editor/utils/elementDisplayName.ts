import type { EditorElementNode } from "@/features/editor/types/document";

const TAG_DISPLAY_NAMES: Record<string, string> = {
  page: "Page",
  body: "Body",
  div: "Container",
  section: "Section",
  h1: "Heading",
  h2: "Heading",
  h3: "Heading",
  h4: "Heading",
  h5: "Heading",
  h6: "Heading",
  p: "Paragraph",
  button: "Button",
  img: "Image",
  nav: "Navigation",
  header: "Header",
  footer: "Footer",
  form: "Form",
};

/**
 * The single friendly-name source for the document tree. A node's own
 * displayName (e.g. a component's assigned label) always wins; otherwise
 * this falls back to the tag mapping, then the raw tag itself for
 * anything unrecognized.
 */
export function getElementDisplayName(node: EditorElementNode): string {
  return node.displayName ?? TAG_DISPLAY_NAMES[node.tag] ?? node.tag;
}

/**
 * The tag badge is only useful when it tells the user something the
 * display name doesn't already say — e.g. "Heading" next to "h1", or a
 * custom component label like "Primary Button" next to "button". When
 * the display name is just the tag itself (Section/section,
 * Header/header, Page/page), showing the tag again would be redundant.
 */
export function shouldShowTagBadge(node: EditorElementNode): boolean {
  return getElementDisplayName(node).toLowerCase() !== node.tag.toLowerCase();
}
