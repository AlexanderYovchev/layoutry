import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElementNode } from "@/features/editor/factories/elementFactories";
import {
  selectHasUnsavedChanges,
  useEditorStore,
} from "@/features/editor/stores/useEditorStore";
import {
  createProjectCommands,
  nameFromFileName,
} from "@/features/project/commands/projectCommands";
import { createFakeDesktopProjectFiles } from "@/features/project/desktop/fakeDesktopProjectFiles";
import { createIndexedDbProjectRepository } from "@/features/project/storage/indexedDbProjectRepository";
import {
  selectHasUnsavedProjectChanges,
  useProjectStore,
} from "@/features/project/stores/useProjectStore";
import { parseProjectFile } from "@/features/project/utils/parseProjectFile";
import {
  kitchenSinkNode,
  pageWith,
} from "@/features/project/utils/projectTestDocuments";
import {
  createProjectMetadata,
  serializeProject,
} from "@/features/project/utils/serializeProject";

/** PROJECT-1.3: native .layoutry files through the desktop bridge (faked). */

const initialEditor = useEditorStore.getState();
const initialProject = useProjectStore.getState();
const editor = () => useEditorStore.getState();
const session = () => useProjectStore.getState();
const unsaved = () => selectHasUnsavedProjectChanges(session(), editor());

let clock = Date.parse("2026-10-27T10:00:00.000Z");
const now = () => new Date((clock += 1000));

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
    now,
  });
  return { desktop, repository, commands };
}

function edit(text = "Edited") {
  editor().insertElement("page-root", {
    ...createElementNode("paragraph"),
    text,
  });
}

function fileOnDisk(
  desktop: ReturnType<typeof setup>["desktop"],
  fileName: string,
) {
  const text = desktop.disk.get(fileName);
  if (text === undefined) throw new Error(`${fileName} not on disk`);
  const parsed = parseProjectFile(text);
  if (!parsed.ok) throw new Error(parsed.error.message);
  return parsed.project;
}

beforeEach(() => {
  useEditorStore.setState(initialEditor, true);
  useProjectStore.setState(initialProject, true);
});

describe("first Save of a new project", () => {
  it("asks for a destination, keeps the project id and takes the file's name", async () => {
    const { desktop, commands } = setup();
    const { id } = session().metadata;
    edit();
    desktop.script.saveAs = "My Website.layoutry";

    expect(await commands.saveToFile()).toEqual({ ok: true });

    const saved = fileOnDisk(desktop, "My Website.layoutry");
    expect(saved.metadata).toMatchObject({ id, name: "My Website" });
    expect(saved.document).toEqual(editor().document);
    expect(session().location).toMatchObject({
      kind: "file",
      fileName: "My Website.layoutry",
    });
    expect(session().metadata.name).toBe("My Website");
    expect(unsaved()).toBe(false);
    expect(session().toast?.message).toBe("Saved My Website.layoutry");
  });

  it("changes nothing when the Save dialog is cancelled", async () => {
    const { desktop, commands } = setup();
    edit();
    const before = {
      metadata: session().metadata,
      persisted: editor().persistedDocument,
    };

    expect(await commands.saveToFile()).toEqual({ ok: false, cancelled: true });
    expect(session().metadata).toBe(before.metadata);
    expect(editor().persistedDocument).toBe(before.persisted);
    expect(session().location).toEqual({ kind: "unsaved" });
    expect(desktop.disk.size).toBe(0);
  });
});

describe("later Saves", () => {
  it("rewrite the same file without a dialog, preserving id and createdAt", async () => {
    const { desktop, commands } = setup();
    desktop.script.saveAs = "Site.layoutry";
    await commands.saveToFile();
    const first = session().metadata;
    desktop.script.saveAs = null; // a dialog would now cancel the save

    edit("second");
    expect(await commands.saveToFile()).toEqual({ ok: true });
    const second = fileOnDisk(desktop, "Site.layoutry").metadata;
    expect(second.id).toBe(first.id);
    expect(second.createdAt).toBe(first.createdAt);
    expect(Date.parse(second.updatedAt)).toBeGreaterThan(
      Date.parse(first.updatedAt),
    );
    expect(unsaved()).toBe(false);
  });

  it("round-trips a rich document exactly", async () => {
    const { desktop, commands } = setup();
    editor().replaceDocument(pageWith(kitchenSinkNode()));
    desktop.script.saveAs = "Rich.layoutry";
    await commands.saveToFile();
    expect(fileOnDisk(desktop, "Rich.layoutry").document).toEqual(
      pageWith(kitchenSinkNode()),
    );
  });

  it("keeps edits made while the write is in flight unsaved", async () => {
    const { desktop, commands } = setup();
    desktop.script.saveAs = "Site.layoutry";
    await commands.saveToFile();
    edit("saved text");
    const savedDocument = editor().document;

    const release = desktop.holdWrites();
    const saving = commands.saveToFile();
    await Promise.resolve();
    edit("typed during save");
    release();
    expect(await saving).toEqual({ ok: true });

    expect(editor().persistedDocument).toBe(savedDocument);
    expect(selectHasUnsavedChanges(editor())).toBe(true);
    expect(fileOnDisk(desktop, "Site.layoutry").document).toEqual(
      savedDocument,
    );
  });

  it("serializes two rapid saves; the second writes the latest document", async () => {
    const { desktop, commands } = setup();
    desktop.script.saveAs = "Site.layoutry";
    await commands.saveToFile();
    edit("one");
    const first = commands.saveToFile();
    edit("two");
    const second = commands.saveToFile();
    expect(await Promise.all([first, second])).toEqual([
      { ok: true },
      { ok: true },
    ]);
    expect(fileOnDisk(desktop, "Site.layoutry").document).toEqual(
      editor().document,
    );
    expect(unsaved()).toBe(false);
  });

  it.each([
    [
      "modified",
      (disk: Map<string, string>) =>
        disk.set("Site.layoutry", "changed elsewhere"),
    ],
    ["missing", (disk: Map<string, string>) => disk.delete("Site.layoutry")],
  ] as const)(
    "reports an external change (%s) without writing or clearing unsaved state",
    async (reason, change) => {
      const { desktop, commands } = setup();
      desktop.script.saveAs = "Site.layoutry";
      await commands.saveToFile();
      change(desktop.disk);
      edit();
      const persisted = editor().persistedDocument;

      expect(await commands.saveToFile()).toEqual({
        ok: false,
        conflict: { reason, fileName: "Site.layoutry" },
      });
      expect(editor().persistedDocument).toBe(persisted);
      expect(unsaved()).toBe(true);

      expect(await commands.saveToFile({ force: true })).toEqual({ ok: true });
      expect(fileOnDisk(desktop, "Site.layoutry").document).toEqual(
        editor().document,
      );
      expect(unsaved()).toBe(false);
    },
  );

  it.each(["permission-denied", "locked", "disk-full"])(
    "keeps unsaved state after a %s failure",
    async (code) => {
      const { desktop, commands } = setup();
      desktop.script.saveAs = "Site.layoutry";
      await commands.saveToFile();
      edit();
      session().dismissToast();
      desktop.script.failWrite = code;

      const result = await commands.saveToFile();
      expect(result.ok).toBe(false);
      expect("error" in result && result.error.message).toContain(code);
      expect(unsaved()).toBe(true);
      expect(session().toast).toBeNull();
    },
  );
});

