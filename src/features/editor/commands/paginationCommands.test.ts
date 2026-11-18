import { describe, expect, it } from "vitest";
import {
  addPaginationPage,
  MAX_PAGINATION_PAGES,
  normalizePagination,
  normalizePaginationsAfterEdit,
  removePaginationPage,
  setPaginationControlVisible,
  setPaginationCurrentPage,
  setPaginationPageHref,
  setPaginationPageLabel,
} from "./paginationCommands";
import { createPaginationNode, PAGINATION_COLORS } from "@/features/editor/factories/navigationCompositions";
import type { EditorElementNode } from "@/features/editor/types/document";
import { getPaginationParts } from "@/features/editor/types/pagination";
import { legacyPaginationNode } from "../../../../test/fixtures/legacyPagination";

/** BC-09.3 — the pure Pagination management commands and their invariants. */

function setup() {
  const nav = createPaginationNode();
  const root: EditorElementNode = { id: "page-root", tag: "page", children: [nav] };
  return { root, navId: nav.id };
}

const navOf = (root: EditorElementNode) => root.children![0];
const parts = (root: EditorElementNode) => getPaginationParts(navOf(root));
const pageTexts = (root: EditorElementNode) => parts(root).pages.map((page) => page.text);
const currentTexts = (root: EditorElementNode) => parts(root).pages.filter((page) => page.ariaCurrent === "page").map((page) => page.text);
const layout = (root: EditorElementNode) =>
  (navOf(root).children ?? []).map((child) => {
    const role = parts(root).roleById.get(child.id);
    return role ? `${role}${child.disabled ? "(off)" : ""}` : `${child.text}${child.ariaCurrent === "page" ? "*" : ""}`;
  });

describe("Pagination roles (BC-09.3)", () => {
  it("the new factory labels Previous and Next; pages carry no label", () => {
    const { root } = setup();
    expect(layout(root)).toEqual(["previous(off)", "1*", "2", "3", "next"]);
    expect(parts(root).pages.every((page) => page.displayName === undefined)).toBe(true);
  });

  it("a BC-09.2 Pagination without labels is read positionally and gets its labels on the first normalization", () => {
    const nav = createPaginationNode();
    delete nav.displayName;
    for (const child of nav.children!) delete child.displayName;
    expect(getPaginationParts(nav).pages.map((page) => page.text)).toEqual(["1", "2", "3"]);
    const normalized = normalizePagination(nav);
    expect(normalized.displayName).toBe("Pagination");
    expect(normalized.children!.map((child) => child.displayName)).toEqual(["Previous page", undefined, undefined, undefined, "Next page"]);
  });

  it("a current Pagination with every control hidden is never read positionally", () => {
    const nav = createPaginationNode();
    const bare = { ...nav, children: nav.children!.slice(1, 4) };
    expect(getPaginationParts(bare).pages.map((page) => page.text)).toEqual(["1", "2", "3"]);
    expect(normalizePagination(bare)).toBe(bare);
  });

  it("normalization of a consistent Pagination returns the same object", () => {
    const nav = createPaginationNode();
    expect(normalizePagination(nav)).toBe(nav);
  });

  it("never touches a legacy (unmarked) Pagination", () => {
    const legacy = legacyPaginationNode();
    const root: EditorElementNode = { id: "page-root", tag: "page", children: [legacy] };
    expect(addPaginationPage(root, legacy.id)).toBe(root);
    expect(setPaginationControlVisible(root, legacy.id, "first", true)).toBe(root);
    expect(normalizePagination(legacy)).toBe(legacy);
    const edited = { ...root, children: [{ ...legacy, children: legacy.children!.slice(1) }] };
    expect(normalizePaginationsAfterEdit(root, edited)).toBe(edited);
  });
});

