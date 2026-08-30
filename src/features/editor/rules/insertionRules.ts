/**
 * The single source of truth for "can this node type accept children at
 * all" — the binary half of containment. Most insertable types (heading,
 * paragraph, button, image, link, list item) uniformly reject all
 * children; most container tags uniformly accept anything (see
 * canParentAcceptChild below for the one place that's no longer quite
 * true). Reused by click-insert, drag-insert, Canvas drop-target
 * highlighting, and elementCapabilities.ts so the rule is never
 * duplicated. Still includes "table" (no catalog factory yet) so
 * containment — and, via elementCapabilities, resizing — is already
 * correct the moment a factory for it is added, with no change required
 * here; "form" and the semantic sectioning elements were the same kind of
 * forward declaration until Checkpoints 1.8/1.10 gave them real factories.
 *
 * "li" is deliberately NOT here (Checkpoint 1.6) — early groundwork
 * speculatively included it as a general-purpose container, but List
 * Item's actual design is a text-bearing leaf (see ListItemElement and
 * TEXT_BEARING_TAGS in elementCapabilities.ts), the same shape as
 * Heading/Paragraph/Button/Link. HTML permits richer <li> content
 * (nested lists, mixed inline content), but Layoutry's current tree
 * model has no representation for "leaf with editable text AND child
 * elements" — every existing text-bearing tag is exclusively one or the
 * other. Revisit only if a future checkpoint deliberately builds that
 * richer content model.
 */
const CONTAINER_TAGS: ReadonlySet<string> = new Set([
  "page",
  "body",
  "div",
  "section",
  "form",
  "label",
  "ul",
  "ol",
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

/**
 * The per-parent-tag refinement on top of canContainChildren (Checkpoint
 * 1.6) — the smallest centralized extension that expresses "ul/ol only
 * accept li, and li only means something inside ul/ol." Every other
 * container tag (div, section, page, body, form, header, footer, main,
 * article, aside, nav, table) keeps accepting any insertable child
 * exactly as before this checkpoint — ALLOWED_CHILD_TAGS only needs an
 * entry for a parent tag that's *more* restrictive than "any child",
 * so an absent entry means unrestricted, preserving every existing
 * Container/Section relationship unchanged.
 *
 * This is the ONE place nesting policy is decided. Every insertion, move/
 * reparent, paste, and drag-drop path is required to route through this
 * function (directly, or transitively via insertNode/isValidMoveTarget)
 * rather than re-implementing a per-tag check of its own — see those
 * functions' own doc comments for how each one calls in.
 */
const ALLOWED_CHILD_TAGS: Readonly<Record<string, ReadonlySet<string>>> = {
  ul: new Set(["li"]),
  ol: new Set(["li"]),
};

export function canParentAcceptChild(parentTag: string, childTag: string): boolean {
  if (!canContainChildren(parentTag)) return false;

  const allowedChildren = ALLOWED_CHILD_TAGS[parentTag];
  if (allowedChildren) return allowedChildren.has(childTag);

  // "li" has no meaning outside a list — every container tag other than
  // ul/ol (which are handled by the allowlist above) rejects it, rather
  // than letting it land as a bare child of a Container/Section/etc.
  return childTag !== "li";
}
