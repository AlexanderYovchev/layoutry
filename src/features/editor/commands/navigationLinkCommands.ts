import { createNavbarLinkNode } from "@/features/editor/factories/navigationCompositions";
import { generateNodeId } from "@/features/editor/utils/generateNodeId";
import { DEFAULT_LINK_HREF } from "@/features/editor/types/link";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Navigation links management (BC-06.2): Add / Remove / Move for the links
 * directly inside a `nav`.
 *
 * Which containers qualify: every `nav` element. A Navbar has no marker
 * once inserted (Checkpoint 1.15.6.3 deliberately added no navbar flag or
 * type), so the rule is purely structural. The "navigation links" of a nav
 * are its DIRECT `<a>` children, in document order. Anything else directly
 * inside the nav (a CTA Button, Breadcrumbs' "/" separators, Pagination's
 * Previous/Next Buttons, a nested Container) is not a navigation link: it
 * is never counted, listed, moved or removed by these commands, and it
 * keeps its exact position among the nav's children.
 *
 * These are structure edits on ordinary document nodes, like the List
 * Items count, so every command returns the SAME root for a no-op (the
 * store then pushes no history entry).
 */

/** The most links "Add link" will create in one nav. Existing navs with more are kept as they are; only adding is refused. */
export const MAX_NAVIGATION_LINKS = 12;

/** From this many links on, the Inspector suggests turning on Wrap. Purely informational. */
export const NAVIGATION_LINK_WRAP_HINT_THRESHOLD = 6;

/** Text of a link created by "Add link". */
export const NEW_NAVIGATION_LINK_TEXT = "New link";

export type NavigationLinkMoveDirection = "up" | "down";

/** Whether `node` gets navigation-link management (see this file's top comment). */
export function isNavigationLinkContainer(node: EditorElementNode): boolean {
  return node.tag === "nav";
}

/** The nav's direct `<a>` children, in document order. Empty for any other node. */
export function getNavigationLinks(node: EditorElementNode): EditorElementNode[] {
  if (!isNavigationLinkContainer(node)) return [];
  return (node.children ?? []).filter((child) => child.tag === "a");
}

/** Whether "Add link" is allowed for this nav right now. */
export function canAddNavigationLink(node: EditorElementNode): boolean {
  return isNavigationLinkContainer(node) && getNavigationLinks(node).length < MAX_NAVIGATION_LINKS;
}

/**
 * The style fields a new link copies from the template link: its look
 * (typography, spacing, background, border, radius, shadow, filters,
 * transition, transform, display, class) and its sizing rules. Never
 * copied: the id, text, href, htmlId, interactions and initial Preview
 * visibility (identity and behaviour), displayName and title (per-link
 * content), and where that one link was placed or resized (dimensions,
 * freeLayout, aspectRatioLocked, CSS position offsets). Copying a placement
 * would stack the new link exactly on top of the old one. Grid spans are
 * copied, but an explicit grid cell is not (see below).
 */
const COPIED_STYLE_FIELDS = [
  "spacing",
  "flexChild",
  "gridChild",
  "typography",
  "background",
  "border",
  "borderRadius",
  "shape",
  "boxShadow",
  "filters",
  "display",
  "aspectRatio",
  "sizeConstraints",
  "transition",
  "transform",
  "className",
] as const satisfies readonly (keyof EditorElementNode)[];

/**
 * A new "New link" (href "#", fresh id) styled like `template`, or like the
 * starter Navbar links when the nav has no link to copy from.
 */
export function createNavigationLink(template: EditorElementNode | undefined): EditorElementNode {
  if (!template) return createNavbarLinkNode(NEW_NAVIGATION_LINK_TEXT);
  const link: EditorElementNode = { id: generateNodeId("a"), tag: "a", text: NEW_NAVIGATION_LINK_TEXT, href: DEFAULT_LINK_HREF };
  for (const field of COPIED_STYLE_FIELDS) {
    const value = template[field];
    // A copy, so the two links never share a nested style object.
    if (value !== undefined) Object.assign(link, { [field]: structuredClone(value) });
  }
  // Same spans, but auto-placed: a fixed start would put both links in one cell.
  if (link.gridChild) link.gridChild = { ...link.gridChild, columnStart: "auto", rowStart: "auto" };
  return link;
}

function updateNav(
  root: EditorElementNode,
  navId: string,
  updater: (nav: EditorElementNode) => EditorElementNode,
): EditorElementNode {
  if (root.id === navId) return isNavigationLinkContainer(root) ? updater(root) : root;
  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = updateNav(child, navId, updater);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });
  return changed ? { ...root, children } : root;
}

/**
 * Inserts `link` into the nav right after its last direct link (so a
 * trailing CTA stays last), or first when the nav has no links. Refused (same
 * root) at MAX_NAVIGATION_LINKS links, for a non-nav id, or a non-link node.
 */
export function insertNavigationLink(root: EditorElementNode, navId: string, link: EditorElementNode): EditorElementNode {
  if (link.tag !== "a") return root;
  return updateNav(root, navId, (nav) => {
    if (!canAddNavigationLink(nav)) return nav;
    const children = nav.children ?? [];
    let lastLinkIndex = -1;
    children.forEach((child, index) => {
      if (child.tag === "a") lastLinkIndex = index;
    });
    const insertAt = lastLinkIndex + 1;
    return { ...nav, children: [...children.slice(0, insertAt), link, ...children.slice(insertAt)] };
  });
}

/**
 * Removes exactly `linkId`, which must be a direct link of the nav (same
 * root otherwise). Interaction cleanup is the store's job, in the same
 * write (see removeInteractionsForRemovedNodes).
 */
export function removeNavigationLink(root: EditorElementNode, navId: string, linkId: string): EditorElementNode {
  return updateNav(root, navId, (nav) => {
    const children = nav.children ?? [];
    const next = children.filter((child) => !(child.id === linkId && child.tag === "a"));
    return next.length === children.length ? nav : { ...nav, children: next };
  });
}

/**
 * Moves a link one place among the nav's LINKS by swapping it with the
 * neighbouring link. Each of the two nodes takes the other's slot, so every
 * non-link child keeps its exact index: the CTA stays last, and Breadcrumbs'
 * separators stay between entries. For adjacent links (every Navbar preset)
 * this is the same as moving one position. The node objects are reused, not
 * recreated, so ids, styles and interactions are untouched. Same root at
 * either end of the list or for an unknown id.
 */
export function moveNavigationLink(
  root: EditorElementNode,
  navId: string,
  linkId: string,
  direction: NavigationLinkMoveDirection,
): EditorElementNode {
  return updateNav(root, navId, (nav) => {
    const children = nav.children ?? [];
    const linkIndexes = children.flatMap((child, index) => (child.tag === "a" ? [index] : []));
    const position = linkIndexes.findIndex((index) => children[index].id === linkId);
    if (position === -1) return nav;
    const neighbour = direction === "up" ? position - 1 : position + 1;
    if (neighbour < 0 || neighbour >= linkIndexes.length) return nav;

    const from = linkIndexes[position];
    const to = linkIndexes[neighbour];
    const next = [...children];
    next[from] = children[to];
    next[to] = children[from];
    return { ...nav, children: next };
  });
}
