import { beforeEach, describe, expect, it } from "vitest";
import { createElementNode } from "@/features/editor/factories/elementFactories";
import {
  selectHasUnsavedChanges,
  useEditorStore,
} from "@/features/editor/stores/useEditorStore";
import { parseProjectFile } from "@/features/project/utils/parseProjectFile";
import {
  kitchenSinkNode,
  pageWith,
} from "@/features/project/utils/projectTestDocuments";
import {
  createProjectMetadata,
  serializeProject,
} from "@/features/project/utils/serializeProject";

/**
 * The end-to-end restoration contract (PROJECT-1.1) as PROJECT-1.2/1.3 will
 * use it: parse first (pure), and only a successful result is applied, in
 * one atomic replaceDocument.
 */

const initialState = useEditorStore.getState();
const metadata = createProjectMetadata({
  id: "project-1",
  now: new Date("2026-10-26T00:00:00.000Z"),
});

function load(text: string): boolean {
  const result = parseProjectFile(text);
  if (!result.ok) return false;
  useEditorStore.getState().replaceDocument(result.project.document);
  return true;
}

beforeEach(() => {
  useEditorStore.setState(initialState, true);
});

describe("loading a project into the editor", () => {
  it("a valid file replaces the document exactly and starts a clean session", () => {
    const document = pageWith(kitchenSinkNode());
    expect(load(serializeProject({ metadata, document }))).toBe(true);
    const state = useEditorStore.getState();
    expect(state.document).toEqual(document);
    expect(state.past).toEqual([]);
    expect(selectHasUnsavedChanges(state)).toBe(false);
  });

  it.each([
    ["corrupt JSON", "{ broken"],
    [
      "a hostile file",
      serializeProject({ metadata, document: pageWith() }).replace(
        '"tag": "page"',
        '"tag": "page", "__proto__": {}',
      ),
    ],
    [
      "a newer format",
      serializeProject({ metadata, document: pageWith() }).replace(
        '"formatVersion": 1',
        '"formatVersion": 99',
      ),
    ],
  ])(
    "%s leaves the current document, history and selection untouched",
    (_label, text) => {
      useEditorStore
        .getState()
        .insertElement("page-root", createElementNode("paragraph"));
      useEditorStore.getState().selectOnly("heading-1");
      const before = useEditorStore.getState();

      expect(load(text)).toBe(false);
      expect(useEditorStore.getState()).toBe(before);
      expect(selectHasUnsavedChanges(useEditorStore.getState())).toBe(true);
    },
  );
});
