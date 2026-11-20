import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { EditorElementNode } from "@/features/editor/types/document";
import { createBasicNavbarNode, createPaginationNode } from "@/features/editor/factories/navigationCompositions";
import { findNodeById, findParentId } from "@/features/editor/utils/findNodeById";
import { exportHtmlCss } from "@/features/export/utils/exportHtmlCss";
import { STYLE_PASTE_FREE_SIZE_NOTICE, stylePastedWithSkipsNotice, useEditorStore } from "./useEditorStore";

/** BC-11.4 audit: cross-feature reproductions for Copy/Paste CSS. */

const initialState = useEditorStore.getState();
const store = () => useEditorStore.getState();
const node = (id: string) => findNodeById(store().document, id)!;
const run = (action: () => void) => act(action);
const select = (ids: string[], primaryId?: string) => run(() => store().setSelection(ids, primaryId));
const load = (children: EditorElementNode[]) => run(() => store().replaceDocument({ id: "page-root", tag: "page", children }));
const flex = { direction: "row", wrap: "nowrap", justifyContent: "start", alignItems: "start", rowGap: 0, columnGap: 0 } as const;

describe("BC-11.4 audit", () => {
  beforeEach(() => useEditorStore.setState(initialState, true));
  afterEach(() => useEditorStore.setState(initialState, true));

  it("repro: global Copy CSS never copies a group the source's own Inspector doesn't offer (stale Flex item, Position on a Free child)", () => {
    load([
      // p keeps a flexChild from an earlier Flex parent; its parent is now a plain block.
      { id: "block", tag: "div", children: [{ id: "stale", tag: "p", text: "S", typography: { color: "#ff0000" }, flexChild: { grow: 5, shrink: 0, basis: "auto", alignSelf: "end" } }] },
      { id: "free", tag: "div", layoutMode: "free", dimensions: { preferredWidth: 400, preferredHeight: 300, offsetX: 0, offsetY: 0 }, children: [{ id: "kid", tag: "p", text: "K", freeLayout: { x: 0, y: 0, width: 80, height: 30 }, position: { position: "relative" } }] },
      { id: "row", tag: "div", flowLayout: { display: "flex", flex }, children: [{ id: "dest", tag: "p", text: "D" }] },
    ]);
    select(["stale"]);
    run(() => store().copyStyle());
    expect(Object.keys(store().styleClipboard!.groups)).toEqual(["typography"]);
    select(["kid"]);
    run(() => store().copyStyle());
    expect(store().styleClipboard!.groups.position).toBeUndefined();
    select(["dest"]);
    run(() => store().pasteStyle());
    expect(node("dest").flexChild).toBeUndefined();
  });

  it("Paste CSS never touches identity, content, behaviour or structure — Navbar, Pagination, form control, link", () => {
    const navbar = createBasicNavbarNode();
    const pagination = createPaginationNode();
    load([
      { id: "src", tag: "a", text: "Src", href: "https://example.com", htmlId: "src-id", className: "src-class", typography: { color: "#ff0000" }, background: { color: "#00ff00" }, spacing: { padding: { top: 7 } } },
      navbar,
      pagination,
      { id: "field", tag: "input", inputType: "text", value: "typed", name: "q", placeholder: "Search", htmlId: "field-id" },
      { id: "link", tag: "a", text: "Link", href: "#target", className: "keep", interactions: [{ id: "i", trigger: "click", action: "toggle", targetId: "field" }] },
    ]);
    select(["src"]);
    run(() => store().copyStyle());
    const navLinks = navbar.children!.filter((child) => child.tag === "a").map((child) => child.id);
    const pages = pagination.children!.filter((child) => child.tag === "a").map((child) => child.id);
    select([...navLinks, ...pages, "field", "link", navbar.id]);
    const strip = (current: EditorElementNode) => {
      const { typography, background, spacing, ...rest } = current;
      void typography;
      void background;
      void spacing;
      return { ...rest, children: current.children?.map((child) => child.id) };
    };
    const before = [...navLinks, ...pages, "field", "link", navbar.id, pagination.id].map((id) => strip(node(id)));
    run(() => store().pasteStyle());
    expect(store().past).toHaveLength(1);
    // Everything except the three pasted CSS groups is exactly as before: ids, text, href, htmlId, class,
    // value/name/placeholder, interactions, aria-current (one current page), children order.
    expect([...navLinks, ...pages, "field", "link", navbar.id, pagination.id].map((id) => strip(node(id)))).toEqual(before);
    expect(node("link").background).toEqual({ color: "#00ff00" });
    expect(node(pages[1]).ariaCurrent).toBe(pagination.children![1].ariaCurrent);
    expect((node(pagination.id).children ?? []).filter((link) => link.ariaCurrent === "page")).toHaveLength(1);
  });

  it("Content Layout skipped across Flow/Free, other groups still applied in the same step; valid Free geometry applied, oversized refused with nothing moved", () => {
    load([
      { id: "src", tag: "div", flowLayout: { display: "flex", flex }, background: { color: "#123456" }, dimensions: { preferredWidth: 120, preferredHeight: 60, offsetX: 0, offsetY: 0 }, children: [] },
      { id: "free", tag: "div", layoutMode: "free", dimensions: { preferredWidth: 400, preferredHeight: 300, offsetX: 0, offsetY: 0 }, children: [{ id: "kid", tag: "div", freeLayout: { x: 10, y: 20, width: 40, height: 40 }, children: [] }] },
      { id: "free2", tag: "div", layoutMode: "free", children: [] },
      { id: "big", tag: "div", dimensions: { preferredWidth: 999, preferredHeight: 60, offsetX: 0, offsetY: 0 }, children: [] },
    ]);
    select(["src"]);
    run(() => store().copyStyle());
    // A selected Free container AND its child: the container would shrink to 120 x 60, so the child at
    // x 10 would no longer fit inside it — refused whole (containment), nothing changes.
    select(["free", "kid"]);
    const untouched = store().document;
    run(() => store().pasteStyle());
    expect(store().document).toBe(untouched);
    expect(store().editorNotice?.message).toBe(STYLE_PASTE_FREE_SIZE_NOTICE);
    select(["free2", "kid"]);
    run(() => store().pasteStyle());
    expect(node("free2").layoutMode).toBe("free");
    expect(node("free2").flowLayout).toBeUndefined();
    expect(node("free2").background).toEqual({ color: "#123456" });
    expect(node("kid").freeLayout).toEqual({ x: 10, y: 20, width: 120, height: 60 });
    expect(store().editorNotice?.message).toBe(stylePastedWithSkipsNotice(["Content Layout"]));
    run(() => store().undo());
    expect(node("kid").freeLayout).toEqual({ x: 10, y: 20, width: 40, height: 40 });
    run(() => store().redo());
    expect(node("kid").freeLayout?.width).toBe(120);
    select(["big"]);
    run(() => store().copyStyle());
    select(["kid", "src"]);
    const before = store().document;
    run(() => store().pasteStyle());
    expect(store().document).toBe(before);
    expect(store().editorNotice?.message).toBe(STYLE_PASTE_FREE_SIZE_NOTICE);
    expect(findParentId(store().document, "kid")).toBe("free");
  });

  it("workflow 5: copy element → copy CSS → paste element → paste CSS → Undo → Undo → Redo → Redo; both clipboards intact, ids unique", () => {
    load([
      { id: "btn", tag: "button", text: "Go", htmlId: "go", interactions: [{ id: "bi", trigger: "click", action: "toggle", targetId: "t" }] },
      { id: "t", tag: "p", text: "Target" },
      { id: "styled", tag: "h2", text: "Styled", typography: { color: "#ff0000" }, boxShadow: [{ id: "l", enabled: true, inset: false, offsetX: { value: 2, unit: "px" }, offsetY: { value: 2, unit: "px" }, blur: { value: 0, unit: "px" }, spread: { value: 0, unit: "px" }, color: "#000000" }] },
    ]);
    select(["btn"]);
    run(() => store().copySelection());
    select(["styled"]);
    run(() => store().copyStyle());
    const elementClipboard = store().clipboard;
    const styleClipboard = store().styleClipboard;
    select(["page-root"]);
    run(() => store().pasteClipboard());
    const copy = store().selection.ids[0];
    run(() => store().pasteStyle());
    expect(node(copy).typography?.color).toBe("#ff0000");
    expect(store().selection.ids).toEqual([copy]);
    run(() => store().undo());
    expect(node(copy).typography).toBeUndefined();
    run(() => store().undo());
    expect(findNodeById(store().document, copy)).toBeUndefined();
    run(() => store().redo());
    run(() => store().redo());
    expect(node(copy).typography?.color).toBe("#ff0000");
    expect(node(copy).boxShadow).not.toBe(node("styled").boxShadow);
    expect(node(copy).htmlId).toBe("go-copy");
    expect(node(copy).interactions?.[0].targetId).toBe("t");
    expect([store().clipboard, store().styleClipboard]).toEqual([elementClipboard, styleClipboard]);
    const ids: string[] = [];
    const walk = (current: EditorElementNode) => {
      ids.push(current.id);
      current.children?.forEach(walk);
    };
    walk(store().document);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("a multi-destination background image + gradient paste exports valid CSS for every element (no clipboard metadata)", () => {
    const image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    load([
      { id: "src", tag: "div", background: { color: "#ffffff", sourceType: "image", image }, children: [] },
      { id: "d1", tag: "div", children: [] },
      { id: "d2", tag: "section", children: [] },
    ]);
    select(["src"]);
    run(() => store().copyStyle());
    select(["d1", "d2"]);
    run(() => store().pasteStyle());
    for (const id of ["d1", "d2"]) expect(node(id).background?.image).toBe(image);
    const result = exportHtmlCss(store().document, { mode: "standalone", title: "audit" });
    expect(result.ok).toBe(true);
    const html = result.files[0].content;
    expect(html.match(/background-image: url\(/g)?.length).toBe(3);
    expect(html).not.toMatch(/styleClipboard|sourceName/);
  });
});