describe("Save As", () => {
  it("writes a separate file with a new identity and leaves the original untouched", async () => {
    const { desktop, commands } = setup();
    desktop.script.saveAs = "Original.layoutry";
    await commands.saveToFile();
    const original = desktop.disk.get("Original.layoutry");
    const originalToken =
      session().location.kind === "file" ? session().location : null;
    edit();

    desktop.script.saveAs = "Copy.layoutry";
    expect(await commands.saveToFile({ saveAs: true })).toEqual({ ok: true });

    expect(desktop.disk.get("Original.layoutry")).toBe(original);
    const copy = fileOnDisk(desktop, "Copy.layoutry");
    expect(copy.metadata.id).not.toBe(
      fileOnDisk(desktop, "Original.layoutry").metadata.id,
    );
    expect(copy.metadata.name).toBe("Copy");
    expect(session().location).toMatchObject({
      kind: "file",
      fileName: "Copy.layoutry",
    });
    expect(unsaved()).toBe(false);
    if (originalToken?.kind === "file")
      expect(desktop.released).toContain(originalToken.token);
  });

  it("keeps the previous file association when it fails or is cancelled", async () => {
    const { desktop, commands } = setup();
    desktop.script.saveAs = "Original.layoutry";
    await commands.saveToFile();
    const location = session().location;
    edit();

    desktop.script.saveAs = null;
    expect(await commands.saveToFile({ saveAs: true })).toEqual({
      ok: false,
      cancelled: true,
    });
    desktop.script.saveAs = "Copy.layoutry";
    desktop.script.failWrite = "disk-full";
    expect((await commands.saveToFile({ saveAs: true })).ok).toBe(false);

    expect(session().location).toBe(location);
    expect(unsaved()).toBe(true);
    // The unused destination's capability was given back.
    expect(desktop.liveTokens()).toHaveLength(1);
  });

  it("saves a library project as a native file without touching the library copy", async () => {
    const { desktop, repository, commands } = setup();
    const library = {
      metadata: createProjectMetadata({ id: "lib-1", name: "Old" }),
      document: pageWith(),
    };
    await repository.write(
      { metadata: library.metadata, text: serializeProject(library) },
      { kind: "new" },
    );
    await commands.open("lib-1");
    const libraryText = (await repository.read("lib-1")).text;

    desktop.script.saveAs = "Old.layoutry";
    expect(await commands.saveToFile({ saveAs: true })).toEqual({ ok: true });
    expect(session().location).toMatchObject({ kind: "file" });
    expect((await repository.read("lib-1")).text).toBe(libraryText);
  });
});

describe("opening files", () => {
  it("activates the file's project, clean, and gives back the previous file", async () => {
    const { desktop, commands } = setup();
    desktop.script.saveAs = "First.layoutry";
    await commands.saveToFile();
    const firstLocation = session().location;
    const other = {
      metadata: createProjectMetadata({ id: "other", name: "Other" }),
      document: pageWith(kitchenSinkNode()),
    };
    desktop.disk.set("Other.layoutry", serializeProject(other));
    desktop.script.open = "Other.layoutry";

    const opened = await desktop.bridge.openProjectFile();
    if (opened.status !== "opened") throw new Error("expected a file");
    expect(await commands.openFile(opened.file, other)).toEqual({ ok: true });

    expect(editor().document).toEqual(other.document);
    expect(session().metadata).toEqual(other.metadata);
    expect(session().location).toMatchObject({
      kind: "file",
      fileName: "Other.layoutry",
    });
    expect(unsaved()).toBe(false);
    if (firstLocation.kind === "file")
      expect(desktop.released).toContain(firstLocation.token);
  });
});

describe("nameFromFileName", () => {
  it.each([
    ["Site.layoutry", "Site"],
    ["Site.LAYOUTRY", "Site"],
    ["  Spaced   name .layoutry", "Spaced name"],
    [".layoutry", null],
  ])("%j → %j", (fileName, expected) => {
    expect(nameFromFileName(fileName)).toBe(expected);
  });
});
