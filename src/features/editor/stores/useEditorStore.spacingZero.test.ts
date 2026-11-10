import { afterEach, describe, expect, it } from "vitest";
import {
  selectHasUnsavedChanges,
  useEditorStore,
} from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";

/*
 * BC-05.3 — an authored spacing 0 survives every document operation that
 * copies or restores nodes, and unset stays unset.
 */

const initialState = useEditorStore.getState();
const store = () => useEditorStore.getState();

function setup(children: EditorElementNode[]) {
  const document: EditorElementNode = { ...store().document, children };
  useEditorStore.setState({
    document,
    persistedDocument: document,
    past: [],
    future: [],
  });
}

const pageChildren = () => store().document.children ?? [];

afterEach(() => {
  useEditorStore.setState(initialState, true);
});

describe("authored spacing 0 through document operations (BC-05.3)", () => {
  const zeroButton: EditorElementNode = {
    id: "b",
    tag: "button",
    text: "Go",
    spacing: {
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      margin: { left: 0 },
    },
  };
  const unsetButton: EditorElementNode = {
    id: "u",
    tag: "button",
    text: "Default",
  };

  it.each([
    ["keeps the authored zeros", zeroButton],
    ["leaves unset spacing unset", unsetButton],
  ])("copy + paste %s", (_label, source) => {
    setup([source]);
    store().selectOnly(source.id);
    store().copySelection();
    store().pasteClipboard();
    const pasted = pageChildren().filter((node) => node.id !== source.id);
    expect(pasted).toHaveLength(1);
    expect(pasted[0].spacing).toEqual(source.spacing);
  });

  it("duplicate keeps the authored zeros", () => {
    setup([zeroButton]);
    store().selectOnly("b");
    store().duplicateSelection();
    const [original, copy] = pageChildren();
    expect(copy.id).not.toBe(original.id);
    expect(copy.spacing).toEqual(zeroButton.spacing);
  });

  it("authoring 0 on an unset box is an unsaved change, and Undo makes the document clean again", () => {
    setup([unsetButton]);
    store().setElementPadding("u", { left: 0 });
    expect(selectHasUnsavedChanges(store())).toBe(true);
    expect(pageChildren()[0].spacing).toEqual({ padding: { left: 0 } });
    store().undo();
    expect(selectHasUnsavedChanges(store())).toBe(false);
    expect(pageChildren()[0].spacing).toBeUndefined();
  });

  it("resetting margin leaves padding (and its authored zeros) untouched", () => {
    setup([zeroButton]);
    store().setElementMargin("b", undefined);
    expect(pageChildren()[0].spacing).toEqual({
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    expect(store().past).toHaveLength(1);
  });

  it("a multi-selection uniform write of 0 authors 0 on unset nodes as one history entry", () => {
    setup([zeroButton, unsetButton]);
    store().setElementsSpacingAllSides(["b", "u"], "padding", 0);
    expect(pageChildren()[1].spacing).toEqual({
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    expect(store().past).toHaveLength(1);
  });
});
