import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPaginationNode } from "@/features/editor/factories/navigationCompositions";
import type { EditorElementNode } from "@/features/editor/types/document";
import { collectNodeIds } from "@/features/editor/utils/collectNodeIds";
import { findNodeById, findParentId } from "@/features/editor/utils/findNodeById";
import { MULTI_DUPLICATE_REJECTED_NOTICE, MULTI_PASTE_REJECTED_NOTICE, useEditorStore } from "./useEditorStore";

/**
 * BC-10.5 — multi-element Copy / Cut / Paste / Duplicate through the store:
 * minimal subtree roots in document order, fresh ids, interaction
 * remapping, the multi-cut confirmation, all-or-nothing, one Undo step.
 */

const initialState = useEditorStore.getState();
const store = () => useEditorStore.getState();
const node = (id: string) => findNodeById(store().document, id);
const childIds = (id: string) => (node(id)?.children ?? []).map((child) => child.id);
const run = (action: () => void) => act(action);

/** page > s(section) > [p1, box(div) > [b1, b2]], p3, trigger(button → b1), list(ul) > [li1] */
function document(): EditorElementNode {
  return {
    id: "page-root",
    tag: "page",
    children: [
      {
        id: "s",
        tag: "section",
        children: [
          { id: "p1", tag: "p", text: "One" },
          { id: "box", tag: "div", children: [{ id: "b1", tag: "p", text: "B1" }, { id: "b2", tag: "p", text: "B2" }] },
        ],
      },
      { id: "p3", tag: "p", text: "Three" },
      { id: "trigger", tag: "button", text: "Go", interactions: [{ id: "i-1", trigger: "click", action: "toggle", targetId: "b1" }] },
      { id: "list", tag: "ul", children: [{ id: "li1", tag: "li", text: "Item" }] },
    ],
  };
}

function select(ids: string[], primaryId?: string) {
  run(() => store().setSelection(ids, primaryId));
}

