import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { describePendingCut, describePendingDeletion, MULTI_CUT_COPY, MULTI_DELETE_COPY, MultiDeleteConfirmDialog } from "./MultiDeleteConfirmDialog";

/** BC-10.2 — the multi-delete confirmation dialog. */

const initialState = useEditorStore.getState();
const store = () => useEditorStore.getState();

describe("MultiDeleteConfirmDialog (BC-10.2)", () => {
  beforeEach(() => {
    useEditorStore.setState(initialState, true);
    store().replaceDocument({
      id: "page-root",
      tag: "page",
      children: [
        { id: "box", tag: "div", children: [{ id: "in-1", tag: "p", text: "1" }, { id: "in-2", tag: "p", text: "2" }] },
        { id: "p", tag: "p", text: "P" },
      ],
    });
    render(<MultiDeleteConfirmDialog />);
  });
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  const request = (ids: string[]) =>
    act(() => {
      store().setSelection(ids);
      store().requestDeleteSelection();
    });

  it("is closed until a multi-delete is requested", () => {
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("names the count and the nested elements, focuses Cancel, and says it can be undone", () => {
    request(["box", "p"]);
    const dialog = screen.getByRole("dialog", { name: MULTI_DELETE_COPY.title });
    expect(dialog).toHaveTextContent("You are about to delete 2 selected elements. This will also remove 2 nested elements inside them.");
    expect(dialog).toHaveTextContent(MULTI_DELETE_COPY.undoable);
    expect(screen.getByRole("button", { name: MULTI_DELETE_COPY.cancel })).toHaveFocus();
  });

  it("Cancel and Escape delete nothing", () => {
    request(["box", "p"]);
    fireEvent.click(screen.getByRole("button", { name: MULTI_DELETE_COPY.cancel }));
    expect(store().pendingDeletion).toBeNull();
    expect(store().document.children).toHaveLength(2);
    request(["box", "p"]);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(store().pendingDeletion).toBeNull();
    expect(store().document.children).toHaveLength(2);
    expect(store().past).toHaveLength(0);
  });

  it("Delete elements deletes them once, as one Undo step", () => {
    request(["box", "p"]);
    const confirm = screen.getByRole("button", { name: MULTI_DELETE_COPY.confirm });
    fireEvent.click(confirm);
    expect(store().document.children).toEqual([]);
    expect(store().past).toHaveLength(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("wording: no nested line when nothing is nested; singular nested element", () => {
    expect(describePendingDeletion(3, 0)).toBe("You are about to delete 3 selected elements.");
    expect(describePendingDeletion(2, 1)).toBe("You are about to delete 2 selected elements. This will also remove 1 nested element inside them.");
  });

  describe("multi-cut (BC-10.5)", () => {
    const requestCut = (ids: string[]) =>
      act(() => {
        store().setSelection(ids);
        store().cutSelection();
      });

    it("the same dialog, worded for a cut; Cancel leaves the document and clipboard alone", () => {
      requestCut(["box", "p"]);
      const dialog = screen.getByRole("dialog", { name: MULTI_CUT_COPY.title });
      expect(dialog).toHaveTextContent("You are about to cut 2 selected elements. This will also remove 2 nested elements.");
      expect(dialog).toHaveTextContent(MULTI_CUT_COPY.undoable);
      expect(screen.getByRole("button", { name: MULTI_CUT_COPY.cancel })).toHaveFocus();
      fireEvent.click(screen.getByRole("button", { name: MULTI_CUT_COPY.cancel }));
      expect(store().document.children).toHaveLength(2);
      expect(store().clipboard).toBeNull();
    });

    it("Cut elements removes them once, as one Undo step, and puts them on the clipboard", () => {
      requestCut(["box", "in-1", "p"]);
      fireEvent.click(screen.getByRole("button", { name: MULTI_CUT_COPY.confirm }));
      expect(store().document.children).toEqual([]);
      expect(store().clipboard?.nodes.map((node) => node.id)).toEqual(["box", "p"]);
      expect(store().past).toHaveLength(1);
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("wording without nested elements", () => {
      expect(describePendingCut(4, 0)).toBe("You are about to cut 4 selected elements.");
      expect(describePendingCut(2, 1)).toBe("You are about to cut 2 selected elements. This will also remove 1 nested element.");
    });
  });
});
