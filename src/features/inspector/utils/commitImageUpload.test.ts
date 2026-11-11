import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createButtonNode, createImageNode } from "@/features/editor/factories/elementFactories";
import { registerDocumentSaveLimitGuard } from "@/features/editor/rules/documentSaveLimitGuard";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { documentFitsProjectFile } from "@/features/project/rules/projectSaveLimit";
import { commitImageUpload, IMAGE_COMMIT_MESSAGES } from "./commitImageUpload";

const initialState = useEditorStore.getState();
const store = () => useEditorStore.getState();
const PREFIX = "data:image/png;base64,";
/** About 6.7 Mi characters: the base64 of a 5 MB file. */
const FIVE_MB_BASE64 = Math.ceil((5 * 1024 * 1024) / 3) * 4;
const dataUrl = (fill: string, length = 64) => PREFIX + fill.repeat(length);
const src = (id: string) => findNodeById(store().document, id)?.src;

let unregister: () => void;
let imageId: string;
let target: { nodeId: string; documentSessionId: number };

beforeEach(() => {
  unregister = registerDocumentSaveLimitGuard(documentFitsProjectFile);
  const image = createImageNode();
  store().insertElement("page-root", image);
  imageId = image.id;
  store().markDocumentPersisted(store().document);
  target = { nodeId: imageId, documentSessionId: store().documentSessionId };
});

afterEach(() => {
  unregister();
  useEditorStore.setState(initialState, true);
});

function expectUnchanged(run: () => void) {
  const before = { document: store().document, past: store().past, future: store().future, persisted: store().persistedDocument };
  run();
  expect(store().document).toBe(before.document);
  expect(store().past).toBe(before.past);
  expect(store().future).toBe(before.future);
  expect(store().persistedDocument).toBe(before.persisted);
}

