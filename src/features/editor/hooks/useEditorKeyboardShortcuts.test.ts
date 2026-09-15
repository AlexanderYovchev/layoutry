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

describe("useEditorKeyboardShortcuts — SVG Drawing Mode routing (Checkpoint 1.15.6)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  // The store's own module-level auto-exit subscription reverts
  // svgEditingNodeId the instant either selection.primaryId doesn't match
  // it OR that id has no backing document node — seed both, exactly like
  // enterSvgEditMode does, or Drawing Mode silently self-exits before the
  // key handler ever runs.
  function seedSvgEditingState(overrides: Partial<ReturnType<typeof useEditorStore.getState>> = {}) {
    useEditorStore.setState((state) => ({
      document: { ...state.document, children: [{ id: "svg1", tag: "svg" }] },
      selection: { ids: ["svg1"], primaryId: "svg1" },
      svgEditingNodeId: "svg1",
      ...overrides,
    }));
  }

  it("Delete inside Drawing Mode with vector objects selected removes them, not the outer SVG", () => {
    renderHook(() => useEditorKeyboardShortcuts());
    seedSvgEditingState({ selectedSvgObjectIds: ["r1", "r2"] });
    const removeSpy = vi.spyOn(useEditorStore.getState(), "removeSvgObjects");
    const deleteSpy = vi.spyOn(useEditorStore.getState(), "deleteSelection");

    pressKey("Delete");

    expect(removeSpy).toHaveBeenCalledWith("svg1", ["r1", "r2"]);
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it("Delete inside Drawing Mode with no vector selection falls through to the ordinary document delete", () => {
    renderHook(() => useEditorKeyboardShortcuts());
    seedSvgEditingState({ selectedSvgObjectIds: [] });
    const removeSpy = vi.spyOn(useEditorStore.getState(), "removeSvgObjects");
    const deleteSpy = vi.spyOn(useEditorStore.getState(), "deleteSelection");

    pressKey("Delete");

    expect(removeSpy).not.toHaveBeenCalled();
    expect(deleteSpy).toHaveBeenCalledOnce();
  });

  it("Delete outside Drawing Mode retains ordinary document delete behavior", () => {
    renderHook(() => useEditorKeyboardShortcuts());
    const deleteSpy = vi.spyOn(useEditorStore.getState(), "deleteSelection");

    pressKey("Backspace");

    expect(deleteSpy).toHaveBeenCalledOnce();
  });

  it("Escape priority 1: an unfinished draft is cancelled first, without clearing selection or exiting", () => {
    renderHook(() => useEditorKeyboardShortcuts());
    seedSvgEditingState({ svgDraft: { tool: "polygon", points: [{ x: 0, y: 0 }] }, selectedSvgObjectIds: ["r1"] });
    const cancelSpy = vi.spyOn(useEditorStore.getState(), "cancelSvgDraft");
    const clearSpy = vi.spyOn(useEditorStore.getState(), "clearSvgObjectSelection");
    const exitSpy = vi.spyOn(useEditorStore.getState(), "exitSvgEditMode");

    pressKey("Escape");

    expect(cancelSpy).toHaveBeenCalledOnce();
    expect(clearSpy).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("Escape priority 2: with no draft but a vector selection, clears the selection instead of exiting", () => {
    renderHook(() => useEditorKeyboardShortcuts());
    seedSvgEditingState({ svgDraft: null, selectedSvgObjectIds: ["r1"] });
    const clearSpy = vi.spyOn(useEditorStore.getState(), "clearSvgObjectSelection");
    const exitSpy = vi.spyOn(useEditorStore.getState(), "exitSvgEditMode");

    pressKey("Escape");

    expect(clearSpy).toHaveBeenCalledOnce();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("Escape priority 3: with no draft and no vector selection, exits Drawing Mode", () => {
    renderHook(() => useEditorKeyboardShortcuts());
    seedSvgEditingState({ svgDraft: null, selectedSvgObjectIds: [] });
    const exitSpy = vi.spyOn(useEditorStore.getState(), "exitSvgEditMode");

    pressKey("Escape");

    expect(exitSpy).toHaveBeenCalledOnce();
  });

  it("Escape does nothing SVG-specific outside Drawing Mode (svgEditingNodeId unset)", () => {
    renderHook(() => useEditorKeyboardShortcuts());
    const exitSpy = vi.spyOn(useEditorStore.getState(), "exitSvgEditMode");
    const clearSpy = vi.spyOn(useEditorStore.getState(), "clearSvgObjectSelection");

    pressKey("Escape");

    expect(exitSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });

  it("Escape defers to the active drag session (transactionSnapshot set) instead of exiting Drawing Mode out from under it", () => {
    renderHook(() => useEditorKeyboardShortcuts());
    seedSvgEditingState({ svgDraft: null, selectedSvgObjectIds: ["r1"] });
    const { document, selection } = useEditorStore.getState();
    useEditorStore.setState({ transactionSnapshot: { document, selection } });
    const clearSpy = vi.spyOn(useEditorStore.getState(), "clearSvgObjectSelection");
    const exitSpy = vi.spyOn(useEditorStore.getState(), "exitSvgEditMode");

    pressKey("Escape");

    expect(clearSpy).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("Escape while editing stops propagation so the outer document selection is not also cleared", () => {
    renderHook(() => useEditorKeyboardShortcuts());
    seedSvgEditingState({ svgDraft: null, selectedSvgObjectIds: [] });
    const clearOuterSelection = vi.fn();
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") clearOuterSelection();
    });

    fireEvent.keyDown(window, { key: "Escape" });

    // Our own capture-phase handler halts the event before any later
    // bubble-phase listener (the stand-in for CanvasInteractionBoundary's
    // own Escape-clears-selection handler) ever runs.
    expect(clearOuterSelection).not.toHaveBeenCalled();
  });
});
