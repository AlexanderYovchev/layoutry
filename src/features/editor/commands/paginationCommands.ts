import { createNavigationLink } from "@/features/editor/commands/navigationLinkCommands";
import {
  createPaginationEllipsis,
  createPaginationPageLink,
  createPaginationStepLink,
  PAGINATION_COLORS,
} from "@/features/editor/factories/navigationCompositions";
import type { BackgroundSettings } from "@/features/editor/types/background";
import type { BorderSettings } from "@/features/editor/types/border";
import type { BoxShadowSettings } from "@/features/editor/types/boxShadow";
import type { CursorValue } from "@/features/editor/types/display";
import type { EditorElementNode } from "@/features/editor/types/document";
import { DEFAULT_LINK_HREF, isValidLinkHref } from "@/features/editor/types/link";
import {
  getPaginationParts,
  isPaginationNode,
  PAGINATION_NAV_LABEL,
  PAGINATION_ROLE_LABELS,
  type PaginationControlRole,
  type PaginationParts,
} from "@/features/editor/types/pagination";

/**
 * Pagination management (BC-09.3): pure commands on the document root for
 * the Inspector's Pagination section, plus normalizePagination, the one
 * place that keeps a marked Pagination consistent:
 * - exactly one current page (when it has pages);
 * - Previous / Next link to the neighbouring pages' destinations, First /
 *   Last to the first / last page's, and each is disabled at its boundary
 *   (or when that destination is missing or invalid);
 * - the ellipsis needs at least two pages.
 * Every command returns the SAME root for a no-op, so the store pushes no
 * history entry. Removing nodes leaves interaction cleanup to the store
 * (commitStructuralEdit), in the same write, exactly like BC-06.
 *
 * Only marked Paginations (types/pagination.ts) are touched: legacy and
 * other navs are never changed. No runtime state: everything here is an
 * authored, static edit.
 */

export const MIN_PAGINATION_PAGES = 1;
export const MAX_PAGINATION_PAGES = 12;

type StepRole = Exclude<PaginationControlRole, "ellipsis">;
const STEP_ROLES: readonly StepRole[] = ["first", "previous", "next", "last"];

// --- State looks ----------------------------------------------------------

/**
 * The style fields that show a page's state (current vs ordinary). When
 * the current page moves, these move with it: the old current page takes
 * the new one's previous look and the new one takes the current look, so
 * an author's own current-page or page styling is kept, not reset. Every
 * other field (size, spacing, font...) stays on its own page.
 */
interface StateLook {
  background?: BackgroundSettings;
  border?: BorderSettings;
  boxShadow?: BoxShadowSettings;
  color?: string;
  cursor?: CursorValue;
}

function getStateLook(node: EditorElementNode): StateLook {
  return {
    background: node.background,
    border: node.border,
    boxShadow: node.boxShadow,
    color: node.typography?.color,
    cursor: node.display?.cursor,
  };
}

function withOptional<T extends object, K extends keyof T>(object: T, key: K, value: T[K] | undefined): T {
  const next = { ...object };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next;
}

function applyStateLook(node: EditorElementNode, look: StateLook): EditorElementNode {
  let next: EditorElementNode = { ...node };
  next = withOptional(next, "background", look.background && structuredClone(look.background));
  next = withOptional(next, "border", look.border && structuredClone(look.border));
  next = withOptional(next, "boxShadow", look.boxShadow && structuredClone(look.boxShadow));
  const typography = withOptional({ ...(node.typography ?? {}) }, "color", look.color);
  next = withOptional(next, "typography", Object.keys(typography).length > 0 ? typography : undefined);
  const display = withOptional({ ...(node.display ?? {}) }, "cursor", look.cursor);
  next = withOptional(next, "display", Object.keys(display).length > 0 ? display : undefined);
  return next;
}

const STARTER_CURRENT_LOOK = getStateLook(createPaginationPageLink("1", true));
const STARTER_PAGE_LOOK = getStateLook(createPaginationPageLink("2"));

