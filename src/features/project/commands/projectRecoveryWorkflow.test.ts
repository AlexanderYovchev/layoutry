import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElementNode } from "@/features/editor/factories/elementFactories";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { createProjectCommands } from "@/features/project/commands/projectCommands";
import { createProjectWorkflow } from "@/features/project/commands/projectWorkflow";
import {
  createRecoveryCoordinator,
  type RecoveryCoordinator,
} from "@/features/project/commands/recoveryCoordinator";
import { createFakeDesktopProjectFiles } from "@/features/project/desktop/fakeDesktopProjectFiles";
import { createIndexedDbProjectRepository } from "@/features/project/storage/indexedDbProjectRepository";
import { createIndexedDbRecoveryStorage } from "@/features/project/storage/indexedDbRecoveryStorage";
import {
  createMemoryRecoveryLocks,
  SESSION_LOCK_PREFIX,
} from "@/features/project/storage/recoveryLocks";
import type { RecoveryStorage } from "@/features/project/storage/recoveryStorage";
import { useProjectDialogStore } from "@/features/project/stores/useProjectDialogStore";
import {
  selectHasUnsavedProjectChanges,
  useProjectStore,
} from "@/features/project/stores/useProjectStore";
import { useRecoveryStore } from "@/features/project/stores/useRecoveryStore";
import type { LayoutryProject } from "@/features/project/types/projectFile";
import { recoveryRecordId } from "@/features/project/types/recoveryRecord";
import { pageWith } from "@/features/project/utils/projectTestDocuments";
import {
  createProjectMetadata,
  serializeProject,
} from "@/features/project/utils/serializeProject";
import { sha256Hex } from "@/features/project/utils/sha256Hex";

/** PROJECT-1.4 user flows: startup offer, Restore, Keep for Later, Discard, Save. */

const CRASHED = "c".repeat(32);
const OWN = "d".repeat(32);
const initialEditor = useEditorStore.getState();
const initialProject = useProjectStore.getState();
const initialDialogs = useProjectDialogStore.getState();
const initialRecovery = useRecoveryStore.getState();
const editor = () => useEditorStore.getState();
const session = () => useProjectStore.getState();
const ui = () => useProjectDialogStore.getState();
const coordinators: RecoveryCoordinator[] = [];

const crashedProject: LayoutryProject = {
  metadata: createProjectMetadata({ id: "crashed-1", name: "Crashed Site" }),
  document: pageWith({ id: "heading-c", tag: "h1", text: "Unsaved headline" }),
};

function setup(options: { desktop?: boolean } = {}) {
  const factory = new IDBFactory();
  const locks = createMemoryRecoveryLocks();
  const storageFor = (sessionId: string): RecoveryStorage =>
    createIndexedDbRecoveryStorage({
      getFactory: () => factory,
      locks: locks.locks,
      createSessionId: () => sessionId,
    });
  const repository = createIndexedDbProjectRepository({
    getFactory: () => factory,
  });
  const desktop = options.desktop ? createFakeDesktopProjectFiles() : null;
  const recovery = createRecoveryCoordinator({
    storage: storageFor(OWN),
    findLibraryProject: (id) =>
      repository.read(id).then(
        (stored) => ({
          updatedAt: stored.metadata.updatedAt,
          text: stored.text,
        }),
        () => null,
      ),
  });
  coordinators.push(recovery);
  const commands = createProjectCommands({
    repository,
    saveFile: vi.fn(),
    desktop: desktop?.bridge ?? null,
  });
  const workflow = createProjectWorkflow(
    commands,
    desktop?.bridge ?? null,
    recovery,
  );

  /** Another tab that wrote snapshots and then crashed. */
  async function crashedTab(
    project: LayoutryProject,
    source: Parameters<RecoveryStorage["write"]>[0]["source"] = {
      kind: "unsaved",
    },
    generations = [1],
    badHash: number[] = [],
  ) {
    const tab = storageFor(CRASHED);
    await tab.beginSession();
    for (const generation of generations) {
      const text = serializeProject(project);
      await tab.write({
        generation,
        metadata: project.metadata,
        source,
        savedAt: new Date(Date.UTC(2026, 9, 28, 9, generation)).toISOString(),
        sha256: badHash.includes(generation)
          ? "0".repeat(64)
          : await sha256Hex(text),
        text,
      });
    }
    locks.drop(`${SESSION_LOCK_PREFIX}${CRASHED}`);
  }

  /** Every snapshot in recovery storage, read straight from IndexedDB. */
  async function allRecordIds(): Promise<string[]> {
    const probe = storageFor("e".repeat(32));
    await probe.beginSession();
    const orphans = await probe.listOrphans();
    locks.drop(`${SESSION_LOCK_PREFIX}${"e".repeat(32)}`);
    // The probe sees our own records only once our tab "ended" too.
    return orphans
      .map((entry) =>
        entry.status === "ok" ? entry.summary.recordId : entry.recordId,
      )
      .sort();
  }

  return {
    repository,
    recovery,
    commands,
    workflow,
    desktop,
    crashedTab,
    allRecordIds,
    locks,
  };
}

