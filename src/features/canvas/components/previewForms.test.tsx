import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { CanvasInteractionBoundary } from "./CanvasInteractionBoundary";

/*
 * BC-02.4 — B1 (form controls inert in Preview) and B8 (Preview drag moved
 * free-layout elements), through the real Canvas and the real store.
 */

const initialState = useEditorStore.getState();

const tree: EditorElementNode = {
  id: "page-root",
  tag: "page",
  children: [
    {
      id: "form-1",
      tag: "form",
      children: [
        { id: "label-1", tag: "label", children: [{ id: "label-text", tag: "p", text: "Subscribe" }, { id: "check", tag: "input", inputType: "checkbox" }] },
        { id: "text", tag: "input", inputType: "text", value: "Ada" },
        { id: "tel", tag: "input", inputType: "tel", value: "123" },
        { id: "area", tag: "textarea", value: "Hello" },
        { id: "r-1", tag: "input", inputType: "radio", name: "plan", checked: true },
        { id: "r-2", tag: "input", inputType: "radio", name: "plan" },
        { id: "sel", tag: "select", children: [{ id: "o-1", tag: "option", text: "A", value: "a" }, { id: "o-2", tag: "option", text: "B", value: "b", selected: true }] },
      ],
    },
    { id: "free", tag: "div", layoutMode: "free", children: [{ id: "free-p", tag: "p", text: "Free", freeLayout: { x: 10, y: 10, width: 100, height: 20 } }] },
  ],
};

function Workspace() {
  const document = useEditorStore((state) => state.document);
  return <CanvasInteractionBoundary document={document} />;
}

function get<T extends Element>(nodeId: string): T {
  const element = document.querySelector<T>(`[data-node-id="${nodeId}"]`);
  if (!element) throw new Error(`no element ${nodeId}`);
  return element;
}

const preview = () => act(() => useEditorStore.getState().enterPreview());
const design = () => act(() => useEditorStore.getState().exitPreview());

function dispatchCancelable(element: Element, type: string, init: MouseEventInit = {}) {
  return element.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, ...init }));
}

