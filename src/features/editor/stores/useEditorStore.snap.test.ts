import { afterEach, describe, expect, it } from "vitest";
import { SNAP_PREFERENCE_KEY } from "@/features/editor/utils/snapPreference";
import { useEditorStore } from "./useEditorStore";

const initialState = useEditorStore.getState();

/**
 * Checkpoint 1.15.6.1.1 — Free-layout Snap's own store-level state.
 * The actual snapping ALGORITHM (resolveFreeMoveSnap) and its wiring into
 * a live drag (useFreeChildMoveSession) have their own dedicated test
 * files; this file only covers the plain store fields/actions
 * themselves — specifically the "Snap is editor state, not document
 * content" invariant (section 7 of this checkpoint's own brief).
 */
describe("useEditorStore — Snap state (Checkpoint 1.15.6.1.1)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("defaults snapEnabled to true", () => {
    expect(useEditorStore.getState().snapEnabled).toBe(true);
  });

  it("defaults activeSnapGuides to null", () => {
    expect(useEditorStore.getState().activeSnapGuides).toBeNull();
  });

  it("setSnapEnabled toggles the flag without touching the document or pushing history", () => {
    const documentBefore = useEditorStore.getState().document;
    const historyLengthBefore = useEditorStore.getState().past.length;

    useEditorStore.getState().setSnapEnabled(false);

    expect(useEditorStore.getState().snapEnabled).toBe(false);
    expect(useEditorStore.getState().document).toBe(documentBefore);
    expect(useEditorStore.getState().past.length).toBe(historyLengthBefore);

    useEditorStore.getState().setSnapEnabled(true);
    expect(useEditorStore.getState().snapEnabled).toBe(true);
  });

  it("setActiveSnapGuides sets and clears the ephemeral guide state without touching the document or history", () => {
    const documentBefore = useEditorStore.getState().document;
    const historyLengthBefore = useEditorStore.getState().past.length;

    const guides = {
      containerId: "free-1",
      vertical: { coordinate: 10, from: 0, to: 40, achieved: true },
      horizontal: { coordinate: 20, from: 0, to: 60, achieved: false },
      distances: [],
      spacing: [],
    };
    useEditorStore.getState().setActiveSnapGuides(guides);
    expect(useEditorStore.getState().activeSnapGuides).toEqual(guides);

    useEditorStore.getState().setActiveSnapGuides(null);
    expect(useEditorStore.getState().activeSnapGuides).toBeNull();

    expect(useEditorStore.getState().document).toBe(documentBefore);
    expect(useEditorStore.getState().past.length).toBe(historyLengthBefore);
  });

  it("BC-13.3 (D11): setSnapEnabled remembers the choice globally (localStorage), outside the document and history", () => {
    window.localStorage.removeItem(SNAP_PREFERENCE_KEY);
    useEditorStore.getState().setSnapEnabled(false);
    expect(window.localStorage.getItem(SNAP_PREFERENCE_KEY)).toBe("false");
    useEditorStore.getState().setSnapEnabled(true);
    expect(window.localStorage.getItem(SNAP_PREFERENCE_KEY)).toBe("true");
    window.localStorage.removeItem(SNAP_PREFERENCE_KEY);
  });
});
