import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElementNode } from "@/features/editor/factories/elementFactories";
import {
  selectHasUnsavedChanges,
  useEditorStore,
} from "@/features/editor/stores/useEditorStore";
import { createProjectCommands } from "@/features/project/commands/projectCommands";
import { createIndexedDbProjectRepository } from "@/features/project/storage/indexedDbProjectRepository";
import {
  ProjectStorageError,
  type ProjectRepository,
} from "@/features/project/storage/projectRepository";
import {
  selectHasUnsavedProjectChanges,
  useProjectStore,
} from "@/features/project/stores/useProjectStore";
import type { LayoutryProject } from "@/features/project/types/projectFile";
import { parseProjectFile } from "@/features/project/utils/parseProjectFile";
import {
  kitchenSinkNode,
  pageWith,
} from "@/features/project/utils/projectTestDocuments";
import {
  createProjectMetadata,
  serializeProject,
} from "@/features/project/utils/serializeProject";

const initialEditor = useEditorStore.getState();
const initialProject = useProjectStore.getState();
const editor = () => useEditorStore.getState();
const session = () => useProjectStore.getState();
const unsaved = () => selectHasUnsavedProjectChanges(session(), editor());

let clock = Date.parse("2026-10-26T10:00:00.000Z");
const now = () => new Date((clock += 1000));

function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

/** The real IndexedDB adapter (fake-indexeddb), optionally with faults or a gate. */
function setup(overrides: Partial<ProjectRepository> = {}) {
  const base = createIndexedDbProjectRepository({ getFactory: () => factory });
  const repository: ProjectRepository = { ...base, ...overrides };
  const saveFile = vi.fn<(fileName: string, text: string) => void>();
  const commands = createProjectCommands({ repository, saveFile, now });
  return { base, repository, commands, saveFile };
}

let factory: IDBFactory;

function edit(text = "Edited") {
  editor().insertElement("page-root", {
    ...createElementNode("paragraph"),
    text,
  });
}

async function expectOk(result: Promise<{ ok: boolean }> | { ok: boolean }) {
  expect(await result).toEqual({ ok: true });
}

beforeEach(() => {
  factory = new IDBFactory();
  useEditorStore.setState(initialEditor, true);
  useProjectStore.setState(initialProject, true);
});

describe("New Project", () => {
  it("starts an empty, clean project with a fresh identity and no history", async () => {
    const { commands } = setup();
    edit();
    const previousId = session().metadata.id;

    await expectOk(commands.newProject());

    expect(editor().document).toEqual({
      id: "page-root",
      tag: "page",
      children: [],
    });
    expect(editor().past).toEqual([]);
    expect(session().metadata.id).not.toBe(previousId);
    expect(session().metadata.name).toBe("Untitled Project");
    expect(session().location).toEqual({ kind: "unsaved" });
    expect(unsaved()).toBe(false);
  });

  it("does not save anything", async () => {
    const { commands, base } = setup();
    await commands.newProject();
    expect(await base.list()).toEqual([]);
  });
});

