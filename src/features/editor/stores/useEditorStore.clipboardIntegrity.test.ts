import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MAX_NAVIGATION_LINKS } from "@/features/editor/commands/navigationLinkCommands";
import { createNavbarLinkNode, createPaginationNode } from "@/features/editor/factories/navigationCompositions";
import { getDefaultFreeElementSizeForNode } from "@/features/editor/factories/elementFactories";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { FreeLayoutGeometry } from "@/features/editor/types/layout";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import {
  FREE_GROUP_DUPLICATE_REJECTED_NOTICE,
  FREE_GROUP_PASTE_REJECTED_NOTICE,
  NAVIGATION_LINK_LIMIT_DUPLICATE_NOTICE,
  NAVIGATION_LINK_LIMIT_PASTE_NOTICE,
  useEditorStore,
} from "./useEditorStore";

/**
 * BC-10.5.1 — clipboard integrity corrections: Free-layout group
 * arrangement, the Navbar link limit, unique authored HTML ids, and the
 * Pagination current page on a multi-cut pasted back.
 */

const initialState = useEditorStore.getState();
const store = () => useEditorStore.getState();
const node = (id: string) => findNodeById(store().document, id);
const childIds = (id: string) => (node(id)?.children ?? []).map((child) => child.id);
const geometry = (id: string): FreeLayoutGeometry => node(id)!.freeLayout!;
const run = (action: () => void) => act(action);
const select = (ids: string[]) => run(() => store().setSelection(ids));

function load(children: EditorElementNode[]) {
  run(() => store().replaceDocument({ id: "page-root", tag: "page", children }));
}

const free = (id: string, width: number, height: number, children: EditorElementNode[] = []): EditorElementNode => ({
  id,
  tag: "div",
  layoutMode: "free",
  dimensions: { preferredWidth: width, preferredHeight: height, offsetX: 0, offsetY: 0 },
  children,
});

