import { fireEvent, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { useEditorKeyboardShortcuts } from "./useEditorKeyboardShortcuts";

const initialState = useEditorStore.getState();

function pressKey(key: string, options: Partial<KeyboardEventInit> = {}) {
  fireEvent.keyDown(window, { key, ...options });
}

describe("useEditorKeyboardShortcuts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("Ctrl/Cmd+Z calls undo", () => {
    renderHook(() => useEditorKeyboardShortcuts());
    const spy = vi.spyOn(useEditorStore.getState(), "undo");

    pressKey("z", { ctrlKey: true });

    expect(spy).toHaveBeenCalledOnce();
  });

  it("Ctrl/Cmd+Shift+Z calls redo", () => {
    renderHook(() => useEditorKeyboardShortcuts());
    const spy = vi.spyOn(useEditorStore.getState(), "redo");

    pressKey("z", { ctrlKey: true, shiftKey: true });

    expect(spy).toHaveBeenCalledOnce();
  });

  it("Ctrl+Y calls redo (Windows convention)", () => {
    renderHook(() => useEditorKeyboardShortcuts());
    const spy = vi.spyOn(useEditorStore.getState(), "redo");

    pressKey("y", { ctrlKey: true });

    expect(spy).toHaveBeenCalledOnce();
  });

  it("Ctrl/Cmd+C calls copySelection", () => {
    renderHook(() => useEditorKeyboardShortcuts());
    const spy = vi.spyOn(useEditorStore.getState(), "copySelection");

    pressKey("c", { metaKey: true });

    expect(spy).toHaveBeenCalledOnce();
  });

  it("Ctrl/Cmd+X calls cutSelection", () => {
    renderHook(() => useEditorKeyboardShortcuts());
    const spy = vi.spyOn(useEditorStore.getState(), "cutSelection");

    pressKey("x", { ctrlKey: true });

    expect(spy).toHaveBeenCalledOnce();
  });

  it("Ctrl/Cmd+V calls pasteClipboard", () => {
    renderHook(() => useEditorKeyboardShortcuts());
    const spy = vi.spyOn(useEditorStore.getState(), "pasteClipboard");

    pressKey("v", { ctrlKey: true });

    expect(spy).toHaveBeenCalledOnce();
  });

  it("Ctrl/Cmd+D calls duplicateSelection", () => {
    renderHook(() => useEditorKeyboardShortcuts());
    const spy = vi.spyOn(useEditorStore.getState(), "duplicateSelection");

    pressKey("d", { ctrlKey: true });

    expect(spy).toHaveBeenCalledOnce();
  });

  it("Delete calls deleteSelection", () => {
    renderHook(() => useEditorKeyboardShortcuts());
    const spy = vi.spyOn(useEditorStore.getState(), "deleteSelection");

    pressKey("Delete");

    expect(spy).toHaveBeenCalledOnce();
  });

  it("Backspace calls deleteSelection", () => {
    renderHook(() => useEditorKeyboardShortcuts());
    const spy = vi.spyOn(useEditorStore.getState(), "deleteSelection");

    pressKey("Backspace");

    expect(spy).toHaveBeenCalledOnce();
  });

  it("does not trigger delete while typing in an input", () => {
    renderHook(() => useEditorKeyboardShortcuts());
    const spy = vi.spyOn(useEditorStore.getState(), "deleteSelection");
    const input = document.createElement("input");
    document.body.appendChild(input);

    fireEvent.keyDown(input, { key: "Backspace" });

    expect(spy).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it("does not trigger copy while typing in a textarea", () => {
    renderHook(() => useEditorKeyboardShortcuts());
    const spy = vi.spyOn(useEditorStore.getState(), "copySelection");
    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);

    fireEvent.keyDown(textarea, { key: "c", ctrlKey: true });

    expect(spy).not.toHaveBeenCalled();
    document.body.removeChild(textarea);
  });

  it("does not trigger shortcuts while typing in a contenteditable element", () => {
    renderHook(() => useEditorKeyboardShortcuts());
    const spy = vi.spyOn(useEditorStore.getState(), "deleteSelection");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    document.body.appendChild(editable);

    fireEvent.keyDown(editable, { key: "Backspace" });

    expect(spy).not.toHaveBeenCalled();
    document.body.removeChild(editable);
  });

  it("removes its listener on unmount", () => {
    const { unmount } = renderHook(() => useEditorKeyboardShortcuts());
    unmount();
    const spy = vi.spyOn(useEditorStore.getState(), "undo");

    pressKey("z", { ctrlKey: true });

    expect(spy).not.toHaveBeenCalled();
  });
});