describe("Save", () => {
  it("writes the project, then marks exactly that snapshot as saved", async () => {
    const { commands, base } = setup();
    edit();
    const { id, createdAt } = session().metadata;

    await expectOk(commands.save({ name: "Landing" }));

    expect(unsaved()).toBe(false);
    expect(session().metadata).toMatchObject({
      id,
      createdAt,
      name: "Landing",
    });
    expect(session().location).toEqual({
      kind: "library",
      revision: session().metadata.updatedAt,
    });
    const stored = await base.read(id);
    const parsed = parseProjectFile(stored.text);
    expect(parsed.ok && parsed.project).toEqual({
      metadata: session().metadata,
      document: editor().document,
    });
    expect(session().toast?.message).toBe("Saved “Landing”");
  });

  it("keeps the project id and createdAt across saves and advances updatedAt", async () => {
    const { commands, base } = setup();
    await commands.save();
    const first = session().metadata;
    edit();
    await commands.save();
    const second = session().metadata;

    expect(second.id).toBe(first.id);
    expect(second.createdAt).toBe(first.createdAt);
    expect(Date.parse(second.updatedAt)).toBeGreaterThan(
      Date.parse(first.updatedAt),
    );
    expect(await base.list()).toHaveLength(1);
  });

  it("keeps edits made while the save is in flight unsaved", async () => {
    const gate = deferred();
    const { commands, base } = setup({
      write: async (project, expectation) => {
        await gate.promise;
        return base.write(project, expectation);
      },
    });
    edit("Saved text");
    const savedDocument = editor().document;

    const saving = commands.save();
    expect(session().operation).toBe("save");
    edit("Typed during save");
    gate.release();
    await expectOk(saving);

    expect(editor().persistedDocument).toBe(savedDocument);
    expect(selectHasUnsavedChanges(editor())).toBe(true);
    expect(unsaved()).toBe(true);
    expect(session().operation).toBeNull();
  });

  it("keeps a rename made while the save is in flight unsaved", async () => {
    const gate = deferred();
    const { commands, base } = setup({
      write: async (project, expectation) => {
        await gate.promise;
        return base.write(project, expectation);
      },
    });
    const saving = commands.save({ name: "Before" });
    session().renameProject("After");
    gate.release();
    await saving;

    expect(session().metadata.name).toBe("After");
    expect(session().savedName).toBe("Before");
    expect(unsaved()).toBe(true);
  });

  it("leaves everything unsaved when the write fails", async () => {
    const { commands } = setup({
      write: () =>
        Promise.reject(new ProjectStorageError("quota-exceeded", "Disk full.")),
    });
    edit();
    const before = {
      metadata: session().metadata,
      persisted: editor().persistedDocument,
    };

    const result = await commands.save();

    expect(result).toEqual({
      ok: false,
      error: { title: "Not enough storage space", message: "Disk full." },
    });
    expect(unsaved()).toBe(true);
    expect(editor().persistedDocument).toBe(before.persisted);
    expect(session().metadata).toBe(before.metadata);
    expect(session().location).toEqual({ kind: "unsaved" });
    expect(session().toast).toBeNull();
    expect(session().operation).toBeNull();
  });

  it("runs concurrent saves one after another, never interleaving writes", async () => {
    let active = 0;
    let maxActive = 0;
    const { commands, base } = setup({
      write: async (project, expectation) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        try {
          return await base.write(project, expectation);
        } finally {
          active -= 1;
        }
      },
    });
    edit("one");
    const first = commands.save();
    edit("two");
    const second = commands.save();

    expect(await Promise.all([first, second])).toEqual([
      { ok: true },
      { ok: true },
    ]);
    expect(maxActive).toBe(1);
    // The second save picked up the latest document and the first save's revision.
    expect(unsaved()).toBe(false);
    const parsed = parseProjectFile(
      (await base.read(session().metadata.id)).text,
    );
    expect(parsed.ok && parsed.project.document).toEqual(editor().document);
  });

  it("refuses to overwrite a newer save from another tab, keeping changes unsaved", async () => {
    const { commands, base } = setup();
    await commands.save();
    const otherTab = createProjectCommands({
      repository: base,
      saveFile: vi.fn(),
      now,
    });
    // Simulate the other tab having the same project open and saving it.
    const ours = session().metadata;
    await otherTab.save();
    useProjectStore.setState({
      metadata: ours,
      location: { kind: "library", revision: ours.updatedAt },
      savedName: ours.name,
    });
    edit();

    const result = await commands.save();

    expect(result.ok).toBe(false);
    if (!result.ok)
      expect("error" in result && result.error.title).toBe(
        "Project changed elsewhere",
      );
    expect(unsaved()).toBe(true);
  });

  it("waits for an in-progress drag or resize to finish", async () => {
    const { commands, base } = setup();
    editor().beginTransaction();
    const result = await commands.save();
    expect(result.ok).toBe(false);
    expect(await base.list()).toEqual([]);
  });
});

describe("Save As", () => {
  it("saves a separate project and switches to it, leaving the original as stored", async () => {
    const { commands, base } = setup();
    await commands.save({ name: "Original" });
    const original = session().metadata;
    const originalText = (await base.read(original.id)).text;
    edit();

    await expectOk(commands.saveAs("Copy"));

    expect(session().metadata.id).not.toBe(original.id);
    expect(session().metadata.name).toBe("Copy");
    expect(unsaved()).toBe(false);
    expect((await base.read(original.id)).text).toBe(originalText);
    expect(await base.list()).toHaveLength(2);
  });

  it("keeps the previous project active and unsaved when the write fails", async () => {
    const { commands } = setup({
      write: () => Promise.reject(new ProjectStorageError("failed", "No.")),
    });
    edit();
    const before = session().metadata;

    const result = await commands.saveAs("Copy");

    expect(result.ok).toBe(false);
    expect(session().metadata).toBe(before);
    expect(unsaved()).toBe(true);
  });
});