describe("clipboard integrity (BC-10.5.1)", () => {
  beforeEach(() => useEditorStore.setState(initialState, true));
  afterEach(() => useEditorStore.setState(initialState, true));

  describe("Free-layout group paste", () => {
    beforeEach(() =>
      load([
        free("from", 600, 400, [
          { id: "f1", tag: "p", text: "One", freeLayout: { x: 20, y: 30, width: 100, height: 50 } },
          {
            id: "f2",
            tag: "div",
            layoutMode: "free",
            freeLayout: { x: 200, y: 90, width: 120, height: 80 },
            children: [{ id: "inner", tag: "p", text: "Inner", freeLayout: { x: 5, y: 7, width: 60, height: 20 } }],
          },
        ]),
        free("to", 600, 400),
        free("small", 150, 100),
        { id: "flowP", tag: "p", text: "Flow" },
      ]),
    );

    it("keeps the copies' offsets and sizes, and their descendants' own positions; one Undo step", () => {
      select(["f1", "f2"]);
      run(() => store().copySelection());
      select(["to"]);
      run(() => store().pasteClipboard());
      const [a, b] = childIds("to");
      expect(geometry(b).x - geometry(a).x).toBe(180);
      expect(geometry(b).y - geometry(a).y).toBe(60);
      expect([geometry(a).width, geometry(a).height, geometry(b).width, geometry(b).height]).toEqual([100, 50, 120, 80]);
      expect(node(b)?.children?.[0].freeLayout).toEqual({ x: 5, y: 7, width: 60, height: 20 });
      expect(store().past).toHaveLength(1);
      run(() => store().undo());
      expect(childIds("to")).toEqual([]);
      run(() => store().redo());
      expect(childIds("to")).toEqual([a, b]);
    });

    it("a repeated paste lands as a group at a new, non-overlapping offset, same arrangement", () => {
      select(["f1", "f2"]);
      run(() => store().copySelection());
      select(["to"]);
      run(() => store().pasteClipboard());
      // The copies are now selected (one is a container, which would receive the next paste): paste into "to" again.
      select(["to"]);
      run(() => store().pasteClipboard());
      const [a, b, c, d] = childIds("to");
      expect(geometry(d).x - geometry(c).x).toBe(180);
      expect(geometry(d).y - geometry(c).y).toBe(60);
      expect([geometry(c).x, geometry(c).y]).not.toEqual([geometry(a).x, geometry(a).y]);
      // The second group's block doesn't overlap the first copies.
      const overlaps = (p: FreeLayoutGeometry, q: FreeLayoutGeometry) => p.x < q.x + q.width && p.x + p.width > q.x && p.y < q.y + q.height && p.y + p.height > q.y;
      for (const first of [a, b]) for (const second of [c, d]) expect(overlaps(geometry(first), geometry(second))).toBe(false);
      expect(store().past).toHaveLength(2);
    });

    it("a container too small for the arrangement refuses the whole paste, with a notice and no history", () => {
      select(["f1", "f2"]);
      run(() => store().copySelection());
      select(["small"]);
      const before = store().document;
      run(() => store().pasteClipboard());
      expect(store().document).toBe(before);
      expect(store().past).toHaveLength(0);
      expect(store().editorNotice?.message).toBe(FREE_GROUP_PASTE_REJECTED_NOTICE);
    });

    it("cross-container: a Flow element copied with a Free one is stacked below it at its default Free size", () => {
      select(["f1", "flowP"]);
      run(() => store().copySelection());
      select(["to"]);
      run(() => store().pasteClipboard());
      const [freeCopy, flowCopy] = childIds("to");
      const size = getDefaultFreeElementSizeForNode({ tag: "p" });
      expect(geometry(flowCopy).x).toBe(geometry(freeCopy).x);
      expect(geometry(flowCopy).y).toBe(geometry(freeCopy).y + 50 + 16);
      expect([geometry(flowCopy).width, geometry(flowCopy).height]).toEqual([size.width, size.height]);
    });

    it("duplicating several children of one Free container keeps their arrangement; too big refuses all", () => {
      select(["f1", "f2"]);
      run(() => store().duplicateSelection());
      const ids = childIds("from");
      const a = ids[ids.indexOf("f1") + 1];
      const b = ids[ids.indexOf("f2") + 1];
      expect(geometry(b).x - geometry(a).x).toBe(180);
      expect(geometry(b).y - geometry(a).y).toBe(60);
      expect(store().past).toHaveLength(1);

      // A Free container with no stored size is approximated as 400 x 300 for one-shot placement;
      // children spread wider than that can't be duplicated as a group without distortion.
      load([{ id: "tight", tag: "div", layoutMode: "free", children: [
        { id: "t1", tag: "p", text: "1", freeLayout: { x: 0, y: 0, width: 120, height: 40 } },
        { id: "t2", tag: "p", text: "2", freeLayout: { x: 390, y: 50, width: 100, height: 40 } },
      ] }]);
      select(["t1", "t2"]);
      const before = store().document;
      run(() => store().duplicateSelection());
      expect(store().document).toBe(before);
      expect(store().editorNotice?.message).toBe(FREE_GROUP_DUPLICATE_REJECTED_NOTICE);
    });
  });

  describe("Navbar link limit", () => {
    const links = (prefix: string, count: number) => Array.from({ length: count }, (_, index) => ({ ...createNavbarLinkNode(`${prefix}${index}`), id: `${prefix}${index}` }));
    const nav = (id: string, count: number): EditorElementNode => ({ id, tag: "nav", children: links(`${id}-`, count) });

    it("a multi-paste that would take a nav over the limit is refused whole", () => {
      load([nav("full", MAX_NAVIGATION_LINKS - 1), nav("other", 2)]);
      select(["other-0", "other-1"]);
      run(() => store().copySelection());
      select(["full"]);
      const before = store().document;
      run(() => store().pasteClipboard());
      expect(store().document).toBe(before);
      expect(store().past).toHaveLength(0);
      expect(store().editorNotice?.message).toBe(NAVIGATION_LINK_LIMIT_PASTE_NOTICE);
      // Exactly up to the limit is fine.
      select(["other-0"]);
      run(() => store().copySelection());
      select(["full"]);
      run(() => store().pasteClipboard());
      expect(childIds("full")).toHaveLength(MAX_NAVIGATION_LINKS);
    });

    it("a multi-duplicate of links in a full nav is refused whole; one at the limit by the single path too", () => {
      load([nav("n", MAX_NAVIGATION_LINKS - 1)]);
      select(["n-0", "n-1"]);
      const before = store().document;
      run(() => store().duplicateSelection());
      expect(store().document).toBe(before);
      expect(store().editorNotice?.message).toBe(NAVIGATION_LINK_LIMIT_DUPLICATE_NOTICE);
      select(["n-0"]);
      run(() => store().duplicateSelection());
      expect(childIds("n")).toHaveLength(MAX_NAVIGATION_LINKS);
      run(() => store().duplicateSelection());
      expect(childIds("n")).toHaveLength(MAX_NAVIGATION_LINKS);
      expect(store().past).toHaveLength(1);
    });

    it("nested: a pasted container holding an over-limit nav is refused; an existing over-limit nav is left alone", () => {
      load([
        { id: "wrap", tag: "section", children: [{ id: "legacy", tag: "nav", children: links("l", MAX_NAVIGATION_LINKS + 1) }] },
        { id: "p", tag: "p", text: "P" },
      ]);
      select(["wrap", "p"]);
      run(() => store().duplicateSelection());
      expect(childIds("page-root")).toEqual(["wrap", "p"]);
      expect(store().editorNotice?.message).toBe(NAVIGATION_LINK_LIMIT_DUPLICATE_NOTICE);
      // Copying something unrelated elsewhere doesn't trip on the existing legacy nav.
      select(["p"]);
      run(() => store().duplicateSelection());
      expect(childIds("page-root")).toHaveLength(3);
    });
  });

  describe("authored HTML ids", () => {
    it("copies get unique ids; a link inside the copies to a copied element follows it; outside links and URLs are untouched", () => {
      load([
        { id: "hero", tag: "section", htmlId: "hero", children: [{ id: "h", tag: "h1", text: "Hi" }] },
        { id: "link", tag: "a", text: "Go", href: "#hero" },
        { id: "ext", tag: "a", text: "Ext", href: "https://example.com/#hero" },
        { id: "out", tag: "a", text: "Out", href: "#hero" },
      ]);
      select(["hero", "link", "ext"]);
      run(() => store().copySelection());
      select(["page-root"]);
      run(() => store().pasteClipboard());
      const [copyHero, copyLink, copyExt] = childIds("page-root").slice(-3);
      expect(node(copyHero)?.htmlId).toBe("hero-copy");
      expect(node(copyLink)?.href).toBe("#hero-copy");
      expect(node(copyExt)?.href).toBe("https://example.com/#hero");
      expect(node("hero")?.htmlId).toBe("hero");
      expect(node("out")?.href).toBe("#hero");
      // Again: the next free suffix.
      run(() => store().pasteClipboard());
      expect(node(childIds("page-root").slice(-3)[0])?.htmlId).toBe("hero-copy-2");
    });

    it("single duplicate and paste too; a cut element pasted back keeps its own id", () => {
      load([{ id: "a", tag: "p", text: "A", htmlId: "intro" }, { id: "b", tag: "div", children: [] }]);
      select(["a"]);
      run(() => store().duplicateSelection());
      expect(node(childIds("page-root")[1])?.htmlId).toBe("intro-copy");
      run(() => store().undo());
      run(() => store().cutSelection());
      select(["b"]);
      run(() => store().pasteClipboard());
      expect(node(childIds("b")[0])?.htmlId).toBe("intro");
    });
  });

  describe("Pagination current page", () => {
    it("a multi-cut current page pasted back into its own Pagination stays its one current page", () => {
      const pagination = createPaginationNode();
      load([pagination]);
      const pages = pagination.children!.filter((child) => child.tag === "a" && /^\d$/.test(child.text ?? ""));
      const [current, second] = pages;
      expect(current.ariaCurrent).toBe("page");
      select([current.id, second.id]);
      run(() => store().cutSelection());
      run(() => store().confirmPendingDeletion());
      // While they're cut, another page is current (BC-09 invariants).
      expect((node(pagination.id)?.children ?? []).filter((link) => link.ariaCurrent === "page")).toHaveLength(1);
      select([pagination.id]);
      run(() => store().pasteClipboard());
      const links = node(pagination.id)?.children ?? [];
      const currents = links.filter((link) => link.ariaCurrent === "page");
      expect(currents).toHaveLength(1);
      expect(currents[0].text).toBe(current.text);
      expect(currents[0].id).toBe(store().selection.ids[0]);
    });

    it("pasted into another Pagination (or copied, not cut), the page is an ordinary page there", () => {
      const first = createPaginationNode();
      const other = createPaginationNode();
      load([first, other]);
      const [current, second] = first.children!.filter((child) => child.tag === "a" && /^\d$/.test(child.text ?? ""));
      select([current.id, second.id]);
      run(() => store().copySelection());
      select([first.id]);
      run(() => store().pasteClipboard());
      expect((node(first.id)?.children ?? []).filter((link) => link.ariaCurrent === "page").map((link) => link.id)).toEqual([current.id]);
      select([other.id]);
      run(() => store().pasteClipboard());
      expect((node(other.id)?.children ?? []).filter((link) => link.ariaCurrent === "page")).toHaveLength(1);
    });
  });
});
