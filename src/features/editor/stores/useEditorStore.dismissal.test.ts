import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "./useEditorStore";

const initialState = useEditorStore.getState();

/**
 * Checkpoint 1.15.6.8.3 — the store-level primitive `dismissRuntimeTarget`
 * that both outside-click and Escape dismissal call. Kept deliberately
 * separate from the CanvasInteractionBoundary integration tests (which
 * prove the DOM/event-driven behavior), so this file only proves the
 * store action's own contract in isolation.
 */
describe("dismissRuntimeTarget (Checkpoint 1.15.6.8.3)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("sets the target's runtimeVisibility to false", () => {
    useEditorStore.setState({ runtimeVisibility: { "target-1": true } });

    useEditorStore.getState().dismissRuntimeTarget("target-1");

    expect(useEditorStore.getState().runtimeVisibility["target-1"]).toBe(false);
  });

  it("is a safe no-op (same object reference) when the target is already hidden", () => {
    useEditorStore.setState({ runtimeVisibility: { "target-1": false } });
    const before = useEditorStore.getState().runtimeVisibility;

    useEditorStore.getState().dismissRuntimeTarget("target-1");

    expect(useEditorStore.getState().runtimeVisibility).toBe(before);
  });

  it("is safe for a target with no existing runtimeVisibility entry at all", () => {
    expect(() => useEditorStore.getState().dismissRuntimeTarget("never-opened")).not.toThrow();
    expect(useEditorStore.getState().runtimeVisibility["never-opened"]).toBe(false);
  });

  it("creates zero document history", () => {
    useEditorStore.setState({ runtimeVisibility: { "target-1": true } });
    const historyBefore = useEditorStore.getState().past.length;

    useEditorStore.getState().dismissRuntimeTarget("target-1");

    expect(useEditorStore.getState().past.length).toBe(historyBefore);
  });

  it("never touches the document — only the runtimeVisibility slice", () => {
    useEditorStore.setState({ runtimeVisibility: { "target-1": true } });
    const documentBefore = useEditorStore.getState().document;

    useEditorStore.getState().dismissRuntimeTarget("target-1");

    expect(useEditorStore.getState().document).toBe(documentBefore);
  });

  it("leaves other targets' runtime visibility untouched", () => {
    useEditorStore.setState({ runtimeVisibility: { "target-1": true, "target-2": true } });

    useEditorStore.getState().dismissRuntimeTarget("target-1");

    expect(useEditorStore.getState().runtimeVisibility["target-2"]).toBe(true);
  });
});