describe("Open", () => {
  async function storeProject(
    repository: ProjectRepository,
    project: LayoutryProject,
  ) {
    await repository.write(
      { metadata: project.metadata, text: serializeProject(project) },
      { kind: "new" },
    );
  }

  const saved: LayoutryProject = {
    metadata: createProjectMetadata({
      id: "saved-1",
      name: "Kitchen sink",
      now: new Date("2026-10-20T00:00:00.000Z"),
    }),
    document: pageWith(kitchenSinkNode()),
  };

  it("restores the document and metadata exactly, clean, with fresh history", async () => {
    const { commands, base } = setup();
    await storeProject(base, saved);
    edit();

    await expectOk(commands.open("saved-1"));

    expect(editor().document).toEqual(saved.document);
    expect(session().metadata).toEqual(saved.metadata);
    expect(session().location).toEqual({
      kind: "library",
      revision: saved.metadata.updatedAt,
    });
    expect(editor().past).toEqual([]);
    expect(editor().selection.ids).toEqual([]);
    expect(unsaved()).toBe(false);
  });

  it.each([
    ["a missing project", null, "Project not found"],
    ["a damaged document", "{ not json", "This project can't be opened"],
    [
      "a newer format version",
      JSON.stringify({
        format: "layoutry-project",
        formatVersion: 2,
        project: {},
        document: {},
      }),
      "This project can't be opened",
    ],
  ])(
    "leaves the current project untouched when opening %s",
    async (_label, text, title) => {
      const { commands, base } = setup();
      if (text !== null)
        await base.write({ metadata: saved.metadata, text }, { kind: "new" });
      edit();
      const before = {
        document: editor().document,
        persisted: editor().persistedDocument,
        metadata: session().metadata,
      };

      const result = await commands.open("saved-1");

      expect(result.ok).toBe(false);
      if (!result.ok)
        expect("error" in result && result.error.title).toBe(title);
      expect(editor().document).toBe(before.document);
      expect(editor().persistedDocument).toBe(before.persisted);
      expect(session().metadata).toBe(before.metadata);
    },
  );

  it("refuses a record whose contents belong to another project", async () => {
    const { commands, base } = setup();
    const other = {
      ...saved,
      metadata: { ...saved.metadata, id: "someone-else" },
    };
    await base.write(
      { metadata: saved.metadata, text: serializeProject(other) },
      { kind: "new" },
    );
    expect((await commands.open("saved-1")).ok).toBe(false);
  });
});

describe("Rename", () => {
  it("marks the project unsaved without writing, and Save clears it", async () => {
    const { commands, base } = setup();
    await commands.save();
    const { id } = session().metadata;

    session().renameProject("Renamed");
    expect(unsaved()).toBe(true);
    expect(session().metadata.id).toBe(id);
    expect((await base.find(id))?.name).toBe("Untitled Project");

    await commands.save();
    expect(unsaved()).toBe(false);
    expect((await base.find(id))?.name).toBe("Renamed");
  });
});