function isDirty() {
  return selectHasUnsavedProjectChanges(session(), editor());
}

function recoveryDialog() {
  const dialog = ui().dialog;
  return dialog?.kind === "recovery" ? dialog : null;
}

beforeEach(() => {
  useEditorStore.setState(initialEditor, true);
  useProjectStore.setState(initialProject, true);
  useProjectDialogStore.setState(initialDialogs, true);
  useRecoveryStore.setState(initialRecovery, true);
});

afterEach(() => {
  for (const coordinator of coordinators.splice(0)) coordinator.stop();
});

describe("startup", () => {
  it("offers a crashed tab's work before anything else, without changing the project", async () => {
    const { workflow, crashedTab } = setup();
    await crashedTab(crashedProject);
    const before = editor().document;
    await workflow.startup();
    expect(recoveryDialog()?.groups).toMatchObject([
      { projectName: "Crashed Site", restorable: true },
    ]);
    expect(editor().document).toBe(before);
  });

  it("shows nothing when there is nothing to recover", async () => {
    const { workflow } = setup();
    await workflow.startup();
    expect(ui().dialog).toBeNull();
  });
});

describe("Restore", () => {
  it("restores the exact work, keeps its id, and marks it unsaved", async () => {
    const { workflow, crashedTab, recovery, allRecordIds, locks } = setup();
    await crashedTab(crashedProject);
    await workflow.startup();
    const group = recoveryDialog()!.groups[0];

    expect(
      await workflow.restoreRecovery(group.key, group.versions[0].recordId),
    ).toBe(true);
    await recovery.settle();

    expect(editor().document).toEqual(crashedProject.document);
    expect(session().metadata).toEqual(crashedProject.metadata);
    expect(session().location).toEqual({ kind: "unsaved" });
    expect(isDirty()).toBe(true);
    expect(ui().dialog).toBeNull();
    expect(editor().past).toEqual([]);
    // The work is now this session's: protected again, old copies removed.
    locks.drop(`${SESSION_LOCK_PREFIX}${OWN}`);
    expect(await allRecordIds()).toEqual([recoveryRecordId(OWN, 1)]);
  });

  it("asks first when the open project has unsaved changes; Don't Save discards only its own recovery copies", async () => {
    const { workflow, crashedTab, recovery, allRecordIds, locks } = setup();
    await crashedTab(crashedProject);
    await recovery.start();
    editor().insertElement("page-root", createElementNode("paragraph"));
    await recovery.flush(); // the current work has a recovery copy (generation 1)
    await workflow.startup();
    const group = recoveryDialog()!.groups[0];

    await workflow.restoreRecovery(group.key, group.versions[0].recordId);
    const prompt = ui().dialog;
    expect(prompt?.kind === "discard" && prompt.pending.kind).toBe("restore");
    expect(await workflow.resolveDiscard("discard")).toBe(true);
    await recovery.settle();

    expect(session().metadata.id).toBe("crashed-1");
    locks.drop(`${SESSION_LOCK_PREFIX}${OWN}`);
    // Generation 1 (the discarded work) is gone; generation 2 protects the restored work.
    expect(await allRecordIds()).toEqual([recoveryRecordId(OWN, 2)]);
  });

  it("Cancel on that prompt restores nothing and goes back to the recovered work", async () => {
    const { workflow, crashedTab, recovery } = setup();
    await crashedTab(crashedProject);
    await recovery.start();
    editor().insertElement("page-root", createElementNode("paragraph"));
    const current = editor().document;
    await workflow.startup();
    const group = recoveryDialog()!.groups[0];
    await workflow.restoreRecovery(group.key, group.versions[0].recordId);
    workflow.cancelDiscard();
    await vi.waitFor(() => expect(recoveryDialog()?.groups).toHaveLength(1));
    expect(editor().document).toBe(current);
  });

  it("a recovered library project saves back with its old revision: another tab's save is a conflict", async () => {
    const { workflow, crashedTab, repository } = setup();
    const savedAt = "2026-10-28T08:00:00.000Z";
    const stored = { ...crashedProject.metadata, updatedAt: savedAt };
    await repository.write(
      {
        metadata: stored,
        text: serializeProject({
          ...crashedProject,
          metadata: stored,
          document: pageWith(),
        }),
      },
      { kind: "new" },
    );
    await crashedTab(
      { ...crashedProject, metadata: stored },
      { kind: "library", revision: savedAt },
    );
    // Meanwhile another tab saved the library project.
    const newer = { ...stored, updatedAt: "2026-10-28T10:00:00.000Z" };
    await repository.write(
      {
        metadata: newer,
        text: serializeProject({ metadata: newer, document: pageWith() }),
      },
      { kind: "overwrite" },
    );

    await workflow.startup();
    const group = recoveryDialog()!.groups[0];
    expect(group.original).toBe("modified");
    await workflow.restoreRecovery(group.key, group.versions[0].recordId);
    expect(session().location).toEqual({ kind: "library", revision: savedAt });

    expect(await workflow.save()).toBe(false);
    const dialog = ui().dialog;
    expect(dialog?.kind === "error" && dialog.error.title).toBe(
      "Project changed elsewhere",
    );
    expect((await repository.read("crashed-1")).metadata.updatedAt).toBe(
      newer.updatedAt,
    );
    expect(isDirty()).toBe(true);
  });

  it("after a successful Save the restored work's recovery copies are cleaned up", async () => {
    const { workflow, crashedTab, recovery, allRecordIds, locks } = setup();
    await crashedTab(crashedProject);
    await workflow.startup();
    const group = recoveryDialog()!.groups[0];
    await workflow.restoreRecovery(group.key, group.versions[0].recordId);
    await recovery.settle();

    await workflow.save(); // new project in the browser: asks for a name
    expect(await workflow.submitName("first-save", "Crashed Site")).toBe(true);
    expect(isDirty()).toBe(false);
    await recovery.settle();
    locks.drop(`${SESSION_LOCK_PREFIX}${OWN}`);
    expect(await allRecordIds()).toEqual([]);
  });
});

