import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElementNode } from "@/features/editor/factories/elementFactories";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { createProjectCommands } from "@/features/project/commands/projectCommands";
import { createProjectWorkflow } from "@/features/project/commands/projectWorkflow";
import { createIndexedDbProjectRepository } from "@/features/project/storage/indexedDbProjectRepository";
import {
  ProjectStorageError,
  type ProjectRepository,
} from "@/features/project/storage/projectRepository";
import { useProjectDialogStore } from "@/features/project/stores/useProjectDialogStore";
import { useProjectStore } from "@/features/project/stores/useProjectStore";
import { pageWith } from "@/features/project/utils/projectTestDocuments";
import {
  createProjectMetadata,
  serializeProject,
} from "@/features/project/utils/serializeProject";

const initialEditor = useEditorStore.getState();
const initialProject = useProjectStore.getState();
const initialDialogs = useProjectDialogStore.getState();
const editor = () => useEditorStore.getState();
const session = () => useProjectStore.getState();
const ui = () => useProjectDialogStore.getState();

function setup(overrides: Partial<ProjectRepository> = {}) {
  const factory = new IDBFactory();
  const base = createIndexedDbProjectRepository({ getFactory: () => factory });
  const commands = createProjectCommands({
    repository: { ...base, ...overrides },
    saveFile: vi.fn(),
  });
  return { base, workflow: createProjectWorkflow(commands) };
}

function edit() {
  editor().insertElement("page-root", createElementNode("paragraph"));
}

const fileProject = {
  metadata: createProjectMetadata({ id: "file-1", name: "From file" }),
  document: pageWith({ id: "heading-f", tag: "h1", text: "File" }),
};
const fileBlob = () => new Blob([serializeProject(fileProject)]);

beforeEach(() => {
  useEditorStore.setState(initialEditor, true);
  useProjectStore.setState(initialProject, true);
  useProjectDialogStore.setState(initialDialogs, true);
});

describe("unsaved-changes protection", () => {
  it("switches immediately when there is nothing to lose", async () => {
    const { workflow } = setup();
    expect(await workflow.newProject()).toBe(true);
    expect(ui().dialog).toBeNull();
  });

  it.each([
    ["an edited document", () => edit()],
    ["a renamed project", () => session().renameProject("Renamed")],
  ])(
    "asks before replacing %s, and Cancel keeps everything",
    async (_label, makeUnsaved) => {
      const { workflow } = setup();
      makeUnsaved();
      const before = {
        document: editor().document,
        metadata: session().metadata,
      };

      expect(await workflow.newProject()).toBe(false);

      expect(ui().dialog).toEqual({
        kind: "discard",
        pending: { kind: "new" },
      });
      ui().closeDialogOfKind("discard");
      expect(editor().document).toBe(before.document);
      expect(session().metadata).toBe(before.metadata);
    },
  );

  it("Don't Save discards and continues", async () => {
    const { workflow } = setup();
    edit();
    await workflow.newProject();

    expect(await workflow.resolveDiscard("discard")).toBe(true);
    expect(editor().document.children).toEqual([]);
    expect(ui().dialog).toBeNull();
  });

  it("Save saves first, then continues", async () => {
    const { workflow, base } = setup();
    edit();
    const editedId = session().metadata.id;
    await workflow.newProject();

    expect(await workflow.resolveDiscard("save")).toBe(true);
    expect(await base.find(editedId)).not.toBeNull();
    expect(session().metadata.id).not.toBe(editedId);
  });

  it("stops if saving first fails, keeping the unsaved project", async () => {
    const { workflow } = setup({
      write: () =>
        Promise.reject(new ProjectStorageError("quota-exceeded", "Full.")),
    });
    edit();
    const document = editor().document;
    await workflow.newProject();

    expect(await workflow.resolveDiscard("save")).toBe(false);
    expect(editor().document).toBe(document);
    expect(ui().dialog).toMatchObject({
      kind: "error",
      error: { title: "Not enough storage space" },
    });
  });

  it("ignores selection, Preview and other transient changes", async () => {
    const { workflow } = setup();
    editor().selectElement("heading-1");
    editor().enterPreview();
    editor().setSnapEnabled(false);
    expect(workflow.hasUnsavedChanges()).toBe(false);
  });
});

