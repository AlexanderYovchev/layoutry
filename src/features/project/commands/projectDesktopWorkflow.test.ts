import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElementNode } from "@/features/editor/factories/elementFactories";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { createProjectCommands } from "@/features/project/commands/projectCommands";
import { createProjectWorkflow } from "@/features/project/commands/projectWorkflow";
import { createFakeDesktopProjectFiles } from "@/features/project/desktop/fakeDesktopProjectFiles";
import { createIndexedDbProjectRepository } from "@/features/project/storage/indexedDbProjectRepository";
import { useProjectDialogStore } from "@/features/project/stores/useProjectDialogStore";
import { useProjectStore } from "@/features/project/stores/useProjectStore";
import { pageWith } from "@/features/project/utils/projectTestDocuments";
import {
  createProjectMetadata,
  serializeProject,
} from "@/features/project/utils/serializeProject";

/** PROJECT-1.3 desktop flows: routing, conflicts, external opens and closing. */

const initialEditor = useEditorStore.getState();
const initialProject = useProjectStore.getState();
const initialDialogs = useProjectDialogStore.getState();
const editor = () => useEditorStore.getState();
const session = () => useProjectStore.getState();
const ui = () => useProjectDialogStore.getState();

function setup() {
  const desktop = createFakeDesktopProjectFiles();
  const factory = new IDBFactory();
  const repository = createIndexedDbProjectRepository({
    getFactory: () => factory,
  });
  const commands = createProjectCommands({
    repository,
    saveFile: vi.fn(),
    desktop: desktop.bridge,
  });
  return {
    desktop,
    repository,
    commands,
    workflow: createProjectWorkflow(commands, desktop.bridge),
  };
}

function edit() {
  editor().insertElement("page-root", createElementNode("paragraph"));
}

const otherFile = {
  metadata: createProjectMetadata({ id: "other-1", name: "Other" }),
  document: pageWith({ id: "heading-o", tag: "h1", text: "Other" }),
};

beforeEach(() => {
  useEditorStore.setState(initialEditor, true);
  useProjectStore.setState(initialProject, true);
  useProjectDialogStore.setState(initialDialogs, true);
});

describe("Save routing in the desktop app", () => {
  it("saves a new project to a file chosen in the native dialog, without the name prompt", async () => {
    const { desktop, workflow } = setup();
    desktop.script.saveAs = "Site.layoutry";
    expect(await workflow.save()).toBe(true);
    expect(ui().dialog).toBeNull();
    expect(desktop.disk.has("Site.layoutry")).toBe(true);
  });

  it("keeps saving a library project to the library", async () => {
    const { desktop, repository, workflow, commands } = setup();
    const library = {
      metadata: createProjectMetadata({ id: "lib-1", name: "Library" }),
      document: pageWith(),
    };
    await repository.write(
      { metadata: library.metadata, text: serializeProject(library) },
      { kind: "new" },
    );
    await commands.open("lib-1");
    edit();

    expect(await workflow.save()).toBe(true);
    expect(desktop.disk.size).toBe(0);
    expect(session().location.kind).toBe("library");
  });

  it("Save As always goes to a file", async () => {
    const { desktop, workflow } = setup();
    desktop.script.saveAs = "Copy.layoutry";
    expect(await workflow.saveAs()).toBe(true);
    expect(desktop.disk.has("Copy.layoutry")).toBe(true);
  });

  it("shows the conflict dialog, and Overwrite replaces the external change", async () => {
    const { desktop, workflow } = setup();
    desktop.script.saveAs = "Site.layoutry";
    await workflow.save();
    desktop.disk.set("Site.layoutry", "external");
    edit();

    expect(await workflow.save()).toBe(false);
    expect(ui().dialog).toEqual({
      kind: "file-conflict",
      conflict: { reason: "modified", fileName: "Site.layoutry" },
    });
    expect(desktop.disk.get("Site.layoutry")).toBe("external");

    expect(await workflow.resolveFileConflict("overwrite")).toBe(true);
    expect(desktop.disk.get("Site.layoutry")).not.toBe("external");
  });

  it("Save As from the conflict dialog keeps both versions", async () => {
    const { desktop, workflow } = setup();
    desktop.script.saveAs = "Site.layoutry";
    await workflow.save();
    desktop.disk.set("Site.layoutry", "external");
    edit();
    await workflow.save();

    desktop.script.saveAs = "Site (mine).layoutry";
    expect(await workflow.resolveFileConflict("save-as")).toBe(true);
    expect(desktop.disk.get("Site.layoutry")).toBe("external");
    expect(desktop.disk.has("Site (mine).layoutry")).toBe(true);
  });
});