// --- Boundary controls ----------------------------------------------------

function swapColor(value: string | undefined, from: string, to: string): string | undefined {
  return value === from ? to : value;
}

function swapBorderColor(border: BorderSettings | undefined, from: string, to: string): BorderSettings | undefined {
  if (!border) return border;
  let changed = false;
  const next: BorderSettings = {};
  for (const side of ["top", "right", "bottom", "left"] as const) {
    const edge = border[side];
    if (edge && edge.color === from) {
      next[side] = { ...edge, color: to };
      changed = true;
    } else if (edge) next[side] = edge;
  }
  return changed ? next : border;
}

/**
 * Sets a step control's state. Its look follows only where it still shows
 * the starter design's exact enabled/disabled colours and cursor; anything
 * the author customised is left alone. `href` is applied when enabled; a
 * disabled control keeps its stored href (it renders none).
 */
function applyBoundary(control: EditorElementNode, disabled: boolean, href: string | undefined): EditorElementNode {
  const isDisabled = control.disabled === true;
  const hrefChanged = !disabled && href !== undefined && control.href !== href;
  if (isDisabled === disabled && !hrefChanged) return control;
  let next: EditorElementNode = { ...control };
  if (hrefChanged) next.href = href;
  if (isDisabled !== disabled) {
    const [fromText, toText] = disabled ? [PAGINATION_COLORS.stepText, PAGINATION_COLORS.disabledText] : [PAGINATION_COLORS.disabledText, PAGINATION_COLORS.stepText];
    const [fromBorder, toBorder] = disabled ? [PAGINATION_COLORS.stepBorder, PAGINATION_COLORS.disabledBorder] : [PAGINATION_COLORS.disabledBorder, PAGINATION_COLORS.stepBorder];
    if (disabled) next.disabled = true;
    else delete next.disabled;
    if (next.typography?.color !== undefined) next.typography = { ...next.typography, color: swapColor(next.typography.color, fromText, toText) };
    next = withOptional(next, "border", swapBorderColor(next.border, fromBorder, toBorder));
    const cursor = disabled ? (next.display?.cursor ?? "not-allowed") : next.display?.cursor === "not-allowed" ? undefined : next.display?.cursor;
    const display = withOptional({ ...(next.display ?? {}) }, "cursor", cursor);
    next = withOptional(next, "display", Object.keys(display).length > 0 ? display : undefined);
  }
  return next;
}

/** A destination a boundary control may link to: present and valid. Otherwise the control is disabled rather than given an invented URL. */
function usableHref(page: EditorElementNode | undefined): string | undefined {
  const href = page?.href;
  return href !== undefined && isValidLinkHref(href) ? href : undefined;
}

// --- Normalization ----------------------------------------------------------

export interface NormalizePaginationOptions {
  /** The same Pagination before the edit, to place a lost current page and keep its look. */
  before?: EditorElementNode;
  /** When two pages are current, this one stays current (a cut page pasted back, BC-09.3). */
  preferredCurrentId?: string;
  /** Pages that were copied from a current page and lost that state: they take an ordinary page's look. */
  ordinaryLookIds?: ReadonlySet<string>;
}

/**
 * Brings a marked Pagination back to its invariants (see the file comment).
 * Same object when it already holds them.
 */