describe("Keep for Later and Discard", () => {
  it("Keep for Later closes the dialog and keeps the work for next time", async () => {
    const { workflow, crashedTab } = setup();
    await crashedTab(crashedProject);
    await workflow.startup();
    workflow.keepRecoveryForLater();
    expect(ui().dialog).toBeNull();
    expect(session().toast?.message).toContain("Recover Unsaved Work");

    await workflow.showRecovery();
    expect(recoveryDialog()?.groups).toHaveLength(1);
  });

  it("Discard deletes that work only", async () => {
    const { workflow, crashedTab, allRecordIds } = setup();
    await crashedTab(crashedProject);
    await workflow.startup();
    const group = recoveryDialog()!.groups[0];
    expect(await workflow.discardRecovery(group.key)).toBe(true);
    expect(ui().dialog).toBeNull();
    expect(await allRecordIds()).toEqual([]);
    await workflow.showRecovery();
    expect(recoveryDialog()?.groups).toEqual([]);
  });

  it("a damaged version is reported in the dialog and nothing is restored", async () => {
    const { workflow, crashedTab } = setup();
    await crashedTab(crashedProject, { kind: "unsaved" }, [1, 2], [2]);
    await workflow.startup();
    const group = recoveryDialog()!.groups[0];
    // The newest version fails its hash check; the older one is offered.
    expect(group.versions.map((version) => version.damaged)).toEqual([
      true,
      false,
    ]);
    expect(group.restorable).toBe(true);
    const before = editor().document;
    expect(
      await workflow.restoreRecovery(group.key, recoveryRecordId(CRASHED, 2)),
    ).toBe(false);
    expect(recoveryDialog()?.error?.message).toMatch(/damaged/);
    expect(editor().document).toBe(before);
    expect(
      await workflow.restoreRecovery(group.key, recoveryRecordId(CRASHED, 1)),
    ).toBe(true);
    expect(editor().document).toEqual(crashedProject.document);
  });
});

describe("desktop startup", () => {
  it("opens a file from the command line only after the recovery dialog is answered", async () => {
    const { workflow, crashedTab, desktop } = setup({ desktop: true });
    if (!desktop) throw new Error("no desktop");
    const fileProject: LayoutryProject = {
      metadata: createProjectMetadata({ id: "file-1", name: "From CLI" }),
      document: pageWith(),
    };
    desktop.disk.set("From CLI.layoutry", serializeProject(fileProject));
    desktop.script.pending.push("From CLI.layoutry");
    await crashedTab(crashedProject);

    await workflow.startup();
    expect(recoveryDialog()).not.toBeNull();
    expect(session().metadata.id).not.toBe("file-1");

    workflow.keepRecoveryForLater();
    await vi.waitFor(() => expect(session().metadata.id).toBe("file-1"));
  });
});
