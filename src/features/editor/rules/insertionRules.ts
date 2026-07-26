/**
 * The single source of truth for "can this node type accept children."
 * Every insertable type this checkpoint (container, heading, paragraph,
 * button, image) is uniformly valid inside any container-capable tag —
 * there's no finer per-type matrix yet, since leaf types (heading,
 * paragraph, button, image) uniformly reject all children and container
 * types uniformly accept all five. Reused by click-insert, drag-insert,
 * Canvas drop-target highlighting, and elementCapabilities.ts so the rule
 * is never duplicated. Includes tags with no catalog factory yet (form,
 * list, semantic sectioning elements, table) so containment — and, via
 * elementCapabilities, resizing — is already correct the moment a factory
 * for one of them is added, with no change required here.
 */
const CONTAINER_TAGS: ReadonlySet<string> = new Set([
  "page",
  "body",
  "div",
  "section",
  "form",
  "ul",
  "ol",
  "li",
  "header",
  "footer",
  "main",
  "article",
  "aside",
  "nav",
  "table",
]);

export function canContainChildren(tag: string): boolean {
  return CONTAINER_TAGS.has(tag);
}