export function normalizePagination(nav: EditorElementNode, options: NormalizePaginationOptions = {}): EditorElementNode {
  if (!isPaginationNode(nav)) return nav;
  let children = [...(nav.children ?? [])];
  let changed = false;
  const parts = (): PaginationParts => getPaginationParts({ ...nav, children });
  const update = (id: string, change: (child: EditorElementNode) => EditorElementNode) => {
    const index = children.findIndex((child) => child.id === id);
    if (index === -1) return;
    const next = change(children[index]);
    if (next !== children[index]) {
      children[index] = next;
      changed = true;
    }
  };
  const isCurrent = (page: EditorElementNode) => page.ariaCurrent === "page";

  // 1. Give fallback-recognised controls (BC-09.2 Paginations) their role
  // label, and the nav its own label, so the fallback never runs again.
  const navLabelMissing = nav.displayName !== PAGINATION_NAV_LABEL;
  for (const [id, role] of parts().roleById) {
    update(id, (child) => (child.displayName === PAGINATION_ROLE_LABELS[role] ? child : { ...child, displayName: PAGINATION_ROLE_LABELS[role] }));
  }

  const ordinaryLook = () => {
    const page = parts().pages.find((candidate) => !isCurrent(candidate) && !options.ordinaryLookIds?.has(candidate.id));
    return page ? getStateLook(page) : STARTER_PAGE_LOOK;
  };

  // 2. A copy of the current page looks like an ordinary page.
  for (const page of parts().pages) {
    if (options.ordinaryLookIds?.has(page.id) && !isCurrent(page)) {
      const look = ordinaryLook();
      update(page.id, (child) => applyStateLook(child, look));
    }
  }

  // 3. Exactly one current page.
  const currents = parts().pages.filter(isCurrent);
  if (currents.length > 1) {
    const winner = currents.find((page) => page.id === options.preferredCurrentId) ?? currents[0];
    const losers = currents.filter((page) => page !== winner);
    const look = (() => {
      const page = parts().pages.find((candidate) => !isCurrent(candidate));
      return page ? getStateLook(page) : STARTER_PAGE_LOOK;
    })();
    for (const loser of losers) {
      update(loser.id, (child) => {
        const next = applyStateLook(child, look);
        delete next.ariaCurrent;
        return next;
      });
    }
  } else if (currents.length === 0 && parts().pages.length > 0) {
    const pages = parts().pages;
    const beforePages = options.before && isPaginationNode(options.before) ? getPaginationParts(options.before).pages : [];
    const beforeCurrent = beforePages.find(isCurrent);
    const look = beforeCurrent ? getStateLook(beforeCurrent) : STARTER_CURRENT_LOOK;
    // The current page went away: the page before it becomes current (or the new first page).
    const position = beforeCurrent ? beforePages.indexOf(beforeCurrent) : 0;
    const target = pages[Math.min(Math.max(position - 1, 0), pages.length - 1)];
    update(target.id, (child) => ({ ...applyStateLook(child, look), ariaCurrent: "page" }));
  }

  // 4. The ellipsis needs at least two pages to sit between.
  const ellipsis = parts().controls.ellipsis;
  if (ellipsis && parts().pages.length < 2) {
    children = children.filter((child) => child.id !== ellipsis.id);
    changed = true;
  }

  // 5. Boundary controls follow the current page.
  const { pages, controls } = parts();
  const currentIndex = pages.findIndex(isCurrent);
  const last = pages.length - 1;
  const boundaries: Record<StepRole, { disabled: boolean; target: EditorElementNode | undefined }> = {
    previous: { disabled: currentIndex <= 0, target: pages[currentIndex - 1] },
    next: { disabled: currentIndex === -1 || currentIndex >= last, target: pages[currentIndex + 1] },
    first: { disabled: currentIndex <= 0, target: pages[0] },
    last: { disabled: currentIndex === -1 || currentIndex >= last, target: pages[last] },
  };
  for (const role of STEP_ROLES) {
    const control = controls[role];
    if (!control) continue;
    const href = usableHref(boundaries[role].target);
    const disabled = boundaries[role].disabled || href === undefined;
    update(control.id, (child) => applyBoundary(child, disabled, href));
  }

  if (!changed && !navLabelMissing) return nav;
  return { ...nav, displayName: PAGINATION_NAV_LABEL, children };
}

/**
 * `target` with the role labels `source` implies (getPaginationParts,
 * including the BC-09.2 positional fallback) written onto the children
 * with the same ids, and the nav's own "Pagination" label. Same object
 * when nothing was missing. BC-09.5 fix: without this, a BC-09.2
 * Pagination whose Previous was removed would have its first page
 * misread as Previous.
 */
