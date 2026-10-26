import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { createElementNode } from "@/features/editor/factories/elementFactories";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { useUnsavedChangesWarning } from "@/features/project/hooks/useUnsavedChangesWarning";
import { useProjectStore } from "@/features/project/stores/useProjectStore";

const initialEditor = useEditorStore.getState();
const initialProject = useProjectStore.getState();

function unloadIsBlocked(): boolean {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

beforeEach(() => {
  useEditorStore.setState(initialEditor, true);
  useProjectStore.setState(initialProject, true);
});

describe("useUnsavedChangesWarning", () => {
  it("lets a clean project close without a prompt", () => {
    renderHook(() => useUnsavedChangesWarning());
    expect(unloadIsBlocked()).toBe(false);
  });

  it("asks while the document has unsaved edits, and stops once saved", () => {
    renderHook(() => useUnsavedChangesWarning());
    act(() =>
      useEditorStore
        .getState()
        .insertElement("page-root", createElementNode("paragraph")),
    );
    expect(unloadIsBlocked()).toBe(true);

    act(() =>
      useEditorStore
        .getState()
        .markDocumentPersisted(useEditorStore.getState().document),
    );
    expect(unloadIsBlocked()).toBe(false);
  });

  it("asks after a rename", () => {
    renderHook(() => useUnsavedChangesWarning());
    act(() => useProjectStore.getState().renameProject("Renamed"));
    expect(unloadIsBlocked()).toBe(true);
  });

  it("asks while a save is still being written", () => {
    renderHook(() => useUnsavedChangesWarning());
    act(() => useProjectStore.getState().setOperation("save"));
    expect(unloadIsBlocked()).toBe(true);
  });

  it("ignores selection and Preview changes", () => {
    renderHook(() => useUnsavedChangesWarning());
    act(() => {
      useEditorStore.getState().selectElement("heading-1");
      useEditorStore.getState().enterPreview();
    });
    expect(unloadIsBlocked()).toBe(false);
  });

  it("removes its listener on unmount", () => {
    const hook = renderHook(() => useUnsavedChangesWarning());
    act(() => useProjectStore.getState().renameProject("Renamed"));
    hook.unmount();
    expect(unloadIsBlocked()).toBe(false);
  });
});
