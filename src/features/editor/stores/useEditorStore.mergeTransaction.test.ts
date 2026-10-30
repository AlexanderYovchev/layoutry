import { beforeEach, describe, expect, it } from "vitest";
import { selectHasUnsavedChanges, useEditorStore } from "@/features/editor/stores/useEditorStore";
import { findNodeById } from "@/features/editor/utils/findNodeById";

/**
 * BC-01.3 — beginTransaction({ mergeHistory: true }): one-shot setters
 * called inside it fold into the transaction, so a live Inspector edit is
 * one undo entry (or none, if nothing changed in the end).
 */

const initialState = useEditorStore.getState();
const store = () => useEditorStore.getState();
const heading = () => findNodeById(store().document, "heading-1");
const fontSize = () => heading()?.typography?.fontSize?.value;

function setFontSize(value: number) {
  store().setElementTypography("heading-1", { ...heading()?.typography, fontSize: { value, unit: "px" } });
}

/** The owning edit's own write (how the Inspector edit session writes). */
function ownWrite(write: () => void) {
  store().mergeTransactionWrite(write);
}

beforeEach(() => {
  useEditorStore.setState(initialState, true);
  useEditorStore.setState({ persistedDocument: store().document });
});

describe("merging transaction", () => {
  it("folds any number of one-shot writes into exactly one history entry", () => {
    store().beginTransaction({ mergeHistory: true });
    ownWrite(() => setFontSize(2));
    ownWrite(() => setFontSize(24));
    ownWrite(() => setFontSize(32));
    expect(store().past).toHaveLength(0);
    store().commitTransaction();

    expect(fontSize()).toBe(32);
    expect(store().past).toHaveLength(1);
    expect(store().transactionSnapshot).toBeNull();
    expect(store().historyMergeSnapshot).toBeNull();

    store().undo();
    expect(heading()?.typography).toBeUndefined();
    store().redo();
    expect(fontSize()).toBe(32);
  });

  it("records nothing, and restores the exact pre-transaction document, when the net change is nothing", () => {
    const documentBefore = store().document;
    store().beginTransaction({ mergeHistory: true });
    ownWrite(() => store().setElementTypography("heading-1", { fontSize: { value: 40, unit: "px" } }));
    ownWrite(() => store().setElementTypography("heading-1", undefined));
    store().commitTransaction();

    expect(store().past).toHaveLength(0);
    expect(store().document).toBe(documentBefore);
    expect(selectHasUnsavedChanges(store())).toBe(false);
  });

  it("keeps the redo stack when a merging transaction is cancelled", () => {
    setFontSize(20);
    store().undo();
    expect(store().future).toHaveLength(1);

    store().beginTransaction({ mergeHistory: true });
    ownWrite(() => setFontSize(30));
    const snapshot = store().transactionSnapshot;
    if (snapshot) useEditorStore.setState({ document: snapshot.document });
    store().cancelTransaction();

    expect(store().future).toHaveLength(1);
    expect(store().past).toHaveLength(0);
  });

  it("a plain (non-merging) transaction keeps its existing semantics: one-shot writes inside it still record their own entries", () => {
    store().beginTransaction();
    setFontSize(10);
    store().commitTransaction();

    expect(store().past).toHaveLength(2);
  });

  it("never joins an already-open transaction: beginTransaction while one is open is a no-op, even with mergeHistory", () => {
    store().beginTransaction();
    const gestureSnapshot = store().transactionSnapshot;
    store().beginTransaction({ mergeHistory: true });

    expect(store().transactionSnapshot).toBe(gestureSnapshot);
    expect(store().historyMergeSnapshot).toBeNull();
    setFontSize(10);
    expect(store().past).toHaveLength(1);
  });

  it("merging ends with the transaction however it is cleared: resize commit, Preview and loading a project", () => {
    for (const end of [
      () => store().commitResizeTransaction(),
      () => store().cancelResizeTransaction(),
      () => store().enterPreview(),
      () => store().replaceDocument(initialState.document),
    ]) {
      useEditorStore.setState(initialState, true);
      store().beginTransaction({ mergeHistory: true });
      end();
      expect(store().historyMergeSnapshot).toBeNull();
      store().exitPreview();
      const pastBefore = store().past.length;
      setFontSize(12);
      expect(store().past).toHaveLength(pastBefore + 1);
    }
  });

  it("a mutation that is not the edit's own write closes the edit first: two separate undo steps, transaction ended (BC-01.6, D1)", () => {
    store().beginTransaction({ mergeHistory: true });
    ownWrite(() => setFontSize(30));
    store().setElementTypography("paragraph-1", { color: "#123456" });

    expect(store().transactionSnapshot).toBeNull();
    expect(store().historyMergeSnapshot).toBeNull();
    expect(store().past).toHaveLength(2);
    store().undo();
    expect(findNodeById(store().document, "paragraph-1")?.typography).toBeUndefined();
    expect(fontSize()).toBe(30);
    store().undo();
    expect(heading()?.typography).toBeUndefined();
  });

  it("an outside mutation during an edit that changed nothing records only itself", () => {
    store().beginTransaction({ mergeHistory: true });
    store().setElementTypography("paragraph-1", { color: "#123456" });

    expect(store().past).toHaveLength(1);
    expect(store().transactionSnapshot).toBeNull();
  });

  it("the depth guard is released even if the write throws", () => {
    store().beginTransaction({ mergeHistory: true });
    expect(() => ownWrite(() => {
      throw new Error("boom");
    })).toThrow("boom");
    store().setElementTypography("paragraph-1", { color: "#123456" });
    expect(store().transactionSnapshot).toBeNull();
  });
});