export function labelPaginationRoles(source: EditorElementNode, target: EditorElementNode): EditorElementNode {
  const { roleById } = getPaginationParts(source);
  let changed = target.displayName !== PAGINATION_NAV_LABEL;
  const children = (target.children ?? []).map((child) => {
    const role = roleById.get(child.id);
    if (role === undefined || child.displayName === PAGINATION_ROLE_LABELS[role]) return child;
    changed = true;
    return { ...child, displayName: PAGINATION_ROLE_LABELS[role] };
  });
  return changed ? { ...target, displayName: PAGINATION_NAV_LABEL, children } : target;
}

function findById(root: EditorElementNode, id: string): EditorElementNode | undefined {
  if (root.id === id) return root;
  for (const child of root.children ?? []) {
    const found = findById(child, id);
    if (found) return found;
  }
  return undefined;
}

/**
 * normalizePagination for every marked Pagination that this edit changed
 * (its object differs from `before`'s). Untouched Paginations are never
 * rewritten. Same root when nothing needed fixing.
 */
export function normalizePaginationsAfterEdit(
  before: EditorElementNode,
  after: EditorElementNode,
  options: Omit<NormalizePaginationOptions, "before"> = {},
): EditorElementNode {
  if (before === after) return after;
  function visit(node: EditorElementNode): EditorElementNode {
    const children = node.children;
    let nextChildren = children;
    if (children) {
      const mapped = children.map(visit);
      if (mapped.some((child, index) => child !== children[index])) nextChildren = mapped;
    }
    const withChildren = nextChildren === children ? node : { ...node, children: nextChildren };
    if (!isPaginationNode(withChildren)) return withChildren;
    const previous = findById(before, node.id);
    if (previous === node) return withChildren;
    // BC-09.5: roles come from the Pagination BEFORE the edit, so a BC-09.2
    // Pagination (no labels yet) is never re-read positionally after its
    // structure changed (e.g. its Previous was deleted).
    const labelled = previous && isPaginationNode(previous) ? labelPaginationRoles(previous, withChildren) : withChildren;
    return normalizePagination(labelled, { ...options, before: previous });
  }
  return visit(after);
}

// --- Commands -------------------------------------------------------------

/** Applies `edit` to the marked Pagination `navId` and normalizes it. Same root when nothing changed. */
function updatePagination(
  root: EditorElementNode,
  navId: string,
  edit: (nav: EditorElementNode, parts: PaginationParts) => EditorElementNode,
  options: Omit<NormalizePaginationOptions, "before"> = {},
): EditorElementNode {
  if (root.id === navId) {
    if (!isPaginationNode(root)) return root;
    // BC-09.5: label the roles first (a no-op for a labelled Pagination), so
    // the edit and the normalization after it never use the positional
    // fallback on a changed structure.
    const labelled = labelPaginationRoles(root, root);
    const edited = edit(labelled, getPaginationParts(labelled));
    if (edited === labelled) return root;
    return normalizePagination(edited, { ...options, before: labelled });
  }
  if (!root.children) return root;
  let changed = false;
  const children = root.children.map((child) => {
    const next = updatePagination(child, navId, edit, options);
    if (next !== child) changed = true;
    return next;
  });
  return changed ? { ...root, children } : root;
}

function withChildren(nav: EditorElementNode, children: EditorElementNode[]): EditorElementNode {
  return { ...nav, children };
}

/** Whether "Add page" is allowed for this node right now. */
export function canAddPaginationPage(nav: EditorElementNode): boolean {
  return isPaginationNode(nav) && getPaginationParts(nav).pages.length < MAX_PAGINATION_PAGES;
}

/** Whether a page can be removed (at least one must stay). */
export function canRemovePaginationPage(nav: EditorElementNode): boolean {
  return isPaginationNode(nav) && getPaginationParts(nav).pages.length > MIN_PAGINATION_PAGES;
}