describe("add and remove pages", () => {
  it("adds the next number, styled like an ordinary page, with no state, interaction or label copied", () => {
    const { root, navId } = setup();
    const withInteraction = setPaginationPageHref(root, navId, parts(root).pages[2].id, "/blog/3");
    const page3 = { ...parts(withInteraction).pages[2], interactions: [{ id: "i", trigger: "click" as const, action: "toggle" as const, targetId: "x" }] };
    const prepared = { ...withInteraction, children: [{ ...navOf(withInteraction), children: navOf(withInteraction).children!.map((child) => (child.id === page3.id ? page3 : child)) }] };
    const next = addPaginationPage(prepared, navId);
    expect(layout(next)).toEqual(["previous(off)", "1*", "2", "3", "4", "next"]);
    const added = parts(next).pages[3];
    expect(added.href).toBe("#");
    expect(added.ariaCurrent).toBeUndefined();
    expect(added.disabled).toBeUndefined();
    expect(added.displayName).toBeUndefined();
    expect(added.interactions).toBeUndefined();
    expect(added.background).toBeUndefined();
    expect(added.typography?.color).toBe(PAGINATION_COLORS.pageText);
    expect(new Set((navOf(next).children ?? []).map((child) => child.id)).size).toBe(6);
  });

  it("adds a page styled like an ordinary page even when the only page is current", () => {
    let { root } = setup();
    const { navId } = setup();
    root = { ...root, children: [{ ...navOf(root), id: navId }] };
    root = removePaginationPage(root, navId, parts(root).pages[2].id);
    root = removePaginationPage(root, navId, parts(root).pages[1].id);
    expect(layout(root)).toEqual(["previous(off)", "1*", "next(off)"]);
    root = addPaginationPage(root, navId);
    expect(layout(root)).toEqual(["previous(off)", "1*", "2", "next"]);
    expect(parts(root).pages[1].background).toBeUndefined();
  });

  it(`stops at ${MAX_PAGINATION_PAGES} pages and refuses to remove the last one`, () => {
    let { root } = setup();
    const { navId } = { navId: navOf(root).id };
    for (let count = 3; count < MAX_PAGINATION_PAGES; count++) root = addPaginationPage(root, navId);
    expect(parts(root).pages).toHaveLength(MAX_PAGINATION_PAGES);
    expect(addPaginationPage(root, navId)).toBe(root);
    expect(pageTexts(root)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]);
    while (parts(root).pages.length > 1) root = removePaginationPage(root, navId, parts(root).pages.at(-1)!.id);
    expect(removePaginationPage(root, navId, parts(root).pages[0].id)).toBe(root);
  });

  it("removing renumbers default labels after it, keeps custom labels, destinations and the other ids", () => {
    let { root } = setup();
    const navId = navOf(root).id;
    root = addPaginationPage(root, navId);
    const [p1, p2, p3, p4] = parts(root).pages;
    root = setPaginationPageLabel(root, navId, p4.id, "Archive");
    root = setPaginationPageHref(root, navId, p3.id, "/blog/3");
    root = removePaginationPage(root, navId, p2.id);
    expect(pageTexts(root)).toEqual(["1", "2", "Archive"]);
    expect(parts(root).pages.map((page) => page.id)).toEqual([p1.id, p3.id, p4.id]);
    expect(parts(root).pages[1].href).toBe("/blog/3");
  });

  it("removing the current page makes the page before it current, with the current look", () => {
    let { root } = setup();
    const navId = navOf(root).id;
    root = setPaginationCurrentPage(root, navId, parts(root).pages[2].id);
    root = removePaginationPage(root, navId, parts(root).pages[2].id);
    expect(layout(root)).toEqual(["previous", "1", "2*", "next(off)"]);
    expect(parts(root).pages[1].background?.color).toBe(PAGINATION_COLORS.currentBackground);
  });
});

