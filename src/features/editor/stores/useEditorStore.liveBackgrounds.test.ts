import { afterEach, describe, expect, it } from "vitest";
import {
  selectActiveLiveGesture,
  selectHasUnsavedChanges,
  useEditorStore,
} from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { findNodeById } from "@/features/editor/utils/findNodeById";

/*
 * BC-17.3.1 QA-2 — restoreLiveBackgrounds: the exact rollback of a live
 * background gesture (a gradient-stop drag abandoned with Escape or a
 * cancelled pointer).
 */

const initialState = useEditorStore.getState();
const store = () => useEditorStore.getState();
afterEach(() => useEditorStore.setState(initialState, true));

const gradient = (position: number) => ({
  sourceType: "gradient" as const,
  gradient: {
    type: "linear" as const,
    angle: 90,
    stops: [
      { id: "s1", color: "#000000", position: 0 },
      { id: "s2", color: "#ffffff", position },
    ],
  },
});

function load(): EditorElementNode {
  const document: EditorElementNode = {
    id: "page-root",
    tag: "page",
    children: [
      { id: "a", tag: "div", background: gradient(100) },
      { id: "b", tag: "div", background: gradient(100) },
      { id: "c", tag: "p", text: "untouched" },
    ],
  };
  store().replaceDocument(document);
  return store().document;
}

describe("restoreLiveBackgrounds (BC-17.3.1)", () => {
  it("rolls every live-written node back to the very same document object: nothing reads as unsaved, no history entry", () => {
    const loaded = load();
    const past = store().past.length;
    store().beginTransaction();
    for (const position of [80, 60, 40]) {
      store().setElementBackgroundLive("a", gradient(position));
      store().setElementBackgroundLive("b", gradient(position));
    }
    expect(selectActiveLiveGesture(store())?.slices).toEqual({
      a: "background-image",
      b: "background-image",
    });
    expect(selectHasUnsavedChanges(store())).toBe(true);

    store().restoreLiveBackgrounds();
    store().cancelTransaction();

    expect(store().document).toBe(loaded);
    expect(selectHasUnsavedChanges(store())).toBe(false);
    expect(store().past).toHaveLength(past);
    expect(selectActiveLiveGesture(store())).toBeNull();
    expect(store().liveGesture).toBeNull();
  });

  it("keeps Redo: an abandoned drag after an Undo leaves the redo entry intact", () => {
    load();
    store().setElementBackground("a", gradient(50));
    store().undo();
    const future = store().future.length;
    expect(future).toBeGreaterThan(0);
    store().beginTransaction();
    store().setElementBackgroundLive("a", gradient(20));
    store().restoreLiveBackgrounds();
    store().cancelTransaction();
    expect(store().future).toHaveLength(future);
    store().redo();
    expect(findNodeById(store().document, "a")?.background).toEqual(
      gradient(50),
    );
  });

  it("restores only the background: another node's edit made during the gesture is kept", () => {
    load();
    store().beginTransaction();
    store().setElementBackgroundLive("a", gradient(30));
    store().setElementText("c", "edited meanwhile");
    store().restoreLiveBackgrounds();
    store().cancelTransaction();
    expect(findNodeById(store().document, "a")?.background).toEqual(
      gradient(100),
    );
    expect(findNodeById(store().document, "c")?.text).toBe("edited meanwhile");
  });

  it("does nothing outside a live gesture", () => {
    const loaded = load();
    store().restoreLiveBackgrounds();
    expect(store().document).toBe(loaded);
  });
});