describe("multi-element clipboard (BC-10.5)", () => {
  beforeEach(() => {
    useEditorStore.setState(initialState, true);
    store().replaceDocument(document());
  });
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  describe("Copy", () => {
    it("copies the minimal subtree roots once, in document order, with no document, history or selection change", () => {
      // Selection order p3, b1, s: b1 is inside s, so only s and p3 are copied (s first: document order).
      select(["p3", "b1", "s"]);
      const before = store().document;
      run(() => store().copySelection());
      const clipboard = store().clipboard!;
      expect(clipboard.operation).toBe("copy");
      expect(clipboard.nodes.map((root) => root.id)).toEqual(["s", "p3"]);
      // The whole subtree, unselected descendants included.
      expect([...collectNodeIds(clipboard.nodes[0])].sort()).toEqual(["b1", "b2", "box", "p1", "s"]);
      expect(store().document).toBe(before);
      expect(store().past).toHaveLength(0);
      expect(store().selection.ids).toEqual(["p3", "b1", "s"]);
    });

    it("ignores selected ids that no longer exist and never copies the page root", () => {
      select(["ghost", "p3", "page-root", "p1"]);
      run(() => store().copySelection());
      expect(store().clipboard?.nodes.map((root) => root.id)).toEqual(["p1", "p3"]);
    });

    it("one selected element copies exactly as before", () => {
      select(["b1"]);
      run(() => store().copySelection());
      expect(store().clipboard).toEqual({ operation: "copy", nodes: [node("b1")], sourceParentId: "box" });
    });
  });

  describe("Paste", () => {
    it("pastes every root as fresh copies into one destination, in order, as one Undo step, and selects the copies", () => {
      select(["p3", "box"]);
      run(() => store().copySelection());
      select(["s"]);
      run(() => store().pasteClipboard());
      const [, , copyBox, copyP3] = childIds("s");
      expect(childIds("s")).toHaveLength(4);
      // Hierarchy and content preserved, every id fresh.
      expect(node(copyBox)?.tag).toBe("div");
      expect(node(copyBox)?.children?.map((child) => child.text)).toEqual(["B1", "B2"]);
      expect(node(copyP3)?.text).toBe("Three");
      for (const id of [copyBox, copyP3, ...childIds(copyBox)]) expect(["box", "p3", "b1", "b2"]).not.toContain(id);
      expect(store().past).toHaveLength(1);
      expect(store().selection).toEqual({ ids: [copyBox, copyP3], primaryId: copyP3 });
      run(() => store().undo());
      expect(childIds("s")).toEqual(["p1", "box"]);
      run(() => store().redo());
      expect(childIds("s")).toEqual(["p1", "box", copyBox, copyP3]);
    });

    it("repeated paste creates fresh ids every time", () => {
      select(["p1", "p3"]);
      run(() => store().copySelection());
      select(["box"]);
      run(() => store().pasteClipboard());
      run(() => store().pasteClipboard());
      const ids = childIds("box");
      expect(ids).toHaveLength(6);
      expect(new Set(ids).size).toBe(6);
      expect(store().past).toHaveLength(2);
    });

    it("an interaction whose target was copied too points at the copy; one aimed outside the copied set keeps its target", () => {
      select(["trigger", "box"]);
      run(() => store().copySelection());
      select(["page-root"]);
      run(() => store().pasteClipboard());
      const ids = childIds("page-root");
      const copyBox = ids[ids.length - 2];
      const copyTrigger = ids[ids.length - 1];
      const copyB1 = childIds(copyBox)[0];
      expect(node(copyTrigger)?.interactions?.[0].targetId).toBe(copyB1);
      expect(node(copyTrigger)?.interactions?.[0].id).not.toBe("i-1");
      // The original is untouched.
      expect(node("trigger")?.interactions?.[0].targetId).toBe("b1");

      select(["trigger", "p3"]);
      run(() => store().copySelection());
      select(["page-root"]);
      run(() => store().pasteClipboard());
      // Document order: p3 then trigger. b1 wasn't copied, so the copy still targets b1.
      const last = childIds("page-root");
      expect(node(last[last.length - 2])?.text).toBe("Three");
      expect(node(last[last.length - 1])?.interactions?.[0].targetId).toBe("b1");
    });

    it("an external target deleted since the copy: the pasted binding is dropped, as for one element", () => {
      select(["trigger", "p3"]);
      run(() => store().copySelection());
      select(["box"]);
      run(() => store().deleteSelection());
      select(["page-root"]);
      run(() => store().pasteClipboard());
      const ids = childIds("page-root");
      expect(node(ids[ids.length - 2])?.interactions).toBeUndefined();
    });

    it("a destination that can't accept every root rejects the whole paste with a notice", () => {
      select(["li1", "p3"]);
      run(() => store().copySelection());
      // The list accepts the li but not the p: nothing is pasted.
      select(["list"]);
      const before = store().document;
      run(() => store().pasteClipboard());
      expect(store().document).toBe(before);
      expect(store().past).toHaveLength(0);
      expect(store().editorNotice?.message).toBe(MULTI_PASTE_REJECTED_NOTICE);
      expect(store().selection.ids).toEqual(["list"]);
    });

    it("one clipboard element pastes exactly as before (a selected leaf → into its parent)", () => {
      select(["p1"]);
      run(() => store().copySelection());
      select(["b1"]);
      run(() => store().pasteClipboard());
      expect(childIds("box")).toHaveLength(3);
      expect(store().selection.ids).toHaveLength(1);
    });
  });

  describe("Cut", () => {
    it("asks first: nothing is removed and the clipboard is untouched until confirmed; Cancel changes nothing", () => {
      select(["p1"]);
      run(() => store().copySelection());
      const previousClipboard = store().clipboard;
      select(["box", "p3"]);
      const before = store().document;
      run(() => store().cutSelection());
      expect(store().pendingDeletion).toMatchObject({ kind: "cut", rootIds: ["box", "p3"], nestedCount: 2 });
      expect(store().document).toBe(before);
      expect(store().clipboard).toBe(previousClipboard);
      run(() => store().cancelPendingDeletion());
      expect(store().pendingDeletion).toBeNull();
      expect(store().document).toBe(before);
      expect(store().clipboard).toBe(previousClipboard);
      expect(store().past).toHaveLength(0);
      expect(store().selection.ids).toEqual(["box", "p3"]);
    });

    it("confirmed: removes each subtree once, cleans interactions aimed at them, fills the clipboard; one Undo restores both", () => {
      select(["b1", "box", "p3"]);
      run(() => store().cutSelection());
      run(() => store().confirmPendingDeletion());
      expect(node("box")).toBeUndefined();
      expect(node("p3")).toBeUndefined();
      expect(node("trigger")?.interactions).toBeUndefined();
      expect(store().clipboard?.operation).toBe("cut");
      expect(store().clipboard?.nodes.map((root) => root.id)).toEqual(["box", "p3"]);
      expect(store().past).toHaveLength(1);

      run(() => store().undo());
      expect(node("box")).toBeDefined();
      expect(node("trigger")?.interactions?.[0].targetId).toBe("b1");
      // Undo never touches the clipboard; a later paste still gets fresh ids.
      expect(store().clipboard?.nodes.map((root) => root.id)).toEqual(["box", "p3"]);
      select(["page-root"]);
      run(() => store().pasteClipboard());
      // The restored originals plus fresh copies: no id twice.
      expect(node("box")).toBeDefined();
      expect(node("p3")).toBeDefined();
      const ids = childIds("page-root");
      expect(ids.slice(-2).every((id) => id !== "box" && id !== "p3")).toBe(true);
      const all: string[] = [];
      const walk = (current: EditorElementNode) => {
        all.push(current.id);
        current.children?.forEach(walk);
      };
      walk(store().document);
      expect(new Set(all).size).toBe(all.length);
    });

    it("cut then paste elsewhere: the pasted copies don't assume the cut ids still exist", () => {
      select(["trigger", "box"]);
      run(() => store().cutSelection());
      run(() => store().confirmPendingDeletion());
      select(["s"]);
      run(() => store().pasteClipboard());
      const [, copyBox, copyTrigger] = childIds("s");
      expect(node(copyTrigger)?.interactions?.[0].targetId).toBe(childIds(copyBox)[0]);
      expect(node("b1")).toBeUndefined();
    });

    it("stale: if the selection changed before confirming, nothing is cut and the clipboard is unchanged", () => {
      select(["box", "p3"]);
      run(() => store().cutSelection());
      select(["box"]);
      run(() => store().confirmPendingDeletion());
      expect(node("box")).toBeDefined();
      expect(store().clipboard).toBeNull();
      expect(store().past).toHaveLength(0);
      expect(store().editorNotice?.message).toBe("The selection changed before you confirmed, so nothing was cut.");
    });

    it("one selected element is cut at once, as before", () => {
      select(["p3"]);
      run(() => store().cutSelection());
      expect(store().pendingDeletion).toBeNull();
      expect(node("p3")).toBeUndefined();
      expect(store().clipboard?.nodes.map((root) => root.id)).toEqual(["p3"]);
    });
  });

  describe("Duplicate", () => {
    it("cross-container: each root's copy goes right after its original, in its own parent; one Undo step", () => {
      select(["p3", "b1"]);
      run(() => store().duplicateSelection());
      const [, b1Copy, b2] = childIds("box");
      expect(b2).toBe("b2");
      expect(node(b1Copy)?.text).toBe("B1");
      const top = childIds("page-root");
      const p3Copy = top[top.indexOf("p3") + 1];
      expect(node(p3Copy)?.text).toBe("Three");
      expect(store().selection).toEqual({ ids: [b1Copy, p3Copy], primaryId: p3Copy });
      expect(store().past).toHaveLength(1);
      run(() => store().undo());
      expect(childIds("box")).toEqual(["b1", "b2"]);
    });

    it("a selected parent and child: only the parent's subtree is duplicated, once", () => {
      select(["box", "b2"]);
      run(() => store().duplicateSelection());
      expect(childIds("s")).toHaveLength(3);
      const copy = childIds("s")[2];
      expect(node(copy)?.children).toHaveLength(2);
      expect(childIds("box")).toEqual(["b1", "b2"]);
    });

    it("duplicated together, a trigger and its target: the copy's binding points at the target's copy", () => {
      const before = store().document;
      run(() => store().replaceDocument({ ...before, children: [...before.children!, { id: "t2", tag: "p", text: "Target" }] }));
      run(() =>
        store().replaceDocument({
          ...store().document,
          children: store().document.children!.map((child) => (child.id === "trigger" ? { ...child, interactions: [{ id: "i-2", trigger: "click", action: "toggle", targetId: "t2" }] } : child)),
        }),
      );
      select(["trigger", "t2"]);
      run(() => store().duplicateSelection());
      const top = childIds("page-root");
      const triggerCopy = top[top.indexOf("trigger") + 1];
      const targetCopy = top[top.indexOf("t2") + 1];
      expect(node(triggerCopy)?.interactions?.[0].targetId).toBe(targetCopy);
    });

    it("Pagination: duplicating the current page with another page never makes two current pages", () => {
      const pagination = createPaginationNode();
      run(() => store().replaceDocument({ id: "page-root", tag: "page", children: [pagination] }));
      const pages = pagination.children!.filter((child) => child.tag === "a" && child.text !== undefined && /^\d$/.test(child.text));
      select([pages[0].id, pages[1].id]);
      run(() => store().duplicateSelection());
      const links = node(pagination.id)?.children ?? [];
      expect(links.filter((link) => link.ariaCurrent === "page")).toHaveLength(1);
      expect(links.find((link) => link.ariaCurrent === "page")?.id).toBe(pages[0].id);
      expect(findParentId(store().document, store().selection.ids[0])).toBe(pagination.id);
    });

    it("a selection that is only the page root changes nothing", () => {
      select(["page-root", "ghost"]);
      const before = store().document;
      run(() => store().duplicateSelection());
      expect(store().document).toBe(before);
      expect(store().editorNotice?.message).not.toBe(MULTI_DUPLICATE_REJECTED_NOTICE);
    });
  });

  it("while a confirmation is open, Cut / Paste / Duplicate do nothing", () => {
    select(["p1"]);
    run(() => store().copySelection());
    select(["box", "p3"]);
    run(() => store().requestDeleteSelection());
    const before = store().document;
    run(() => {
      store().pasteClipboard();
      store().duplicateSelection();
      store().cutSelection();
    });
    expect(store().document).toBe(before);
    expect(store().pendingDeletion?.kind).toBe("delete");
  });
});
