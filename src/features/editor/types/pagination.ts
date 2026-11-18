import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Pagination identity (BC-09.2). A Pagination is a nav that carries the
 * `component: "pagination"` marker, set only by the Pagination factory.
 * Nothing is inferred from text or structure: a legacy Pagination (made
 * before format 3) and a Navbar or Breadcrumbs are ordinary navs.
 */
export function isPaginationNode(
  node: Pick<EditorElementNode, "tag" | "component">,
): boolean {
  return node.tag === "nav" && node.component === "pagination";
}

/** The non-page children a Pagination can manage (BC-09.3). */
export type PaginationControlRole =
  "first" | "previous" | "next" | "last" | "ellipsis";
export const PAGINATION_CONTROL_ROLES: readonly PaginationControlRole[] = [
  "first",
  "previous",
  "next",
  "last",
  "ellipsis",
];

/**
 * Each control's role is its assigned component label, stored in the
 * existing `displayName` field (format 3, no schema change): the field is
 * documented as "a component's assigned label", it shows in the Structure
 * panel, and no UI renames a link or paragraph. Only inside a marked
 * Pagination does a label mean a role. Pages carry no label.
 */
export const PAGINATION_ROLE_LABELS: Readonly<
  Record<PaginationControlRole, string>
> = {
  first: "First page",
  previous: "Previous page",
  next: "Next page",
  last: "Last page",
  ellipsis: "Ellipsis",
};

/**
 * The nav's own assigned label. Every Pagination created or managed since
 * BC-09.3 carries it; a BC-09.2 Pagination doesn't, which is what tells
 * the two apart (see getPaginationParts).
 */
export const PAGINATION_NAV_LABEL = "Pagination";

/** The role a direct child of a marked Pagination plays, from its label and tag only. */
function labelledRole(
  child: EditorElementNode,
): PaginationControlRole | undefined {
  const expectedTag = (role: PaginationControlRole) =>
    role === "ellipsis" ? "p" : "a";
  return PAGINATION_CONTROL_ROLES.find(
    (role) =>
      child.displayName === PAGINATION_ROLE_LABELS[role] &&
      child.tag === expectedTag(role),
  );
}

export interface PaginationParts {
  /** The numbered pages: every direct link that isn't a control, in order. */
  pages: EditorElementNode[];
  /** The first child playing each role (a duplicate control is left alone). */
  controls: Partial<Record<PaginationControlRole, EditorElementNode>>;
  /** The id of every direct child playing a role, the first of each included. */
  roleById: ReadonlyMap<string, PaginationControlRole>;
}

/**
 * Splits a marked Pagination's direct children into pages and controls.
 *
 * Fallback for a Pagination inserted by BC-09.2, before controls carried a
 * label: only for a nav without its own "Pagination" label (every newer
 * one has it), with no child role label and at least three links, its
 * first and last links are Previous and Next — exactly that factory's
 * structure. Normalization then writes the labels, so the fallback runs
 * once. Nothing is ever inferred from text or styling.
 */
export function getPaginationParts(
  pagination: EditorElementNode,
): PaginationParts {
  const children = pagination.children ?? [];
  const roleById = new Map<string, PaginationControlRole>();
  const controls: Partial<Record<PaginationControlRole, EditorElementNode>> =
    {};
  for (const child of children) {
    const role = labelledRole(child);
    if (role === undefined) continue;
    roleById.set(child.id, role);
    controls[role] ??= child;
  }
  const links = children.filter((child) => child.tag === "a");
  if (
    pagination.displayName !== PAGINATION_NAV_LABEL &&
    roleById.size === 0 &&
    links.length >= 3
  ) {
    const first = links[0];
    const last = links[links.length - 1];
    roleById.set(first.id, "previous");
    roleById.set(last.id, "next");
    controls.previous = first;
    controls.next = last;
  }
  const pages = links.filter((child) => !roleById.has(child.id));
  return { pages, controls, roleById };
}

/** The role `child` plays in `parent`, or undefined when `parent` isn't a marked Pagination or `child` is a page. */
export function getPaginationRole(
  child: EditorElementNode,
  parent: EditorElementNode | undefined,
): PaginationControlRole | undefined {
  if (!parent || !isPaginationNode(parent)) return undefined;
  return getPaginationParts(parent).roleById.get(child.id);
}

/** Whether `child` is the current page of the marked Pagination `parent`. */
export function isPaginationCurrentPage(
  child: EditorElementNode,
  parent: EditorElementNode | undefined,
): boolean {
  return (
    parent !== undefined &&
    isPaginationNode(parent) &&
    child.tag === "a" &&
    child.ariaCurrent === "page" &&
    getPaginationRole(child, parent) === undefined
  );
}

/**
 * The Pagination's direct links marked as the current page. A well-formed
 * Pagination has exactly one; the editor never creates a second (see
 * withoutCopiedCurrentState).
 */
export function getCurrentPageLinks(
  pagination: EditorElementNode,
): EditorElementNode[] {
  return (pagination.children ?? []).filter(
    (child) => child.tag === "a" && child.ariaCurrent === "page",
  );
}

/**
 * A pasted or duplicated node is never "the current one": `aria-current`
 * marks a single item of a set, so the copy's root loses it. Descendants
 * keep theirs: duplicating a whole Pagination keeps its own current page.
 */
export function withoutCopiedCurrentState(
  node: EditorElementNode,
): EditorElementNode {
  if (node.ariaCurrent === undefined) return node;
  const copy = { ...node };
  delete copy.ariaCurrent;
  return copy;
}