/** The label a new page gets: the page before it plus one when that is a number, else the new page count. */
function nextPageLabel(previous: EditorElementNode | undefined, pageCount: number): string {
  const text = previous?.text?.trim() ?? "";
  return /^\d+$/.test(text) ? String(Number(text) + 1) : String(pageCount + 1);
}

/**
 * Adds a page after the last page, or before the ellipsis when there is
 * one (so "1 2 3 … 10" grows into "1 2 3 4 … 10"). It is styled like an
 * ordinary page (the nearest non-current page, else the starter page),
 * never like the current page or a disabled control, and copies no
 * interaction, accessibility state, label or destination ("#").
 * `place` lets the store position it in a Free-layout nav.
 */
export function addPaginationPage(
  root: EditorElementNode,
  navId: string,
  place: (page: EditorElementNode) => EditorElementNode = (page) => page,
): EditorElementNode {
  return updatePagination(root, navId, (nav, { pages, controls }) => {
    if (pages.length >= MAX_PAGINATION_PAGES) return nav;
    const children = nav.children ?? [];
    const ellipsisIndex = controls.ellipsis ? children.indexOf(controls.ellipsis) : -1;
    const lastPageIndex = children.indexOf(pages[pages.length - 1]);
    const insertAt = ellipsisIndex !== -1 ? ellipsisIndex : lastPageIndex + 1;
    const before = children.slice(0, insertAt).filter((child) => pages.includes(child));
    const label = nextPageLabel(before[before.length - 1], pages.length);
    const template = [...before].reverse().find((page) => page.ariaCurrent !== "page") ?? pages.find((page) => page.ariaCurrent !== "page");
    const base = template ? createNavigationLink(template) : createPaginationPageLink(label);
    const page = place({ ...base, text: label, href: DEFAULT_LINK_HREF });
    return withChildren(nav, [...children.slice(0, insertAt), page, ...children.slice(insertAt)]);
  });
}

/**
 * Removes exactly `pageId` (refused at one page). Pages after it whose
 * label is still their default number are renumbered (before the ellipsis
 * only: the page after it is the author's "last page" number); custom
 * labels and every destination stay. If it was the current page, the page
 * before it becomes current. Interaction cleanup: the store.
 */
export function removePaginationPage(root: EditorElementNode, navId: string, pageId: string): EditorElementNode {
  return updatePagination(root, navId, (nav, { pages, controls }) => {
    const removedIndex = pages.findIndex((page) => page.id === pageId);
    if (removedIndex === -1 || pages.length <= MIN_PAGINATION_PAGES) return nav;
    const children = nav.children ?? [];
    const ellipsisIndex = controls.ellipsis ? children.indexOf(controls.ellipsis) : children.length;
    const next = children
      .filter((child) => child.id !== pageId)
      .map((child) => {
        const index = pages.indexOf(child);
        if (index <= removedIndex || children.indexOf(child) > ellipsisIndex) return child;
        return child.text?.trim() === String(index + 1) ? { ...child, text: String(index) } : child;
      });
    return withChildren(nav, next);
  });
}

/**
 * Makes `pageId` the current page in one edit: aria-current moves, and the
 * state look (background, border, shadow, text colour, cursor) swaps
 * between the two pages, so both keep the author's styling. The old
 * current page becomes a working link again (its stored href renders);
 * the new one stops rendering its href, which stays stored.
 */
export function setPaginationCurrentPage(root: EditorElementNode, navId: string, pageId: string): EditorElementNode {
  return updatePagination(root, navId, (nav, { pages }) => {
    const target = pages.find((page) => page.id === pageId);
    if (!target || target.ariaCurrent === "page") return nav;
    const old = pages.find((page) => page.ariaCurrent === "page");
    const currentLook = old ? getStateLook(old) : STARTER_CURRENT_LOOK;
    const targetLook = getStateLook(target);
    const children = (nav.children ?? []).map((child) => {
      if (child.id === target.id) return { ...applyStateLook(child, currentLook), ariaCurrent: "page" as const };
      if (old && child.id === old.id) {
        const next = applyStateLook(child, targetLook);
        delete next.ariaCurrent;
        return next;
      }
      return child;
    });
    return withChildren(nav, children);
  });
}

