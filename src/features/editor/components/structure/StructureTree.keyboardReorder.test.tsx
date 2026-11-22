import { DndContext } from "@dnd-kit/core";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { StructureTree } from "./StructureTree";

/** BC-12.2 (D11) — Alt+Arrow keyboard reorder in the Structure panel, plus plain Left/Right. */

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

const rowOf = (name: string): HTMLElement => {
  const row = screen.getByText(name).closest<HTMLElement>("[role=treeitem]");
  if (!row) throw new Error(`no row for ${name}`);
  return row;
};
const press = (name: string, key: string, modifiers: { altKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; metaKey?: boolean } = {}) => {
  const row = rowOf(name);
  act(() => row.focus());
  fireEvent.keyDown(row, { key, ...modifiers });
};
const alt = (name: string, key: string) => press(name, key, { altKey: true });
const childIds = (id: string) => (findNodeById(store().document, id)?.children ?? []).map((child) => child.id);
const announcement = () => document.querySelector("[data-structure-move-announcement]")?.textContent?.replace(/ /g, "") ?? "";

describe("Structure keyboard reorder (BC-12.2)", () => {
  beforeEach(() => {
    useEditorStore.setState(initialState, true);
    store().replaceDocument(tree);
    render(<StructureTree />, { wrapper: DndContext });
  });
  afterEach(() => useEditorStore.setState(initialState, true));

  it("Alt+ArrowDown moves the row after its next sibling, keeps it selected and focused, and announces the new position", () => {
    alt("Para A", "ArrowDown");
    expect(childIds("s1")).toEqual(["b", "a"]);
    expect(store().selection.ids).toEqual(["a"]);
    expect(document.activeElement).toBe(rowOf("Para A"));
    expect(announcement()).toBe("Moved Para A after Para B, position 2 of 2 in First section.");
  });

  it("Alt+ArrowUp moves the row before its previous sibling; one Undo step reverts it", () => {
    alt("Para B", "ArrowUp");
    expect(childIds("s1")).toEqual(["b", "a"]);
    expect(announcement()).toBe("Moved Para B to the start of First section, position 1 of 2.");
    expect(store().past).toHaveLength(1);
    act(() => store().undo());
    expect(childIds("s1")).toEqual(["a", "b"]);
  });

  it("Alt+ArrowRight moves the row into the previous sibling, expanding it when collapsed", () => {
    fireEvent.click(screen.getByRole("button", { name: "Collapse First section" }));
    expect(rowOf("First section").getAttribute("aria-expanded")).toBe("false");
    alt("Second section", "ArrowRight");
    expect(childIds("s1")).toEqual(["a", "b", "s2"]);
    expect(rowOf("First section").getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(rowOf("Second section"));
    expect(rowOf("Second section").getAttribute("aria-level")).toBe("3");
    expect(announcement()).toBe("Moved Second section after Para B, position 3 of 3 in First section.");
  });

  it("Alt+ArrowLeft moves the row out of its parent, right after it", () => {
    alt("Para A", "ArrowLeft");
    expect(childIds("page-root")).toEqual(["h", "s1", "a", "s2", "z"]);
    expect(document.activeElement).toBe(rowOf("Para A"));
    expect(rowOf("Para A").getAttribute("aria-level")).toBe("2");
  });

  it("a refused move changes nothing and announces why", () => {
    const before = store().document;
    alt("First section", "ArrowRight"); // into the Heading before it
    expect(store().document).toBe(before);
    expect(store().past).toHaveLength(0);
    expect(announcement()).toBe("First section wasn't moved: that place can't contain this kind of element.");
    expect(store().editorNotice?.message).toBe(announcement());
  });

  it("an unavailable move (first, last, top level) changes nothing and says so", () => {
    const before = store().document;
    alt("Title", "ArrowUp");
    expect(announcement()).toMatch(/^Title is already first in /);
    alt("Para Z", "ArrowDown");
    expect(announcement()).toMatch(/^Para Z is already last in /);
    alt("Title", "ArrowLeft");
    expect(announcement()).toBe("Title is already at the top level.");
    alt("Para A", "ArrowRight");
    expect(announcement()).toBe("There is no element before Para A to move it into.");
    expect(store().document).toBe(before);
    expect(store().past).toHaveLength(0);
  });

  it("only the focused row moves, even with a multi-selection", () => {
    fireEvent.click(rowOf("Para A"));
    fireEvent.click(rowOf("Para Z"), { ctrlKey: true });
    expect(store().selection.ids).toEqual(["a", "z"]);
    alt("Para A", "ArrowDown");
    expect(childIds("s1")).toEqual(["b", "a"]);
    expect(childIds("page-root").at(-1)).toBe("z");
    expect(store().selection.ids).toEqual(["a"]);
  });

  it("only Alt alone reorders: Ctrl+Alt, Alt+Shift and Alt+Meta do nothing", () => {
    const before = store().document;
    press("Para A", "ArrowDown", { altKey: true, ctrlKey: true });
    press("Para A", "ArrowDown", { altKey: true, shiftKey: true });
    press("Para A", "ArrowDown", { altKey: true, metaKey: true });
    expect(store().document).toBe(before);
    expect(store().selection.ids).toEqual([]);
  });

  it("plain arrows still navigate without moving anything; Left/Right collapse, expand and step into children", () => {
    const before = store().document;
    press("Para A", "ArrowDown");
    expect(document.activeElement).toBe(rowOf("Para B"));
    press("First section", "ArrowLeft");
    expect(rowOf("First section").getAttribute("aria-expanded")).toBe("false");
    press("First section", "ArrowRight");
    expect(rowOf("First section").getAttribute("aria-expanded")).toBe("true");
    press("First section", "ArrowRight");
    expect(document.activeElement).toBe(rowOf("Para A"));
    press("Para A", "ArrowLeft");
    expect(document.activeElement).toBe(rowOf("First section"));
    expect(store().document).toBe(before);
  });

  it("Alt+Arrow outside the tree (e.g. an Inspector field) never reorders", () => {
    const input = document.createElement("input");
    document.body.append(input);
    const before = store().document;
    fireEvent.keyDown(input, { key: "ArrowDown", altKey: true });
    expect(store().document).toBe(before);
    input.remove();
  });
});
