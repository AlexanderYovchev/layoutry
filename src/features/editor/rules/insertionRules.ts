/**
 * The single source of truth for "can this node type accept children at
 * all" — the binary half of containment. Most insertable types (heading,
 * paragraph, button, image, link, list item) uniformly reject all
 * children; most container tags uniformly accept anything (see
 * canParentAcceptChild below for the one place that's no longer quite
 * true). Reused by click-insert, drag-insert, Canvas drop-target
 * highlighting, and elementCapabilities.ts so the rule is never
 * duplicated. "form" and the semantic sectioning elements were once a
 * forward declaration here (no factory yet) until Checkpoints 1.8/1.10
 * gave them real factories; "table" was the same kind of forward
 * declaration until Checkpoint 1.14 gave it one too.
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
 *
 * "option" (Checkpoint 1.13) is the same shape as "li" for the same
 * reason — a genuine leaf (see OptionElement), never itself a container,
 * only ever meaningful as a direct child of "select" (see
 * ALLOWED_CHILD_TAGS below).
 *
 * "thead"/"tbody"/"tfoot"/"tr" (Checkpoint 1.14) ARE containers — each
 * holds further structural children (a section holds rows, a row holds
 * cells) — but every one of them is constrained to exactly one child tag
 * via ALLOWED_CHILD_TAGS below, the same shape "table" itself uses.
 * "th"/"td" are NOT here — like li/option, they're text-bearing leaves
 * (see TableCellElement and TEXT_BEARING_TAGS), never containers.
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
  "thead",
  "tbody",
  "tfoot",
  "tr",
  // "select" (Checkpoint 1.13) is a container for exactly the same
  // constrained-nesting reason ul/ol are — see ALLOWED_CHILD_TAGS below.
  "select",
  // "dialog" (Checkpoint 1.15.6.9) — a genuine native `<dialog>`, ordinary
  // and UNCONSTRAINED like div/section: it accepts any insertable child
  // (see DialogElement's own doc comment for why its own children still
  // use ordinary Flow/Flex/Grid via an inner content Container, never the
  // dialog box itself). No ALLOWED_CHILD_TAGS/CONSTRAINED_CHILD_TAGS entry
  // is needed below, the same "absent entry means unrestricted" default
  // every other unconstrained container tag already relies on.
  "dialog",
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
  // Select -> Option only (Checkpoint 1.13) — the exact same shape as
  // ul/ol -> li above: a native <select> only ever meaningfully contains
  // <option> children.
  select: new Set(["option"]),
  // Table's own structural nesting (Checkpoint 1.14). Direct table -> tr
  // was deliberately NOT enabled here even though real HTML/React permit
  // it (verified live — see this checkpoint's report, section E, for why
  // it renders fine but was still left out): every row lives inside an
  // explicit thead/tbody/tfoot, the "preferred semantic authoring model"
  // this checkpoint's brief itself calls out, and the one shape
  // getTableHead/getTableBody/getTableFoot (types/table.ts) and every
  // Table Inspector command are actually built around.
  table: new Set(["thead", "tbody", "tfoot"]),
  thead: new Set(["tr"]),
  tbody: new Set(["tr"]),
  tfoot: new Set(["tr"]),
  tr: new Set(["th", "td"]),
};

/**
 * Tags with no meaning outside their one constrained parent (Checkpoint
 * 1.14 generalized this from a two-entry inline check into a named set as
 * more constrained tags joined li/option) — rejected as a child of every
 * container NOT listed above in ALLOWED_CHILD_TAGS, rather than letting
 * any of them land as a bare child of a Container/Section/Form/etc.
 */
const CONSTRAINED_CHILD_TAGS: ReadonlySet<string> = new Set([
  "li",
  "option",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
]);

export function canParentAcceptChild(parentTag: string, childTag: string): boolean {
  if (!canContainChildren(parentTag)) return false;

  const allowedChildren = ALLOWED_CHILD_TAGS[parentTag];
  if (allowedChildren) return allowedChildren.has(childTag);

  return !CONSTRAINED_CHILD_TAGS.has(childTag);
}
