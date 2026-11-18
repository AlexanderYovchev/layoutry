import { afterEach, describe, expect, it } from "vitest";
import { createElementNode } from "@/features/editor/factories/elementFactories";
import type { EditorElementNode } from "@/features/editor/types/document";
import { getPaginationParts, isPaginationNode } from "@/features/editor/types/pagination";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { parseProjectFile } from "@/features/project/utils/parseProjectFile";
import { createProjectMetadata, serializeProject } from "@/features/project/utils/serializeProject";
import { legacyPaginationNode } from "../../../../test/fixtures/legacyPagination";
import { useEditorStore } from "./useEditorStore";

/**
 * BC-09.3 — Pagination management through the real store: each action is
 * one Undo step, removals clean interaction references, and generic edits
 * (delete, cut/paste, copy/paste, duplicate) keep exactly one current page.
 */

const initialState = useEditorStore.getState();
const store = () => useEditorStore.getState();

function insert(): string {
  const nav = createElementNode("pagination");
  store().insertElement("page-root", nav);
  return nav.id;
}

const nav = (id: string): EditorElementNode => {
  const found = findNodeById(store().document, id);
  if (!found) throw new Error(id);
  return found;
};
const parts = (id: string) => getPaginationParts(nav(id));
const currents = (id: string) => parts(id).pages.filter((page) => page.ariaCurrent === "page").map((page) => page.text);
const layout = (id: string) =>
  (nav(id).children ?? []).map((child) => {
    const role = parts(id).roleById.get(child.id);
    return role ? `${role}${child.disabled ? "(off)" : ""}` : `${child.text}${child.ariaCurrent === "page" ? "*" : ""}`;
  });

function expectOneUndoStep(action: () => void) {
  const before = store().document;
  const history = store().past.length;
  action();
  const after = store().document;
  expect(after).not.toBe(before);
  expect(store().past.length).toBe(history + 1);
  store().undo();
  expect(store().document).toBe(before);
  store().redo();
  expect(store().document).toEqual(after);
}