describe("commitImageUpload (BC-07.2)", () => {
  it("upload, replace and clear are one Undo step each; Undo and Redo restore each source", () => {
    const placeholder = src(imageId);
    const first = dataUrl("A");
    const second = dataUrl("B");
    const history = store().past.length;

    expect(commitImageUpload(target, first)).toEqual({ ok: true });
    expect(store().past.length).toBe(history + 1);
    expect(commitImageUpload(target, second)).toEqual({ ok: true });
    expect(store().past.length).toBe(history + 2);
    store().setElementSrc(imageId, undefined);
    expect(store().past.length).toBe(history + 3);

    store().undo();
    expect(src(imageId)).toBe(second);
    store().undo();
    expect(src(imageId)).toBe(first);
    store().undo();
    expect(src(imageId)).toBe(placeholder);
    store().redo();
    store().redo();
    expect(src(imageId)).toBe(second);
  });

  it("choosing the very same image again changes nothing and adds no history", () => {
    commitImageUpload(target, dataUrl("A"));
    expectUnchanged(() => expect(commitImageUpload(target, dataUrl("A"))).toEqual({ ok: true }));
  });

  it("only the intended Image changes: other content and authored styles stay as they were", () => {
    const other = createImageNode();
    store().insertElement("page-root", other);
    store().setElementBorderRadius(imageId, { topLeft: { value: 8, unit: "px" } });
    store().setElementFilters(imageId, { opacity: 50 });
    const before = findNodeById(store().document, imageId)!;
    commitImageUpload(target, dataUrl("A"));
    const after = findNodeById(store().document, imageId)!;
    expect({ ...after, src: undefined }).toEqual({ ...before, src: undefined });
    expect(src(other.id)).toBe(other.src);
  });

  describe("project-size preflight", () => {
    it("refuses an image that would make the project unsaveable, changing nothing", () => {
      expect(commitImageUpload(target, dataUrl("A", FIVE_MB_BASE64))).toEqual({ ok: true });
      const second = createImageNode();
      store().insertElement("page-root", second);
      expect(commitImageUpload({ ...target, nodeId: second.id }, dataUrl("B", FIVE_MB_BASE64))).toEqual({ ok: true });
      const third = createImageNode();
      store().insertElement("page-root", third);
      store().markDocumentPersisted(store().document);
      expectUnchanged(() =>
        expect(commitImageUpload({ ...target, nodeId: third.id }, dataUrl("C", FIVE_MB_BASE64))).toEqual({ ok: false, message: IMAGE_COMMIT_MESSAGES.projectTooLarge }),
      );
      expect(src(third.id)).toBe(third.src);
    });

    it("measures a replacement as a replacement: the old source no longer counts", () => {
      const big = 7_500_000;
      const second = createImageNode();
      store().insertElement("page-root", second);
      expect(commitImageUpload(target, dataUrl("A", big))).toEqual({ ok: true });
      expect(commitImageUpload({ ...target, nodeId: second.id }, dataUrl("B", big))).toEqual({ ok: true });
      // Current + new would be ~22.5 Mi characters; the real result is still ~15 Mi.
      expect(commitImageUpload(target, dataUrl("C", big))).toEqual({ ok: true });
      expect(src(imageId)).toBe(dataUrl("C", big));
    });
  });

  describe("project-size boundaries (BC-07.4)", () => {
    it("replacing a large image with a smaller one is always allowed, and the project shrinks", () => {
      const second = createImageNode();
      store().insertElement("page-root", second);
      expect(commitImageUpload(target, dataUrl("A", 7_800_000))).toEqual({ ok: true });
      expect(commitImageUpload({ ...target, nodeId: second.id }, dataUrl("B", 7_800_000))).toEqual({ ok: true });
      // Now near the limit: a bigger replacement no longer fits, a smaller one does.
      expect(commitImageUpload({ ...target, nodeId: second.id, startSrc: src(second.id) }, dataUrl("C", 9_500_000))).toEqual({ ok: false, message: IMAGE_COMMIT_MESSAGES.projectTooLarge });
      expect(commitImageUpload({ ...target, nodeId: second.id, startSrc: src(second.id) }, dataUrl("D", 1_000))).toEqual({ ok: true });
      expect(documentFitsProjectFile(store().document)).toBe(true);
    });

    it("near the limit, every state Undo and Redo can reach still saves", () => {
      const second = createImageNode();
      store().insertElement("page-root", second);
      commitImageUpload(target, dataUrl("A", 8_000_000));
      commitImageUpload({ ...target, nodeId: second.id }, dataUrl("B", 8_000_000));
      expect(commitImageUpload({ ...target, nodeId: second.id, startSrc: src(second.id) }, dataUrl("C", 9_000_000)).ok).toBe(false);
      const states = [store().document];
      while (store().past.length > 0) {
        store().undo();
        states.push(store().document);
      }
      while (store().future.length > 0) {
        store().redo();
        states.push(store().document);
      }
      expect(states.every((document) => documentFitsProjectFile(document))).toBe(true);
    });

    it("the project growing while a file was read is measured at commit: the late upload is refused", () => {
      const second = createImageNode();
      store().insertElement("page-root", second);
      const started = { ...target, startSrc: src(imageId) };
      // Meanwhile another upload filled the project.
      expect(commitImageUpload({ ...target, nodeId: second.id }, dataUrl("B", 12_000_000))).toEqual({ ok: true });
      expect(commitImageUpload(started, dataUrl("A", 6_000_000))).toEqual({ ok: false, message: IMAGE_COMMIT_MESSAGES.projectTooLarge });
      expect(documentFitsProjectFile(store().document)).toBe(true);
    });
  });

  describe("asynchronous lifecycle guards", () => {
    it("an upload started before another project was opened never lands in it", () => {
      const reopened = store().document;
      store().replaceDocument(reopened);
      expectUnchanged(() => expect(commitImageUpload(target, dataUrl("A"))).toEqual({ ok: false, message: IMAGE_COMMIT_MESSAGES.otherProject }));
    });

    it("an upload whose Image was deleted meanwhile is dropped", () => {
      store().selectElement(imageId);
      store().deleteSelection();
      expectUnchanged(() => expect(commitImageUpload(target, dataUrl("A"))).toEqual({ ok: false, message: IMAGE_COMMIT_MESSAGES.targetGone }));
    });

    it("an id that is not an Image (or nothing at all) is refused", () => {
      const button = createButtonNode();
      store().insertElement("page-root", button);
      expectUnchanged(() => expect(commitImageUpload({ ...target, nodeId: button.id }, dataUrl("A")).ok).toBe(false));
      expectUnchanged(() => expect(commitImageUpload({ ...target, nodeId: "missing" }, dataUrl("A")).ok).toBe(false));
    });

    it("BC-07.4: a source changed while it was reading (a typed URL, an Undo) is never overwritten by the late upload", () => {
      const startSrc = src(imageId);
      store().setElementSrc(imageId, "https://example.com/typed-meanwhile.png");
      const before = { document: store().document, past: store().past };
      expect(commitImageUpload({ ...target, startSrc }, dataUrl("A"))).toEqual({ ok: false, message: IMAGE_COMMIT_MESSAGES.sourceChanged });
      expect(store().document).toBe(before.document);
      expect(store().past).toBe(before.past);
      expect(src(imageId)).toBe("https://example.com/typed-meanwhile.png");
    });

    it("edits made while it was reading are kept: the commit applies to the latest document", () => {
      const button = createButtonNode();
      store().insertElement("page-root", button);
      expect(commitImageUpload(target, dataUrl("A"))).toEqual({ ok: true });
      expect(findNodeById(store().document, button.id)).toBeDefined();
    });

    it("selection doesn't redirect it: the intended Image changes even if another element is selected", () => {
      const other = createImageNode();
      store().insertElement("page-root", other);
      store().selectElement(other.id);
      commitImageUpload(target, dataUrl("A"));
      expect(src(imageId)).toBe(dataUrl("A"));
      expect(src(other.id)).toBe(other.src);
    });
  });
});