describe("current page", () => {
  it("moves aria-current and the look, and the boundaries follow; the old page links again", () => {
    let { root } = setup();
    const navId = navOf(root).id;
    const [p1, p2, p3] = parts(root).pages;
    root = setPaginationPageHref(root, navId, p1.id, "/p/1");
    root = setPaginationPageHref(root, navId, p3.id, "/p/3");
    root = setPaginationCurrentPage(root, navId, p2.id);
    expect(layout(root)).toEqual(["previous", "1", "2*", "3", "next"]);
    const { pages, controls } = parts(root);
    expect(controls.previous?.href).toBe("/p/1");
    expect(controls.next?.href).toBe("/p/3");
    expect(pages[1].background?.color).toBe(PAGINATION_COLORS.currentBackground);
    expect(pages[1].display?.cursor).toBe("default");
    expect(pages[0].background).toBeUndefined();
    expect(pages[0].display?.cursor).toBeUndefined();
    expect(pages[0].href).toBe("/p/1");
    // The enabled Previous lost the muted look; the starter step look returns.
    expect(controls.previous?.typography?.color).toBe(PAGINATION_COLORS.stepText);
    expect(controls.previous?.display?.cursor).toBeUndefined();
  });

  it("on the last page Next is disabled and Previous enabled; the stored href of a disabled control stays", () => {
    let { root } = setup();
    const navId = navOf(root).id;
    root = setPaginationCurrentPage(root, navId, parts(root).pages[2].id);
    expect(layout(root)).toEqual(["previous", "1", "2", "3*", "next(off)"]);
    expect(parts(root).controls.next?.typography?.color).toBe(PAGINATION_COLORS.disabledText);
    expect(parts(root).controls.next?.display?.cursor).toBe("not-allowed");
  });

  it("keeps an author's custom current-page look when the current page moves", () => {
    let { root } = setup();
    const navId = navOf(root).id;
    const custom = { ...parts(root).pages[0], background: { color: "#7c3aed" }, typography: { color: "#fefce8", fontSize: { value: 20, unit: "px" as const } } };
    root = { ...root, children: [{ ...navOf(root), children: navOf(root).children!.map((child) => (child.id === custom.id ? custom : child)) }] };
    root = setPaginationCurrentPage(root, navId, parts(root).pages[1].id);
    const [old, current] = parts(root).pages;
    expect(current.background?.color).toBe("#7c3aed");
    expect(current.typography?.color).toBe("#fefce8");
    expect(old.background).toBeUndefined();
    // Non-state styling stays on its own page.
    expect(old.typography?.fontSize).toEqual({ value: 20, unit: "px" });
  });

  it("is a no-op for the page that is already current", () => {
    const { root, navId } = setup();
    expect(setPaginationCurrentPage(root, navId, parts(root).pages[0].id)).toBe(root);
  });
});

describe("labels and destinations", () => {
  it("refuses blank labels and unsafe destinations, keeping the previous value", () => {
    const { root, navId } = setup();
    const page = parts(root).pages[1];
    expect(setPaginationPageLabel(root, navId, page.id, "   ")).toBe(root);
    expect(setPaginationPageHref(root, navId, page.id, "javascript:alert(1)")).toBe(root);
    expect(setPaginationPageHref(root, navId, page.id, "")).toBe(root);
    const labelled = setPaginationPageLabel(root, navId, page.id, "  Intro <b>  ");
    expect(parts(labelled).pages[1].text).toBe("Intro <b>");
  });

  it("a destination edit updates the boundary controls that point at that page", () => {
    const { root, navId } = setup();
    const next = setPaginationPageHref(root, navId, parts(root).pages[1].id, "?page=2");
    expect(parts(next).controls.next?.href).toBe("?page=2");
  });

  it("an adjacent page without a usable destination disables the control instead of inventing a URL", () => {
    const { root } = setup();
    const nav = navOf(root);
    const broken = { ...nav, children: nav.children!.map((child, index) => (index === 2 ? { ...child, href: undefined } : child)) };
    const normalized = normalizePagination(broken);
    expect(getPaginationParts(normalized).controls.next?.disabled).toBe(true);
  });
});

