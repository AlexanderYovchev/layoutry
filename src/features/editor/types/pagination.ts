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
