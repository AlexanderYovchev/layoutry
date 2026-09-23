import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { DialogElement } from "./DialogElement";

const initialState = useEditorStore.getState();

/**
 * jsdom does not implement HTMLDialogElement.showModal()/close() at all
 * (confirmed directly during this checkpoint's own investigation — both
 * are `undefined` on a jsdom-created <dialog>), so this test suite mocks
 * just enough of the native behavior to exercise THIS component's own
 * call sequencing/idempotency/event-wiring logic — it does NOT, and
 * cannot, prove real top-layer/backdrop/focus/Escape-default-action
 * browser behavior. That proof is Checkpoint 1.15.6.9's own mandatory
 * real-Chromium Playwright QA, not this file (see this checkpoint's own
 * report, section AF).
 */
const originalShowModal = HTMLDialogElement.prototype.showModal;
const originalClose = HTMLDialogElement.prototype.close;

function installDialogMocks() {
  const showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  const close = vi.fn(function (this: HTMLDialogElement) {
    const wasOpen = this.hasAttribute("open");
    this.removeAttribute("open");
    if (wasOpen) this.dispatchEvent(new Event("close"));
  });
  HTMLDialogElement.prototype.showModal = showModal;
  HTMLDialogElement.prototype.close = close;
  return { showModal, close };
}