describe("controls", () => {
  it("First and Last are inserted at the ends, styled like the step controls, and follow the boundaries", () => {
    let { root } = setup();
    const navId = navOf(root).id;
    root = setPaginationControlVisible(root, navId, "first", true);
    root = setPaginationControlVisible(root, navId, "last", true);
    expect(layout(root)).toEqual(["first(off)", "previous(off)", "1*", "2", "3", "next", "last"]);
    const { controls } = parts(root);
    expect(controls.first?.text).toBe("First");
    expect(controls.first?.typography?.fontSize).toEqual({ value: 14, unit: "px" });
    expect(controls.last?.typography?.color).toBe(PAGINATION_COLORS.stepText);
    root = setPaginationCurrentPage(root, navId, parts(root).pages[2].id);
    expect(layout(root)).toEqual(["first", "previous", "1", "2", "3*", "next(off)", "last(off)"]);
    // Not duplicated when shown twice.
    expect(setPaginationControlVisible(root, navId, "first", true)).toBe(root);
  });

  it("hiding removes the control node; showing it again puts it back in place", () => {
    let { root } = setup();
    const navId = navOf(root).id;
    root = setPaginationControlVisible(root, navId, "previous", false);
    root = setPaginationControlVisible(root, navId, "next", false);
    expect(layout(root)).toEqual(["1*", "2", "3"]);
    root = setPaginationControlVisible(root, navId, "next", true);
    root = setPaginationControlVisible(root, navId, "previous", true);
    expect(layout(root)).toEqual(["previous(off)", "1*", "2", "3", "next"]);
  });

  it("the ellipsis sits before the last page, pages are added before it, and it goes when one page is left", () => {
    let { root } = setup();
    const navId = navOf(root).id;
    root = setPaginationControlVisible(root, navId, "ellipsis", true);
    expect(layout(root)).toEqual(["previous(off)", "1*", "2", "ellipsis", "3", "next"]);
    const ellipsis = parts(root).controls.ellipsis!;
    expect(ellipsis.tag).toBe("p");
    expect(ellipsis.text).toBe("…");
    expect(ellipsis.href).toBeUndefined();
    root = setPaginationPageLabel(root, navId, parts(root).pages[2].id, "10");
    root = addPaginationPage(root, navId);
    expect(layout(root)).toEqual(["previous(off)", "1*", "2", "3", "ellipsis", "10", "next"]);
    while (parts(root).pages.length > 1) root = removePaginationPage(root, navId, parts(root).pages.at(-1)!.id);
    expect(layout(root)).toEqual(["previous(off)", "1*", "next(off)"]);
    expect(setPaginationControlVisible(root, navId, "ellipsis", true)).toBe(root);
  });
});

describe("normalization after generic edits", () => {
  it("a Pagination that lost its current page gets one; one with two keeps the preferred", () => {
    const { root } = setup();
    const nav = navOf(root);
    const [, p1, p2] = nav.children!;
    const withoutCurrent = { ...root, children: [{ ...nav, children: nav.children!.filter((child) => child.id !== p1.id) }] };
    const fixed = normalizePaginationsAfterEdit(root, withoutCurrent);
    expect(currentTexts(fixed)).toEqual(["2"]);
    expect(parts(fixed).pages[0].background?.color).toBe(PAGINATION_COLORS.currentBackground);

    const twoCurrent = { ...root, children: [{ ...nav, children: nav.children!.map((child) => (child.id === p2.id ? { ...child, ariaCurrent: "page" as const } : child)) }] };
    expect(currentTexts(normalizePaginationsAfterEdit(root, twoCurrent, { preferredCurrentId: p2.id }))).toEqual(["2"]);
    expect(currentTexts(normalizePaginationsAfterEdit(root, twoCurrent))).toEqual(["1"]);
  });

  it("leaves untouched Paginations as the same objects", () => {
    const first = createPaginationNode();
    const second = createPaginationNode();
    const root: EditorElementNode = { id: "page-root", tag: "page", children: [first, second] };
    const edited = { ...root, children: [first, { ...second, children: second.children!.slice(0, 4) }] };
    const normalized = normalizePaginationsAfterEdit(root, edited);
    expect(normalized.children![0]).toBe(first);
  });
});