describe("Save", () => {
  it("asks for a name the first time, then saves in place without asking", async () => {
    const { workflow, base } = setup();
    expect(await workflow.save()).toBe(false);
    expect(ui().dialog).toEqual({ kind: "name", purpose: "first-save" });

    expect(await workflow.submitName("first-save", "Landing")).toBe(true);
    expect(session().metadata.name).toBe("Landing");
    expect(await base.list()).toHaveLength(1);

    edit();
    expect(await workflow.save()).toBe(true);
    expect(ui().dialog).toBeNull();
  });

  it("reports a failed save in an error dialog", async () => {
    const { workflow } = setup({
      write: () => Promise.reject(new ProjectStorageError("failed", "Broken.")),
    });
    await workflow.submitName("first-save", "Landing");
    expect(ui().dialog).toEqual({
      kind: "error",
      error: { title: "Project storage failed", message: "Broken." },
    });
  });

  it("renames without saving", async () => {
    const { workflow, base } = setup();
    workflow.rename();
    expect(ui().dialog).toEqual({ kind: "name", purpose: "rename" });
    await workflow.submitName("rename", "New name");
    expect(session().metadata.name).toBe("New name");
    expect(await base.list()).toEqual([]);
    expect(workflow.hasUnsavedChanges()).toBe(true);
  });
});

describe("Open", () => {
  it("closes the library once the project is open, and shows failures", async () => {
    const { workflow } = setup();
    workflow.showLibrary();
    expect(ui().libraryOpen).toBe(true);

    expect(await workflow.openProject("missing")).toBe(false);
    expect(ui().libraryOpen).toBe(true);
    expect(ui().dialog).toMatchObject({
      kind: "error",
      error: { title: "Project not found" },
    });
  });
});

describe("Import", () => {
  it("rejects an invalid file with a meaningful message and changes nothing", async () => {
    const { workflow } = setup();
    const document = editor().document;

    expect(
      await workflow.importFile(
        new Blob(['{"format":"layoutry-project","formatVersion":7}']),
      ),
    ).toBe(false);

    expect(ui().dialog).toMatchObject({
      kind: "error",
      error: {
        title: "This file can't be imported",
        message: expect.stringMatching(/newer version of Layoutry/),
      },
    });
    expect(editor().document).toBe(document);
  });

  it("imports a new project directly", async () => {
    const { workflow } = setup();
    expect(await workflow.importFile(fileBlob())).toBe(true);
    expect(session().metadata).toEqual(fileProject.metadata);
  });

  it("asks how to resolve an id that is already in the library", async () => {
    const { workflow, base } = setup();
    await workflow.importFile(fileBlob());
    await workflow.newProject();

    expect(await workflow.importFile(fileBlob())).toBe(false);
    expect(ui().dialog).toMatchObject({
      kind: "import-collision",
      existing: { id: "file-1" },
    });

    expect(await workflow.resolveImportCollision("copy")).toBe(true);
    expect(session().metadata.id).not.toBe("file-1");
    expect(await base.list()).toHaveLength(2);
  });

  it("asks about unsaved changes before an import replaces the project", async () => {
    const { workflow } = setup();
    edit();
    expect(await workflow.importFile(fileBlob())).toBe(false);
    expect(ui().dialog).toMatchObject({
      kind: "discard",
      pending: { kind: "import", mode: "keep-id" },
    });
  });
});

describe("Delete", () => {
  it("confirms before deleting", async () => {
    const { workflow, base } = setup();
    await workflow.submitName("first-save", "Doomed");
    const { id } = session().metadata;

    workflow.requestDelete(id, "Doomed");
    expect(ui().dialog).toEqual({ kind: "delete", id, name: "Doomed" });
    expect(await base.find(id)).not.toBeNull();

    expect(await workflow.confirmDelete()).toBe(true);
    expect(await base.find(id)).toBeNull();
    expect(session().toast?.message).toBe("Deleted “Doomed”");
  });
});

describe("switching projects while a save is in flight (PROJECT-1.5)", () => {
  it("the save completes with exactly what was saved; the switch waits for it and nothing is mixed up", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const factory = new IDBFactory();
    const base = createIndexedDbProjectRepository({
      getFactory: () => factory,
    });
    const commands = createProjectCommands({
      repository: {
        ...base,
        write: async (project, expectation) => {
          await gate;
          return base.write(project, expectation);
        },
      },
      saveFile: vi.fn(),
    });
    const workflow = createProjectWorkflow(commands);

    edit();
    const savedDocument = editor().document;
    const saving = workflow.submitName("first-save", "Saved first");
    // The user edits more, then asks for a new project while it writes.
    edit();
    expect(await workflow.newProject()).toBe(false);
    expect(ui().dialog).toMatchObject({ kind: "discard" });
    const switching = workflow.resolveDiscard("discard");
    release();
    expect(await saving).toBe(true);
    expect(await switching).toBe(true);

    // The library holds the saved snapshot — not the later edit.
    const [entry] = await base.list();
    if (entry?.status !== "ok") throw new Error("not saved");
    const stored = await base.read(entry.summary.id);
    expect(stored.text).toBe(
      serializeProject({
        metadata: { ...entry.summary },
        document: savedDocument,
      }),
    );
    // The new project is active, clean and unrelated to the saved one.
    expect(session().metadata.id).not.toBe(entry.summary.id);
    expect(session().location).toEqual({ kind: "unsaved" });
    expect(editor().document.children?.length ?? 0).toBeLessThan(
      savedDocument.children?.length ?? 0,
    );
  });
});