/** Sets a page's visible label. A blank label is refused (same root): every page must have a name. */
export function setPaginationPageLabel(root: EditorElementNode, navId: string, pageId: string, label: string): EditorElementNode {
  const trimmed = label.trim();
  if (trimmed === "") return root;
  return updatePagination(root, navId, (nav, { pages }) => {
    const page = pages.find((candidate) => candidate.id === pageId);
    if (!page || page.text === trimmed) return nav;
    return withChildren(nav, (nav.children ?? []).map((child) => (child.id === pageId ? { ...child, text: trimmed } : child)));
  });
}

/**
 * Sets a page's destination. Refused (same root) when isValidLinkHref
 * refuses it; the Inspector additionally applies the export URL policy.
 * Boundary controls pointing at this page follow (normalization).
 */
export function setPaginationPageHref(root: EditorElementNode, navId: string, pageId: string, href: string): EditorElementNode {
  const trimmed = href.trim();
  if (!isValidLinkHref(trimmed)) return root;
  return updatePagination(root, navId, (nav, { pages }) => {
    const page = pages.find((candidate) => candidate.id === pageId);
    if (!page || page.href === trimmed) return nav;
    return withChildren(nav, (nav.children ?? []).map((child) => (child.id === pageId ? { ...child, href: trimmed } : child)));
  });
}

/** Whether the ellipsis can be shown: it needs two pages to sit between. */
export function canShowPaginationEllipsis(nav: EditorElementNode): boolean {
  return isPaginationNode(nav) && getPaginationParts(nav).pages.length >= 2;
}

const OPPOSITE: Readonly<Record<StepRole, StepRole>> = { first: "last", last: "first", previous: "next", next: "previous" };

/**
 * Shows or hides one control. Showing inserts a fresh node at its fixed
 * place (First first, Previous after First, Next after the last page,
 * Last last; the ellipsis just before the last page), styled like the
 * opposite control when there is one, so an author's step styling carries
 * over. Hiding removes the node (no dead, hidden markup or misleading
 * link is left); the store cleans interactions that targeted it. A role
 * that is already in the requested state is a no-op.
 */
export function setPaginationControlVisible(
  root: EditorElementNode,
  navId: string,
  role: PaginationControlRole,
  visible: boolean,
): EditorElementNode {
  return updatePagination(root, navId, (nav, { pages, controls }) => {
    const present = controls[role];
    const children = nav.children ?? [];
    if (!visible) return present ? withChildren(nav, children.filter((child) => child.id !== present.id)) : nav;
    if (present) return nav;

    if (role === "ellipsis") {
      if (pages.length < 2) return nav;
      const insertAt = children.indexOf(pages[pages.length - 1]);
      return withChildren(nav, [...children.slice(0, insertAt), createPaginationEllipsis(), ...children.slice(insertAt)]);
    }

    const template = controls[OPPOSITE[role]] ?? STEP_ROLES.map((other) => controls[other]).find((control) => control !== undefined);
    let control = createPaginationStepLink(role, false);
    if (template) {
      const styled = createNavigationLink(template);
      control = { ...styled, id: control.id, displayName: control.displayName, text: control.text, href: control.href };
      // A disabled template's muted look comes with its state, so the
      // boundary sync below can swap it back when this control is enabled.
      if (template.disabled === true) control.disabled = true;
    }
    let insertAt: number;
    if (role === "first") insertAt = 0;
    else if (role === "previous") insertAt = controls.first ? children.indexOf(controls.first) + 1 : 0;
    else if (role === "next") insertAt = controls.last ? children.indexOf(controls.last) : children.length;
    else insertAt = children.length;
    return withChildren(nav, [...children.slice(0, insertAt), control, ...children.slice(insertAt)]);
  });
}