describe("Preview forms (BC-02.4)", () => {
  beforeEach(() => {
    useEditorStore.getState().replaceDocument(tree);
  });

  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("Design keeps its guards: read-only fields, prevented mousedown/click, prevented label activation", () => {
    render(<Workspace />);
    expect(get<HTMLInputElement>("text").readOnly).toBe(true);
    expect(get<HTMLTextAreaElement>("area").readOnly).toBe(true);
    expect(dispatchCancelable(get("text"), "mousedown")).toBe(false);
    expect(dispatchCancelable(get("check"), "click")).toBe(false);
    expect(dispatchCancelable(get("sel"), "mousedown")).toBe(false);
    expect(dispatchCancelable(get("label-1"), "click")).toBe(false);
  });

  it("Preview drops every Design guard, so the browser's own behavior applies", () => {
    render(<Workspace />);
    preview();
    expect(get<HTMLInputElement>("text").readOnly).toBe(false);
    expect(get<HTMLTextAreaElement>("area").readOnly).toBe(false);
    expect(dispatchCancelable(get("text"), "mousedown")).toBe(true);
    expect(dispatchCancelable(get("sel"), "mousedown")).toBe(true);
    expect(dispatchCancelable(get("sel"), "click")).toBe(true);
    expect(dispatchCancelable(get("label-1"), "click", { detail: 1 })).toBe(true);
  });

  it("a checkbox and a radio really toggle in Preview (and not in Design)", () => {
    render(<Workspace />);
    fireEvent.click(get("check"));
    expect(get<HTMLInputElement>("check").checked).toBe(false);
    preview();
    fireEvent.click(get("check"));
    expect(get<HTMLInputElement>("check").checked).toBe(true);
    fireEvent.click(get("r-2"));
    expect(get<HTMLInputElement>("r-2").checked).toBe(true);
    expect(get<HTMLInputElement>("r-1").checked).toBe(false);
  });

  it("the Design-time tel filter does not run in Preview (a browser accepts any character)", () => {
    render(<Workspace />);
    preview();
    const tel = get<HTMLInputElement>("tel");
    tel.value = "123abc";
    fireEvent.input(tel);
    expect(tel.value).toBe("123abc");
  });

  it("runtime values never reach the document, the history or the saved state, and reset on every Preview entry and exit", () => {
    render(<Workspace />);
    const before = useEditorStore.getState();
    for (let session = 0; session < 2; session++) {
      preview();
      expect(get<HTMLInputElement>("text").value).toBe("Ada");
      expect(get<HTMLTextAreaElement>("area").value).toBe("Hello");
      expect(get<HTMLInputElement>("check").checked).toBe(false);
      expect(get<HTMLInputElement>("r-1").checked).toBe(true);
      expect(get<HTMLSelectElement>("sel").value).toBe("b");

      fireEvent.change(get("text"), { target: { value: "Changed" } });
      fireEvent.blur(get("text"));
      fireEvent.change(get("area"), { target: { value: "Changed" } });
      fireEvent.keyDown(get("area"), { key: "Enter" });
      fireEvent.blur(get("area"));
      fireEvent.click(get("check"));
      fireEvent.click(get("r-2"));
      fireEvent.change(get("sel"), { target: { value: "a" } });
      expect(get<HTMLInputElement>("text").value).toBe("Changed");

      design();
      expect(get<HTMLInputElement>("text").value).toBe("Ada");
      expect(get<HTMLTextAreaElement>("area").value).toBe("Hello");
      expect(get<HTMLInputElement>("check").checked).toBe(false);
      expect(get<HTMLInputElement>("r-1").checked).toBe(true);
      expect(get<HTMLInputElement>("r-2").checked).toBe(false);
      expect(get<HTMLSelectElement>("sel").value).toBe("b");
    }
    const after = useEditorStore.getState();
    expect(after.document).toBe(before.document);
    expect(after.persistedDocument).toBe(before.persistedDocument);
    expect(after.past).toBe(before.past);
    expect(after.future).toBe(before.future);
  });

  it("a double-click in Preview never starts a Design editing session", () => {
    render(<Workspace />);
    preview();
    fireEvent.doubleClick(get("text"));
    fireEvent.change(get("text"), { target: { value: "typed" } });
    fireEvent.keyDown(get("text"), { key: "Enter" });
    fireEvent.blur(get("text"));
    expect(useEditorStore.getState().past).toEqual([]);
  });

  it("form submission is prevented in both modes, so the editor never reloads or navigates", () => {
    render(<Workspace />);
    const submit = () => get("form-1").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(submit()).toBe(false);
    preview();
    expect(submit()).toBe(false);
  });

  it("Design editing still works after a Preview session: double-click, type, Enter commits one undo step", () => {
    render(<Workspace />);
    preview();
    design();
    const text = get<HTMLInputElement>("text");
    fireEvent.doubleClick(text);
    expect(get<HTMLInputElement>("text").readOnly).toBe(false);
    fireEvent.change(get("text"), { target: { value: "Grace" } });
    fireEvent.keyDown(get("text"), { key: "Enter" });
    expect(useEditorStore.getState().past).toHaveLength(1);
  });

  it("Escape inside a Preview field keeps Preview open; Escape elsewhere exits", () => {
    render(<Workspace />);
    preview();
    fireEvent.keyDown(get("text"), { key: "Escape" });
    fireEvent.keyDown(get("sel"), { key: "Escape" });
    fireEvent.keyDown(get("area"), { key: "Escape" });
    expect(useEditorStore.getState().editorMode).toBe("preview");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(useEditorStore.getState().editorMode).toBe("design");
  });

  it("B8: no drag listener exists in Preview, so a pointer drag on a free-layout element cannot move it", () => {
    render(<Workspace />);
    preview();
    const paragraph = get("free-p");
    fireEvent.pointerDown(paragraph, { pointerId: 1, button: 0, clientX: 15, clientY: 15 });
    fireEvent.pointerMove(paragraph, { pointerId: 1, clientX: 150, clientY: 150 });
    fireEvent.pointerUp(paragraph, { pointerId: 1, clientX: 150, clientY: 150 });
    design();
    expect(useEditorStore.getState().document).toBe(tree);
    expect(useEditorStore.getState().past).toEqual([]);
  });
});
