import { DndContext } from "@dnd-kit/core";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { StructureTree } from "./StructureTree";

/** BC-10.2 — Structure panel Shift+click ranges over visible rows, Ctrl/Cmd toggles, and the selected-count line. */

const initialState = useEditorStore.getState();
const store = () => useEditorStore.getState();

const tree: EditorElementNode = {
  id: "page-root",
  tag: "page",
  children: [
    { id: "h", tag: "h1", text: "Title", displayName: "Title" },
    {
      id: "s1",
      tag: "section",
      displayName: "First section",
      children: [
        { id: "a", tag: "p", text: "A", displayName: "Para A" },
        { id: "b", tag: "p", text: "B", displayName: "Para B" },
      ],
    },
    { id: "s2", tag: "section", displayName: "Second section", children: [{ id: "c", tag: "p", text: "C", displayName: "Para C" }] },
    { id: "z", tag: "p", text: "Z", displayName: "Para Z" },
  ],
};

const row = (name: string) => screen.getByText(name);
const click = (name: string, modifiers: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean } = {}) => fireEvent.click(row(name), modifiers);
const selected = () => store().selection.ids;
const countLine = () => document.querySelector("[data-structure-selection-count]");

describe("Structure range selection (BC-10.2)", () => {
  beforeEach(() => {
    useEditorStore.setState(initialState, true);
    store().replaceDocument(tree);
    render(<StructureTree />, { wrapper: DndContext });
  });
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("plain click selects one; Shift+click selects the visible range across containers, in row order", () => {
    click("Para A");
    expect(selected()).toEqual(["a"]);
    click("Para C", { shiftKey: true });
    expect(selected()).toEqual(["a", "b", "s2", "c"]);
    expect(store().selection.primaryId).toBe("c");
  });

  it("repeated Shift+clicks keep the anchor; a range upwards works too", () => {
    click("Para B");
    click("Para Z", { shiftKey: true });
    click("Title", { shiftKey: true });
    expect(selected()).toEqual(["h", "s1", "a", "b"]);
  });

  it("Ctrl+click and Cmd+click toggle; Ctrl/Cmd+Shift adds a range without removing the rest", () => {
    click("Title");
    click("Para Z", { ctrlKey: true });
    expect(selected()).toEqual(["h", "z"]);
    click("Title", { metaKey: true });
    expect(selected()).toEqual(["z"]);
    click("Para A", { ctrlKey: true });
    click("Para C", { ctrlKey: true, shiftKey: true });
    expect(selected()).toEqual(["z", "a", "b", "s2", "c"]);
  });

  it("a collapsed section's children are not selected by a range; parent and child may both be selected", () => {
    fireEvent.click(screen.getAllByRole("button", { name: /Collapse (First section|Section)/ })[0]);
    click("Title");
    click("Second section", { shiftKey: true });
    expect(selected()).toEqual(["h", "s1", "s2"]);
    expect(selected()).not.toContain("a");
    click("Para C", { ctrlKey: true });
    expect(selected()).toEqual(["h", "s1", "s2", "c"]);
  });

  it("the page root is never part of a range", () => {
    click("Title");
    click("Page", { shiftKey: true });
    expect(selected()).toEqual(["h", "page-root"]);
    click("Para A");
    click("Para Z", { shiftKey: true });
    expect(selected()).not.toContain("page-root");
  });

  it("an anchor removed from the selection falls back to the primary", () => {
    click("Para A");
    click("Para Z", { ctrlKey: true });
    click("Para A", { ctrlKey: true }); // the anchor (a) leaves the selection; primary is z
    click("Para C", { shiftKey: true });
    expect(selected()).toEqual(["c", "z"]);
  });

  it("shows 'N selected' for two or more, in a polite live region, and nothing for one", () => {
    click("Title");
    expect(countLine()).toHaveTextContent("");
    expect(countLine()).toHaveAttribute("aria-live", "polite");
    click("Para B", { shiftKey: true });
    expect(countLine()).toHaveTextContent("4 selected");
    act(() => store().clearSelection());
    expect(countLine()).toHaveTextContent("");
    expect(screen.getByRole("tree", { name: "Page structure" })).toHaveAttribute("aria-multiselectable", "true");
  });

  it("the count ignores ids of elements that no longer exist", () => {
    act(() => store().setSelection(["h", "z", "gone"], "z"));
    expect(countLine()).toHaveTextContent("2 selected");
  });
});
