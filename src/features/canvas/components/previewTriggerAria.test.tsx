import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { CanvasInteractionBoundary } from "./CanvasInteractionBoundary";

/* BC-02.5 — B6: trigger ARIA state in Preview, through the real Canvas and store. */

const initialState = useEditorStore.getState();

const tree: EditorElementNode = {
  id: "page-root",
  tag: "page",
  children: [
    { id: "menu-button", tag: "button", text: "Menu", interactions: [{ id: "i-1", trigger: "click", action: "toggle", targetId: "menu" }] },
    { id: "menu", tag: "div", initialPreviewVisibility: "hidden", children: [{ id: "item", tag: "p", text: "Item" }] },
    { id: "details-link", tag: "a", text: "Details", interactions: [{ id: "i-2", trigger: "click", action: "toggle", targetId: "details" }] },
    { id: "details", tag: "div", children: [{ id: "details-text", tag: "p", text: "Shown at first" }] },
    { id: "tab", tag: "button", text: "Tab", interactions: [{ id: "i-3", trigger: "click", action: "show", targetId: "details" }] },
    { id: "box-trigger", tag: "div", interactions: [{ id: "i-4", trigger: "click", action: "toggle", targetId: "details" }], children: [{ id: "box-text", tag: "p", text: "Box" }] },
    { id: "open-dialog", tag: "button", text: "Open", interactions: [{ id: "i-5", trigger: "click", action: "show", targetId: "dlg" }] },
    { id: "dlg", tag: "dialog", initialPreviewVisibility: "hidden", children: [{ id: "dlg-text", tag: "p", text: "Dialog" }] },
  ],
};

function Workspace() {
  const document = useEditorStore((state) => state.document);
  return (
    <main aria-label="Workspace">
      <CanvasInteractionBoundary document={document} />
    </main>
  );
}

const get = (nodeId: string) => {
  const element = document.querySelector(`[data-node-id="${nodeId}"]`);
  if (!element) throw new Error(`no ${nodeId}`);
  return element;
};

describe("Preview trigger ARIA (BC-02.5, B6)", () => {
  beforeEach(() => {
    useEditorStore.getState().replaceDocument(tree);
  });

  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("Design exposes no runtime state", () => {
    render(<Workspace />);
    expect(document.querySelectorAll("[aria-expanded]")).toHaveLength(0);
    expect(document.querySelectorAll("[aria-haspopup]")).toHaveLength(0);
  });

  it("initial state reflects initial visibility, and every toggle keeps it in sync", () => {
    render(<Workspace />);
    act(() => useEditorStore.getState().enterPreview());
    expect(get("menu-button").getAttribute("aria-expanded")).toBe("false");
    expect(get("details-link").getAttribute("aria-expanded")).toBe("true");
    for (const expected of ["true", "false", "true", "false"]) {
      fireEvent.click(get("menu-button"));
      expect(get("menu-button").getAttribute("aria-expanded")).toBe(expected);
    }
    fireEvent.click(get("details-link"));
    expect(get("details-link").getAttribute("aria-expanded")).toBe("false");
  });

  it("only toggling button/link triggers get aria-expanded; show-only and non-control triggers do not", () => {
    render(<Workspace />);
    act(() => useEditorStore.getState().enterPreview());
    expect(get("tab").hasAttribute("aria-expanded")).toBe(false);
    expect(get("box-trigger").hasAttribute("aria-expanded")).toBe(false);
  });

  it("a dialog opener announces a dialog", () => {
    render(<Workspace />);
    act(() => useEditorStore.getState().enterPreview());
    expect(get("open-dialog").getAttribute("aria-haspopup")).toBe("dialog");
    expect(get("open-dialog").hasAttribute("aria-expanded")).toBe(false);
  });

  it("a state change from elsewhere (Escape dismissal) is reflected too", () => {
    render(<Workspace />);
    act(() => useEditorStore.getState().enterPreview());
    fireEvent.click(get("menu-button"));
    expect(get("menu-button").getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(get("menu-button").getAttribute("aria-expanded")).toBe("false");
  });

  it("leaving Preview removes the state; re-entering starts from the authored state; the document is untouched", () => {
    render(<Workspace />);
    const before = useEditorStore.getState();
    act(() => useEditorStore.getState().enterPreview());
    fireEvent.click(get("menu-button"));
    act(() => useEditorStore.getState().exitPreview());
    expect(get("menu-button").hasAttribute("aria-expanded")).toBe(false);
    act(() => useEditorStore.getState().enterPreview());
    expect(get("menu-button").getAttribute("aria-expanded")).toBe("false");
    const after = useEditorStore.getState();
    expect(after.document).toBe(before.document);
    expect(after.past).toBe(before.past);
  });
});
