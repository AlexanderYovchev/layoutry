/**
 * The single source of truth for "can this node type accept children."
 * Every insertable type this checkpoint (container, heading, paragraph,
 * button, image) is uniformly valid inside any container-capable tag —
 * there's no finer per-type matrix yet, since leaf types (heading,
 * paragraph, button, image) uniformly reject all children and container
 * types uniformly accept all five. Reused by click-insert, drag-insert,
 * and Canvas drop-target highlighting so the rule is never duplicated.
 */
const CONTAINER_TAGS: ReadonlySet<string> = new Set(["page", "body", "div", "section"]);

export function canContainChildren(tag: string): boolean {
  return CONTAINER_TAGS.has(tag);
}
