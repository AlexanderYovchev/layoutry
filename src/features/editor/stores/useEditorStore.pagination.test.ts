import { afterEach, describe, expect, it } from "vitest";
import { createElementNode } from "@/features/editor/factories/elementFactories";
import type { EditorElementNode } from "@/features/editor/types/document";
import { getCurrentPageLinks, isPaginationNode } from "@/features/editor/types/pagination";
import { collectNodeIds } from "@/features/editor/utils/collectNodeIds";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { parseProjectFile } from "@/features/project/utils/parseProjectFile";
import { createProjectMetadata, serializeProject } from "@/features/project/utils/serializeProject";
import { legacyPaginationNode } from "../../../../test/fixtures/legacyPagination";
import { useEditorStore } from "./useEditorStore";

/**
 * BC-09.2 — the new Pagination through the real store: insertion, history,
 * copy/paste, duplication and save/reopen keep its marker and its
 * accessibility fields, and a copy never becomes a second current page.
 */

const initialState = useEditorStore.getState();
const store = () => useEditorStore.getState();

function insertPagination(): EditorElementNode {
  const pagination = createElementNode("pagination");
  store().insertElement("page-root", pagination);
  return pagination;
}

function node(id: string): EditorElementNode {
  const found = findNodeById(store().document, id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
}

const paginations = () => (store().document.children ?? []).filter(isPaginationNode);
const allCurrentLinks = (root: EditorElementNode): EditorElementNode[] => [
  ...(root.tag === "a" && root.ariaCurrent === "page" ? [root] : []),
  ...(root.children ?? []).flatMap(allCurrentLinks),
];

function saveAndReopen(): EditorElementNode {
  const text = serializeProject({ metadata: createProjectMetadata({ id: "project-1", now: new Date(0) }), document: store().document });
  expect(JSON.parse(text).formatVersion).toBe(3);
  const result = parseProjectFile(text);
  if (!result.ok) throw new Error(result.error.message);
  return result.project.document;
}

describe("Pagination in the editor store (BC-09.2)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("inserts as one Undo step, selects the nav, and Undo/Redo remove and restore it exactly", () => {
    const before = store().past.length;
    const pagination = insertPagination();
    expect(store().past.length).toBe(before + 1);
    expect(store().selection.primaryId).toBe(pagination.id);
    const inserted = structuredClone(node(pagination.id));

    store().undo();
    expect(findNodeById(store().document, pagination.id)).toBeUndefined();
    store().redo();
    expect(node(pagination.id)).toEqual(inserted);
    expect(isPaginationNode(node(pagination.id))).toBe(true);
  });

  it("save and reopen keep the marker, the label, the current page and the disabled Previous", () => {
    const pagination = insertPagination();
    const reopened = findNodeById(saveAndReopen(), pagination.id);
    expect(reopened).toEqual(node(pagination.id));
    expect(reopened?.component).toBe("pagination");
    expect(reopened?.ariaLabel).toBe("Pagination");
    expect(reopened?.children?.[0].disabled).toBe(true);
    expect(getCurrentPageLinks(reopened!).map((link) => link.text)).toEqual(["1"]);
  });

  it("duplicating the whole Pagination gives a second marked Pagination with its own single current page and fresh ids", () => {
    const pagination = insertPagination();
    store().selectOnly(pagination.id);
    store().duplicateSelection();
    const [first, second] = paginations();
    expect(paginations()).toHaveLength(2);
    expect(second.id).not.toBe(first.id);
    expect(getCurrentPageLinks(first)).toHaveLength(1);
    expect(getCurrentPageLinks(second)).toHaveLength(1);
    expect(second.ariaLabel).toBe("Pagination");
    expect(second.children?.[0].disabled).toBe(true);
    const firstIds = collectNodeIds(first);
    expect([...collectNodeIds(second)].some((id) => firstIds.has(id))).toBe(false);
  });

  it("copy and paste of the whole Pagination also keeps its marker and one current page", () => {
    const pagination = insertPagination();
    store().selectOnly(pagination.id);
    store().copySelection();
    store().selectOnly("page-root");
    store().pasteClipboard();
    expect(paginations()).toHaveLength(2);
    for (const each of paginations()) expect(getCurrentPageLinks(each)).toHaveLength(1);
  });

  it("duplicating the current page link gives an ordinary page link: still exactly one current page", () => {
    const pagination = insertPagination();
    const current = getCurrentPageLinks(node(pagination.id))[0];
    store().selectOnly(current.id);
    store().duplicateSelection();
    const after = node(pagination.id);
    expect(after.children).toHaveLength(6);
    expect(getCurrentPageLinks(after).map((link) => link.id)).toEqual([current.id]);
    const copy = node(store().selection.primaryId!);
    expect(copy.ariaCurrent).toBeUndefined();
    expect(copy.text).toBe("1");
    // Undo removes the copy and leaves the original current page.
    store().undo();
    expect(node(pagination.id).children).toHaveLength(5);
    expect(node(current.id).ariaCurrent).toBe("page");
  });

  it("pasting a copied current page link anywhere never adds a second current page", () => {
    const pagination = insertPagination();
    const current = getCurrentPageLinks(node(pagination.id))[0];
    store().selectOnly(current.id);
    store().copySelection();
    store().selectOnly(pagination.id);
    store().pasteClipboard();
    store().selectOnly("page-root");
    store().pasteClipboard();
    expect(allCurrentLinks(store().document).map((link) => link.id)).toEqual([current.id]);
  });

  it("duplicating an ordinary page link copies no accessibility state", () => {
    const pagination = insertPagination();
    const page2 = node(pagination.id).children![2];
    store().selectOnly(page2.id);
    store().duplicateSelection();
    const copy = node(store().selection.primaryId!);
    expect(copy.ariaCurrent).toBeUndefined();
    expect(copy.disabled).toBeUndefined();
    expect(copy.component).toBeUndefined();
    expect(getCurrentPageLinks(node(pagination.id))).toHaveLength(1);
  });

  it("the generic Navigation links actions don't touch a marked Pagination (no history entry)", () => {
    const pagination = insertPagination();
    const before = store().document;
    const history = store().past.length;
    store().addNavigationLink(pagination.id);
    store().removeNavigationLink(pagination.id, node(pagination.id).children![1].id);
    store().moveNavigationLink(pagination.id, node(pagination.id).children![2].id, "up");
    expect(store().document).toBe(before);
    expect(store().past.length).toBe(history);
  });

  it("a legacy Pagination keeps the generic Navigation links actions, unchanged", () => {
    const legacy = legacyPaginationNode();
    for (const child of legacy.children ?? []) delete child.interactions;
    store().insertElement("page-root", legacy);
    store().addNavigationLink(legacy.id);
    expect(node(legacy.id).children?.map((child) => `${child.tag}:${child.text}`)).toEqual([
      "button:Previous",
      "a:1",
      "a:2",
      "a:3",
      "a:New link",
      "button:Next",
    ]);
    expect(isPaginationNode(node(legacy.id))).toBe(false);
  });
});