describe("Import", () => {
  const file: LayoutryProject = {
    metadata: createProjectMetadata({
      id: "imported-1",
      name: "From file",
      now: new Date("2026-09-01T00:00:00.000Z"),
    }),
    document: pageWith({ id: "heading-x", tag: "h1", text: "Imported" }),
  };

  it("adds the project with its own identity and opens it", async () => {
    const { commands, base } = setup();
    await expectOk(commands.importProject(file, "keep-id"));

    expect(session().metadata).toEqual(file.metadata);
    expect(editor().document).toEqual(file.document);
    expect(unsaved()).toBe(false);
    expect(await base.find("imported-1")).toEqual(file.metadata);
  });

  it("imports a colliding id as a copy, leaving the library project untouched", async () => {
    const { commands, base } = setup();
    await commands.importProject(file, "keep-id");
    const libraryText = (await base.read("imported-1")).text;

    await expectOk(
      commands.importProject({ ...file, document: pageWith() }, "copy"),
    );

    expect(session().metadata.id).not.toBe("imported-1");
    expect(session().metadata.name).toBe("From file");
    expect((await base.read("imported-1")).text).toBe(libraryText);
    expect(await base.list()).toHaveLength(2);
  });

  it("replaces the library project only when asked", async () => {
    const { commands, base } = setup();
    await commands.importProject(file, "keep-id");
    const replacement = { ...file, document: pageWith() };

    expect((await commands.importProject(replacement, "keep-id")).ok).toBe(
      false,
    );
    await expectOk(commands.importProject(replacement, "replace"));

    expect(await base.list()).toHaveLength(1);
    const parsed = parseProjectFile((await base.read("imported-1")).text);
    expect(parsed.ok && parsed.project.document).toEqual(pageWith());
  });

  it("changes nothing when the library write fails", async () => {
    const { commands } = setup({
      write: () =>
        Promise.reject(new ProjectStorageError("unavailable", "No storage.")),
    });
    edit();
    const before = {
      document: editor().document,
      metadata: session().metadata,
    };

    expect((await commands.importProject(file, "keep-id")).ok).toBe(false);
    expect(editor().document).toBe(before.document);
    expect(session().metadata).toBe(before.metadata);
  });
});

describe("Download", () => {
  it("hands over a valid .layoutry file of the current state without changing anything", async () => {
    const { commands, saveFile, base } = setup();
    session().renameProject("My: Project?");
    edit();
    const before = {
      persisted: editor().persistedDocument,
      metadata: session().metadata,
      savedName: session().savedName,
    };

    expect(commands.download()).toEqual({ ok: true });

    const [fileName, text] = saveFile.mock.calls[0];
    expect(fileName).toBe("My- Project-.layoutry");
    const parsed = parseProjectFile(text);
    expect(parsed.ok && parsed.project.document).toEqual(editor().document);
    expect(parsed.ok && parsed.project.metadata.id).toBe(before.metadata.id);
    expect(editor().persistedDocument).toBe(before.persisted);
    expect(session().metadata).toBe(before.metadata);
    expect(session().savedName).toBe(before.savedName);
    expect(unsaved()).toBe(true);
    expect(await base.list()).toEqual([]);
  });
});

describe("Delete", () => {
  it("removes another project and leaves the active one alone", async () => {
    const { commands, base } = setup();
    await commands.importProject(
      {
        metadata: createProjectMetadata({ id: "other" }),
        document: pageWith(),
      },
      "keep-id",
    );
    await commands.newProject();
    await commands.save();
    const active = session().metadata;

    await expectOk(commands.remove("other", "Other"));

    expect(await base.find("other")).toBeNull();
    expect(session().metadata).toBe(active);
    expect(unsaved()).toBe(false);
  });

  it("keeps a deleted active project open, now unsaved", async () => {
    const { commands } = setup();
    await commands.save();
    const document = editor().document;

    await expectOk(commands.remove(session().metadata.id));

    expect(editor().document).toBe(document);
    expect(session().location).toEqual({ kind: "unsaved" });
    expect(unsaved()).toBe(true);
  });

  it("reports a storage failure and changes nothing", async () => {
    const { commands } = setup({
      remove: () => Promise.reject(new ProjectStorageError("failed", "Nope.")),
    });
    await commands.save();
    expect((await commands.remove(session().metadata.id)).ok).toBe(false);
    expect(session().location.kind).toBe("library");
    expect(session().toast?.message).not.toMatch(/Deleted/);
  });
});

describe("library listing", () => {
  it("loads into the session store, and reports storage problems", async () => {
    const { commands } = setup();
    await commands.save({ name: "Listed" });
    await commands.refreshLibrary();
    expect(session().library.status).toBe("ready");
    expect(session().library.entries).toHaveLength(1);

    const broken = createProjectCommands({
      repository: createIndexedDbProjectRepository({
        getFactory: () => undefined,
      }),
      saveFile: vi.fn(),
    });
    await broken.refreshLibrary();
    expect(session().library.status).toBe("error");
    expect(session().library.error).toMatch(
      /isn't letting Layoutry store projects/,
    );
  });
});