describe("opening files", () => {
  it("validates before asking anything, and an invalid file changes nothing", async () => {
    const { desktop, workflow } = setup();
    edit();
    const document = editor().document;
    desktop.disk.set(
      "Broken.layoutry",
      '{"format":"layoutry-project","formatVersion":9}',
    );
    desktop.script.open = "Broken.layoutry";

    expect(await workflow.openFile()).toBe(false);
    expect(ui().dialog).toMatchObject({
      kind: "error",
      error: {
        title: "“Broken.layoutry” can't be opened",
        message: expect.stringMatching(/newer version/),
      },
    });
    expect(editor().document).toBe(document);
    expect(desktop.liveTokens()).toEqual([]);
  });

  it("asks before replacing unsaved work; Cancel releases the file and keeps everything", async () => {
    const { desktop, workflow } = setup();
    edit();
    const document = editor().document;
    desktop.disk.set("Other.layoutry", serializeProject(otherFile));
    desktop.script.open = "Other.layoutry";

    expect(await workflow.openFile()).toBe(false);
    expect(ui().dialog).toMatchObject({
      kind: "discard",
      pending: { kind: "open-file" },
    });
    workflow.cancelDiscard();
    expect(editor().document).toBe(document);
    expect(desktop.liveTokens()).toEqual([]);
  });

  it("Don't Save opens the file", async () => {
    const { desktop, workflow } = setup();
    edit();
    desktop.disk.set("Other.layoutry", serializeProject(otherFile));
    desktop.script.open = "Other.layoutry";
    await workflow.openFile();

    expect(await workflow.resolveDiscard("discard")).toBe(true);
    expect(session().metadata).toEqual(otherFile.metadata);
  });

  it("a cancelled Open dialog does nothing", async () => {
    const { workflow } = setup();
    expect(await workflow.openFile()).toBe(false);
    expect(ui().dialog).toBeNull();
  });

  it("opens a file passed from Explorer or a second launch", async () => {
    const { desktop, workflow } = setup();
    desktop.disk.set("Other.layoutry", serializeProject(otherFile));
    desktop.script.pending.push("Other.layoutry");
    expect(await workflow.openPendingFile()).toBe(true);
    expect(session().location).toMatchObject({
      kind: "file",
      fileName: "Other.layoutry",
    });
    expect(await workflow.openPendingFile()).toBe(false);
  });
});

describe("closing the desktop window", () => {
  it("closes at once when everything is saved", async () => {
    const { desktop, workflow } = setup();
    await workflow.requestClose();
    expect(desktop.closeResponses).toEqual([true]);
    expect(ui().dialog).toBeNull();
  });

  it("asks when there is unsaved work; Cancel keeps the window open", async () => {
    const { desktop, workflow } = setup();
    edit();
    await workflow.requestClose();
    expect(ui().dialog).toEqual({
      kind: "discard",
      pending: { kind: "close" },
    });
    workflow.cancelDiscard();
    expect(desktop.closeResponses).toEqual([false]);
  });

  it("Don't Save closes without saving", async () => {
    const { desktop, workflow } = setup();
    edit();
    await workflow.requestClose();
    await workflow.resolveDiscard("discard");
    expect(desktop.closeResponses).toEqual([true]);
    expect(desktop.disk.size).toBe(0);
  });

  it("Save closes only after the save succeeded", async () => {
    const { desktop, workflow } = setup();
    edit();
    await workflow.requestClose();
    desktop.script.saveAs = "Site.layoutry";
    await workflow.resolveDiscard("save");
    expect(desktop.disk.has("Site.layoutry")).toBe(true);
    expect(desktop.closeResponses).toEqual([true]);
  });

  it.each([
    [
      "the Save dialog is cancelled",
      (d: ReturnType<typeof setup>["desktop"]) => (d.script.saveAs = null),
    ],
    [
      "the save fails",
      (d: ReturnType<typeof setup>["desktop"]) => {
        d.script.saveAs = "Site.layoutry";
        d.script.failWrite = "disk-full";
      },
    ],
  ])("stays open when %s", async (_label, arrange) => {
    const { desktop, workflow } = setup();
    edit();
    await workflow.requestClose();
    arrange(desktop);
    await workflow.resolveDiscard("save");
    expect(desktop.closeResponses).toEqual([false]);
  });

  it("waits for a save in flight before deciding", async () => {
    const { desktop, workflow } = setup();
    desktop.script.saveAs = "Site.layoutry";
    await workflow.save();
    edit();
    const release = desktop.holdWrites();
    const saving = workflow.save();
    const closing = workflow.requestClose();
    await Promise.resolve();
    expect(desktop.closeResponses).toEqual([]);
    release();
    await saving;
    await closing;
    expect(desktop.closeResponses).toEqual([true]);
  });

  it("a second close request while asking shows no second dialog", async () => {
    const { desktop, workflow } = setup();
    edit();
    await workflow.requestClose();
    await workflow.requestClose();
    expect(ui().dialog).toEqual({
      kind: "discard",
      pending: { kind: "close" },
    });
    expect(desktop.closeResponses).toEqual([]);
  });
});