describe("Pagination management in the store (BC-09.3)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("every management action is exactly one Undo step, and Redo reproduces it", () => {
    const id = insert();
    expectOneUndoStep(() => store().addPaginationPage(id));
    expectOneUndoStep(() => store().setPaginationCurrentPage(id, parts(id).pages[2].id));
    expectOneUndoStep(() => store().setPaginationPageLabel(id, parts(id).pages[0].id, "Start"));
    expectOneUndoStep(() => store().setPaginationPageHref(id, parts(id).pages[1].id, "/p/2"));
    expectOneUndoStep(() => store().setPaginationControlVisible(id, "first", true));
    expectOneUndoStep(() => store().setPaginationControlVisible(id, "last", true));
    expectOneUndoStep(() => store().setPaginationControlVisible(id, "ellipsis", true));
    expectOneUndoStep(() => store().setPaginationControlVisible(id, "previous", false));
    expectOneUndoStep(() => store().removePaginationPage(id, parts(id).pages[1].id));
  });

  it("a refused action pushes no history entry", () => {
    const id = insert();
    const history = store().past.length;
    store().setPaginationPageLabel(id, parts(id).pages[0].id, "  ");
    store().setPaginationPageHref(id, parts(id).pages[0].id, "javascript:alert(1)");
    store().setPaginationCurrentPage(id, parts(id).pages[0].id);
    store().setPaginationControlVisible(id, "next", true);
    while (parts(id).pages.length > 1) store().removePaginationPage(id, parts(id).pages.at(-1)!.id);
    const atMinimum = store().past.length;
    store().removePaginationPage(id, parts(id).pages[0].id);
    expect(store().past.length).toBe(atMinimum);
    expect(atMinimum).toBe(history + 2);
  });

  it("removing a page also removes interactions targeting it, and Undo restores both", () => {
    const id = insert();
    const page3 = parts(id).pages[2];
    store().insertElement("page-root", { id: "trigger", tag: "button", text: "Go", interactions: [{ id: "i-1", trigger: "click", action: "toggle", targetId: page3.id }, { id: "i-2", trigger: "click", action: "toggle", targetId: id }] });
    store().removePaginationPage(id, page3.id);
    expect(findNodeById(store().document, "trigger")?.interactions?.map((binding) => binding.id)).toEqual(["i-2"]);
    // Still saveable: no dangling target.
    expect(() => serializeProject({ metadata: createProjectMetadata({ id: "p", now: new Date(0) }), document: store().document })).not.toThrow();
    store().undo();
    expect(findNodeById(store().document, "trigger")?.interactions?.map((binding) => binding.id)).toEqual(["i-1", "i-2"]);
    expect(parts(id).pages).toHaveLength(3);
  });

  it("hiding a control removes interactions targeting it", () => {
    const id = insert();
    const next = parts(id).controls.next!;
    store().insertElement("page-root", { id: "trigger", tag: "button", text: "Go", interactions: [{ id: "i-1", trigger: "click", action: "hide", targetId: next.id }] });
    store().setPaginationControlVisible(id, "next", false);
    expect(findNodeById(store().document, "trigger")?.interactions).toBeUndefined();
  });

  it("save and reopen keep labels, destinations, the current page and the controls", () => {
    const id = insert();
    store().setPaginationControlVisible(id, "first", true);
    store().setPaginationPageLabel(id, parts(id).pages[2].id, "Archive");
    store().setPaginationPageHref(id, parts(id).pages[1].id, "/blog/2");
    store().setPaginationCurrentPage(id, parts(id).pages[1].id);
    const text = serializeProject({ metadata: createProjectMetadata({ id: "p", now: new Date(0) }), document: store().document });
    const reopened = parseProjectFile(text);
    if (!reopened.ok) throw new Error(reopened.error.message);
    expect(findNodeById(reopened.project.document, id)).toEqual(nav(id));
    expect(JSON.parse(text).formatVersion).toBe(3);
  });

  it("Delete of the current page on the Canvas promotes the page before it, in the same Undo step", () => {
    const id = insert();
    store().setPaginationCurrentPage(id, parts(id).pages[1].id);
    store().selectOnly(parts(id).pages[1].id);
    const history = store().past.length;
    store().deleteSelection();
    expect(layout(id)).toEqual(["previous(off)", "1*", "3", "next"]);
    expect(store().past.length).toBe(history + 1);
    store().undo();
    expect(layout(id)).toEqual(["previous", "1", "2*", "3", "next"]);
  });

  it("cut and paste of the current page back into its Pagination moves it and keeps it current", () => {
    const id = insert();
    const current = parts(id).pages[0];
    store().selectOnly(current.id);
    store().cutSelection();
    expect(currents(id)).toEqual(["2"]);
    store().selectOnly(id);
    store().pasteClipboard();
    expect(currents(id)).toEqual(["1"]);
    expect(parts(id).pages).toHaveLength(3);
    // The page that stood in while it was cut is ordinary again.
    expect(parts(id).pages.filter((page) => page.background?.color === "#18181b")).toHaveLength(1);
  });

  it("copying a current page into another Pagination never replaces that Pagination's current page", () => {
    const first = insert();
    const second = insert();
    store().setPaginationCurrentPage(second, parts(second).pages[2].id);
    store().selectOnly(parts(first).pages[0].id);
    store().copySelection();
    store().selectOnly(second);
    store().pasteClipboard();
    expect(currents(second)).toEqual(["3"]);
    expect(parts(second).pages).toHaveLength(4);
    const pasted = parts(second).pages[3];
    expect(pasted.ariaCurrent).toBeUndefined();
    expect(pasted.background).toBeUndefined();
    expect(currents(first)).toEqual(["1"]);
  });

  it("duplicating the current page gives an ordinary page, in look as well as state", () => {
    const id = insert();
    store().selectOnly(parts(id).pages[0].id);
    store().duplicateSelection();
    expect(currents(id)).toEqual(["1"]);
    const copy = parts(id).pages[1];
    expect(copy.text).toBe("1");
    expect(copy.background).toBeUndefined();
    expect(copy.display?.cursor).toBeUndefined();
    expect(layout(id)).toEqual(["previous(off)", "1*", "1", "2", "3", "next"]);
  });

  it("duplicating and copy/pasting whole Paginations keep one current page each and fresh ids", () => {
    const id = insert();
    store().selectOnly(id);
    store().duplicateSelection();
    store().copySelection();
    store().selectOnly("page-root");
    store().pasteClipboard();
    const all = (store().document.children ?? []).filter(isPaginationNode);
    expect(all).toHaveLength(3);
    for (const each of all) expect(getPaginationParts(each).pages.filter((page) => page.ariaCurrent === "page")).toHaveLength(1);
    expect(new Set(all.flatMap((each) => [each.id, ...(each.children ?? []).map((child) => child.id)])).size).toBe(18);
  });

  it("editing a page's href in its own Link section keeps the boundaries in sync", () => {
    const id = insert();
    store().setElementHref(parts(id).pages[1].id, "/two");
    expect(parts(id).controls.next?.href).toBe("/two");
  });

  it("generic edits never touch a legacy Pagination or other navs", () => {
    const legacy = legacyPaginationNode();
    for (const child of legacy.children ?? []) delete child.interactions;
    store().insertElement("page-root", legacy);
    const before = nav(legacy.id);
    store().selectOnly(legacy.children![1].id);
    store().deleteSelection();
    expect(nav(legacy.id).children?.map((child) => child.text)).toEqual(["Previous", "2", "3", "Next"]);
    expect(nav(legacy.id).children?.every((child) => child.ariaCurrent === undefined && child.displayName === undefined)).toBe(true);
    expect(nav(legacy.id).displayName).toBe(before.displayName);
  });
});