describe("DialogElement (Checkpoint 1.15.6.9)", () => {
  let mocks: ReturnType<typeof installDialogMocks>;

  beforeEach(() => {
    mocks = installDialogMocks();
  });

  afterEach(() => {
    HTMLDialogElement.prototype.showModal = originalShowModal;
    HTMLDialogElement.prototype.close = originalClose;
    useEditorStore.setState(initialState, true);
  });

  it("renders a genuine <dialog>, not a div standing in for one", () => {
    const { container } = render(
      <DialogElement node={{ id: "dialog-1", tag: "dialog", children: [] }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );
    const dialog = container.querySelector("dialog");
    expect(dialog).not.toBeNull();
    expect(dialog).toHaveAttribute("data-node-id", "dialog-1");
    expect(dialog).toHaveAttribute("data-node-type", "dialog");
  });

  it("Design: renders visible via the plain `open` attribute, never calls showModal", () => {
    useEditorStore.setState({ editorMode: "design" });
    const { container } = render(
      <DialogElement node={{ id: "dialog-1", tag: "dialog", children: [] }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block">
        <p>Content</p>
      </DialogElement>,
    );
    const dialog = container.querySelector("dialog");
    expect(dialog).toHaveAttribute("open");
    expect(mocks.showModal).not.toHaveBeenCalled();
  });

  it("Preview: calls showModal() on mount (mount is the 'should be open' signal)", () => {
    useEditorStore.setState({ editorMode: "preview" });
    render(<DialogElement node={{ id: "dialog-1", tag: "dialog", children: [] }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    expect(mocks.showModal).toHaveBeenCalledTimes(1);
  });

  it("is idempotent: re-rendering while still in Preview never calls showModal a second time", () => {
    useEditorStore.setState({ editorMode: "preview" });
    const { rerender } = render(
      <DialogElement node={{ id: "dialog-1", tag: "dialog", children: [] }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );
    rerender(<DialogElement node={{ id: "dialog-1", tag: "dialog", children: [] }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    expect(mocks.showModal).toHaveBeenCalledTimes(1);
  });

  it("unmount safety: unmounting while modally open calls close() exactly once", () => {
    useEditorStore.setState({ editorMode: "preview" });
    const { unmount } = render(
      <DialogElement node={{ id: "dialog-1", tag: "dialog", children: [] }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );
    unmount();
    expect(mocks.close).toHaveBeenCalledTimes(1);
  });

  it("transitioning from Preview (open) to Design closes the native modal state, then restores it as a plain visible box", () => {
    useEditorStore.setState({ editorMode: "preview" });
    const { rerender, container } = render(
      <DialogElement node={{ id: "dialog-1", tag: "dialog", children: [] }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );
    expect(container.querySelector("dialog")).toHaveAttribute("open");

    useEditorStore.setState({ editorMode: "design" });
    rerender(<DialogElement node={{ id: "dialog-1", tag: "dialog", children: [] }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />);

    expect(mocks.close).toHaveBeenCalledTimes(1);
    // Still visible afterward — Design always shows Dialog regardless of
    // runtime state (Part 6/7 of this checkpoint's own brief).
    expect(container.querySelector("dialog")).toHaveAttribute("open");
  });

  it("backdrop click (target === the dialog itself) closes it in Preview", () => {
    useEditorStore.setState({ editorMode: "preview" });
    const { container } = render(
      <DialogElement node={{ id: "dialog-1", tag: "dialog", children: [] }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block">
        <p>Content</p>
      </DialogElement>,
    );
    const dialog = container.querySelector("dialog")!;
    fireEvent.click(dialog);
    expect(mocks.close).toHaveBeenCalledTimes(1);
  });

  it("a click on real content (a descendant) never closes the dialog", () => {
    useEditorStore.setState({ editorMode: "preview" });
    const { getByText } = render(
      <DialogElement node={{ id: "dialog-1", tag: "dialog", children: [] }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block">
        <p>Content</p>
      </DialogElement>,
    );
    fireEvent.click(getByText("Content"));
    expect(mocks.close).not.toHaveBeenCalled();
  });

  it("a click landing on the dialog's own box in Design never closes anything (no backdrop concept in Design)", () => {
    useEditorStore.setState({ editorMode: "design" });
    const { container } = render(
      <DialogElement node={{ id: "dialog-1", tag: "dialog", children: [] }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );
    fireEvent.click(container.querySelector("dialog")!);
    expect(mocks.close).not.toHaveBeenCalled();
  });

  it("native close (Escape/cancel/backdrop/explicit close()) syncs runtimeVisibility back to false via dismissRuntimeTarget", () => {
    useEditorStore.setState({ editorMode: "preview", runtimeVisibility: { "dialog-1": true } });
    const { container } = render(
      <DialogElement node={{ id: "dialog-1", tag: "dialog", children: [] }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );
    const dialog = container.querySelector("dialog")!;
    // .close() (the mock) removes the `open` attribute AND dispatches
    // `close` — matching real native semantics, and the staleness guard
    // handleNativeClose relies on (a bare dispatched event on a still-
    // `open` dialog is correctly treated as stale/superseded — see that
    // handler's own doc comment).
    dialog.close();
    expect(useEditorStore.getState().runtimeVisibility["dialog-1"]).toBe(false);
  });

  it("ignores a STALE close event that arrives after the dialog has already been reopened (the exact React 18 Strict Mode double-invoke race this checkpoint's own live QA found and fixed — see handleNativeClose's own doc comment)", () => {
    useEditorStore.setState({ editorMode: "preview", runtimeVisibility: { "dialog-1": true } });
    const { container } = render(
      <DialogElement node={{ id: "dialog-1", tag: "dialog", children: [] }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );
    const dialog = container.querySelector("dialog")!;
    // Simulates a `close` event that was queued by an earlier close()
    // call but only actually dispatched after the dialog was reopened in
    // the meantime (per spec, `close()` fires `close` via a queued
    // element task, not synchronously) — the dialog is genuinely open
    // again by the time this bare event arrives.
    dialog.setAttribute("open", "");
    dialog.dispatchEvent(new Event("close"));
    expect(useEditorStore.getState().runtimeVisibility["dialog-1"]).toBe(true);
  });

  it("native close never touches history", () => {
    useEditorStore.setState({ editorMode: "preview", runtimeVisibility: { "dialog-1": true } });
    const { container } = render(
      <DialogElement node={{ id: "dialog-1", tag: "dialog", children: [] }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );
    const pastLengthBefore = useEditorStore.getState().past.length;
    container.querySelector("dialog")!.close();
    expect(useEditorStore.getState().past.length).toBe(pastLengthBefore);
  });

  it("Escape stops propagation while modally open in Preview, so it never reaches an ancestor's own keydown listener", () => {
    useEditorStore.setState({ editorMode: "preview" });
    const ancestorHandler = vi.fn();
    const { container } = render(
      <div onKeyDown={ancestorHandler}>
        <DialogElement node={{ id: "dialog-1", tag: "dialog", children: [] }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />
      </div>,
    );
    fireEvent.keyDown(container.querySelector("dialog")!, { key: "Escape" });
    expect(ancestorHandler).not.toHaveBeenCalled();
  });

  it("Escape does NOT stop propagation in Design — Design's own Escape (clearSelection) must still reach ancestors", () => {
    useEditorStore.setState({ editorMode: "design" });
    const ancestorHandler = vi.fn();
    const { container } = render(
      <div onKeyDown={ancestorHandler}>
        <DialogElement node={{ id: "dialog-1", tag: "dialog", children: [] }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />
      </div>,
    );
    fireEvent.keyDown(container.querySelector("dialog")!, { key: "Escape" });
    expect(ancestorHandler).toHaveBeenCalledTimes(1);
  });

  it("Escape never calls preventDefault — the browser's own default close-on-Escape action must still run", () => {
    useEditorStore.setState({ editorMode: "preview" });
    const { container } = render(
      <DialogElement node={{ id: "dialog-1", tag: "dialog", children: [] }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );
    const event = fireEvent.keyDown(container.querySelector("dialog")!, { key: "Escape" });
    expect(event).toBe(true); // fireEvent returns false only when preventDefault was called
  });

  it("Checkpoint 1.15.6.9.1: gets aria-label/aria-description derived from its own heading/paragraph descendants", () => {
    const node: EditorElementNode = {
      id: "dialog-1",
      tag: "dialog",
      children: [
        {
          id: "content",
          tag: "div",
          children: [
            { id: "h", tag: "h2", text: "Modal Title" },
            { id: "p", tag: "p", text: "Modal content goes here." },
          ],
        },
      ],
    };
    const { container } = render(<DialogElement node={node} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    const dialog = container.querySelector("dialog")!;
    expect(dialog).toHaveAttribute("aria-label", "Modal Title");
    expect(dialog).toHaveAttribute("aria-description", "Modal content goes here.");
  });

  it("Checkpoint 1.15.6.9.1: a bare Dialog with no heading/paragraph descendant gets neither attribute — no invented title", () => {
    const { container } = render(
      <DialogElement node={{ id: "dialog-1", tag: "dialog", children: [] }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );
    const dialog = container.querySelector("dialog")!;
    expect(dialog).not.toHaveAttribute("aria-label");
    expect(dialog).not.toHaveAttribute("aria-description");
  });
});
