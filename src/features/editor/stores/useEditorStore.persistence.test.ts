import { beforeEach, describe, expect, it } from "vitest";
import { createElementNode } from "@/features/editor/factories/elementFactories";
import {
  selectHasUnsavedChanges,
  useEditorStore,
} from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { selectionFromSingle } from "@/features/editor/types/selection";

const initialState = useEditorStore.getState();
const store = () => useEditorStore.getState();
const dirty = () => selectHasUnsavedChanges(store());

const loadedDocument: EditorElementNode = {
  id: "page-root",
  tag: "page",
  children: [{ id: "heading-loaded", tag: "h1", text: "Loaded project" }],
};

function makeEdit() {
  store().insertElement("page-root", createElementNode("paragraph"));
}

beforeEach(() => {
  useEditorStore.setState(initialState, true);
});

describe("replaceDocument — the atomic restoration contract", () => {
  it("swaps the document and resets every piece of session state that referred to the old one", () => {
    makeEdit();
    useEditorStore.setState({
      selection: selectionFromSingle("heading-1"),
      transactionSnapshot: {
        document: store().document,
        selection: store().selection,
      },
      editorNotice: { message: "notice", id: 1 },
      editorMode: "preview",
      runtimeVisibility: { "heading-1": false },
      svgEditingNodeId: "svg-1",
      selectedSvgObjectIds: ["rect-1"],
      primarySvgObjectId: "rect-1",
      activeSvgTool: "rect",
      activeSnapGuides: { containerId: "section-1", vertical: 10 },
    });
    expect(store().past.length).toBeGreaterThan(0);

    store().replaceDocument(loadedDocument);

    const state = store();
    expect(state.document).toBe(loadedDocument);
    expect(state.persistedDocument).toBe(loadedDocument);
    expect(state.selection).toEqual(initialState.selection);
    expect(state.past).toEqual([]);
    expect(state.future).toEqual([]);
    expect(state.transactionSnapshot).toBeNull();
    expect(state.editorNotice).toBeNull();
    expect(state.editorMode).toBe("design");
    expect(state.runtimeVisibility).toEqual({});
    expect(state.svgEditingNodeId).toBeNull();
    expect(state.selectedSvgObjectIds).toEqual([]);
    expect(state.primarySvgObjectId).toBeNull();
    expect(state.activeSvgTool).toBe("select");
    expect(state.svgDraft).toBeNull();
    expect(state.activeSnapGuides).toBeNull();
    expect(dirty()).toBe(false);
  });

  it("keeps app-level state: the clipboard and the Snap preference", () => {
    store().selectOnly("heading-1");
    store().copySelection();
    store().setSnapEnabled(false);
    const clipboard = store().clipboard;
    expect(clipboard).not.toBeNull();

    store().replaceDocument(loadedDocument);
    expect(store().clipboard).toBe(clipboard);
    expect(store().snapEnabled).toBe(false);
  });

  it("is one store update: subscribers never observe a half-applied load", () => {
    makeEdit();
    const observed: { documentIsNew: boolean; historyCleared: boolean }[] = [];
    const unsubscribe = useEditorStore.subscribe((state) =>
      observed.push({
        documentIsNew: state.document === loadedDocument,
        historyCleared: state.past.length === 0,
      }),
    );
    store().replaceDocument(loadedDocument);
    unsubscribe();
    expect(observed).toEqual([{ documentIsNew: true, historyCleared: true }]);
  });

  it("cannot undo back into the previous project", () => {
    makeEdit();
    store().replaceDocument(loadedDocument);
    store().undo();
    expect(store().document).toBe(loadedDocument);
  });

  it("decides every store field: each is either reset by replaceDocument or deliberately kept", () => {
    const reset = [
      "document",
      "persistedDocument",
      "selection",
      "past",
      "future",
      "transactionSnapshot",
      "historyMergeSnapshot",
      "editorNotice",
      "editorMode",
      "runtimeVisibility",
      "svgEditingNodeId",
      "selectedSvgObjectIds",
      "primarySvgObjectId",
      "activeSvgTool",
      "svgDraft",
      "activeSnapGuides",
    ];
    const kept = ["clipboard", "snapEnabled"];
    const dataFields = Object.entries(initialState)
      .filter(([, value]) => typeof value !== "function")
      .map(([key]) => key)
      .sort();
    // A new store field fails here until someone decides how loading a project treats it.
    expect(dataFields).toEqual([...reset, ...kept].sort());
  });
});

describe("unsaved-changes tracking (reference-based)", () => {
  it("starts clean, and only document edits make it dirty", () => {
    expect(dirty()).toBe(false);
    store().selectOnly("heading-1");
    store().enterPreview();
    store().exitPreview();
    store().setSnapEnabled(false);
    expect(dirty()).toBe(false);
    makeEdit();
    expect(dirty()).toBe(true);
  });

  it("edit → save → undo is dirty; → redo is clean again", () => {
    makeEdit();
    store().markDocumentPersisted(store().document);
    expect(dirty()).toBe(false);
    store().undo();
    expect(dirty()).toBe(true);
    store().redo();
    expect(dirty()).toBe(false);
  });

  it("load → edit is dirty; undoing back to the loaded document is clean", () => {
    store().replaceDocument(loadedDocument);
    makeEdit();
    expect(dirty()).toBe(true);
    store().undo();
    expect(dirty()).toBe(false);
  });

  it("an edit made while a save is in flight still counts as unsaved", () => {
    makeEdit();
    const serialized = store().document;
    makeEdit();
    store().markDocumentPersisted(serialized);
    expect(dirty()).toBe(true);
  });
});
