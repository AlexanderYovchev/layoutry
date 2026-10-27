import { IDBFactory } from "fake-indexeddb";
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { createProjectCommands } from "@/features/project/commands/projectCommands";
import { createRecoveryCoordinator } from "@/features/project/commands/recoveryCoordinator";
import { createIndexedDbProjectRepository } from "@/features/project/storage/indexedDbProjectRepository";
import { createIndexedDbRecoveryStorage } from "@/features/project/storage/indexedDbRecoveryStorage";
import { createMemoryRecoveryLocks } from "@/features/project/storage/recoveryLocks";
import {
  selectHasUnsavedProjectChanges,
  useProjectStore,
} from "@/features/project/stores/useProjectStore";
import { parseProjectFile } from "@/features/project/utils/parseProjectFile";

/**
 * PROJECT-1.5 legacy compatibility: IndexedDB records exactly as PROJECT-1.2
 * (project library) and PROJECT-1.4 (recovery) wrote them, frozen in
 * test/fixtures/persistence, must stay readable by today's code — with no
 * migration or rewrite of the stored data.
 */

interface DatabaseFixture {
  database: string;
  version: number;
  stores: Record<string, unknown[]>;
}

function fixture(name: string): DatabaseFixture {
  const value: unknown = JSON.parse(
    readFileSync(
      path.join(process.cwd(), "test", "fixtures", "persistence", name),
      "utf8",
    ),
  );
  if (
    typeof value !== "object" ||
    value === null ||
    !("database" in value) ||
    !("version" in value) ||
    !("stores" in value) ||
    typeof value.database !== "string" ||
    typeof value.version !== "number" ||
    typeof value.stores !== "object" ||
    value.stores === null
  )
    throw new Error(`bad fixture ${name}`);
  const stores: Record<string, unknown[]> = {};
  for (const [store, rows] of Object.entries(value.stores))
    stores[store] = Array.isArray(rows) ? rows : [];
  return { database: value.database, version: value.version, stores };
}

/** Recreates the database as the earlier build left it, store by store. */
async function seed(
  factory: IDBFactory,
  data: DatabaseFixture,
  keyPath: string,
): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(data.database, data.version);
    request.onupgradeneeded = () => {
      for (const store of Object.keys(data.stores))
        request.result.createObjectStore(store, { keyPath });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(Object.keys(data.stores), "readwrite");
    for (const [store, rows] of Object.entries(data.stores))
      for (const row of rows) transaction.objectStore(store).put(row);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

const LIBRARY_ID = "5d0c2f7e-91a4-4b6b-8c3d-1e2f3a4b5c6d";
const initialEditor = useEditorStore.getState();
const initialProject = useProjectStore.getState();

beforeEach(() => {
  useEditorStore.setState(initialEditor, true);
  useProjectStore.setState(initialProject, true);
});

describe("records from earlier checkpoints", () => {
  it("lists, opens and saves a PROJECT-1.2 library project as it was stored", async () => {
    const factory = new IDBFactory();
    const stored = fixture("indexeddb-library-1.2.json");
    await seed(factory, stored, "id");
    const repository = createIndexedDbProjectRepository({
      getFactory: () => factory,
    });

    expect(await repository.list()).toEqual([
      {
        status: "ok",
        summary: {
          id: LIBRARY_ID,
          name: "Library Site",
          createdAt: "2026-10-26T09:00:00.000Z",
          updatedAt: "2026-10-26T10:30:00.000Z",
        },
      },
    ]);
    const commands = createProjectCommands({ repository, saveFile: vi.fn() });
    expect(await commands.open(LIBRARY_ID)).toEqual({ ok: true });
    expect(useProjectStore.getState().location).toEqual({
      kind: "library",
      revision: "2026-10-26T10:30:00.000Z",
    });
    expect(
      selectHasUnsavedProjectChanges(
        useProjectStore.getState(),
        useEditorStore.getState(),
      ),
    ).toBe(false);
    // Its revision check works against the old record: saving succeeds.
    useProjectStore.getState().renameProject("Library Site v2");
    expect(await commands.save()).toEqual({ ok: true });
    const reread = await repository.read(LIBRARY_ID);
    const parsed = parseProjectFile(reread.text);
    expect(parsed.ok && parsed.project.metadata.name).toBe("Library Site v2");
  });

  it("offers and restores PROJECT-1.4 recovery records as they were stored", async () => {
    const factory = new IDBFactory();
    await seed(factory, fixture("indexeddb-library-1.2.json"), "id");
    await seed(factory, fixture("indexeddb-recovery-1.4.json"), "recordId");
    const locks = createMemoryRecoveryLocks();
    const repository = createIndexedDbProjectRepository({
      getFactory: () => factory,
    });
    const coordinator = createRecoveryCoordinator({
      storage: createIndexedDbRecoveryStorage({
        getFactory: () => factory,
        locks: locks.locks,
        createSessionId: () => "9".repeat(32),
      }),
      findLibraryProject: (id) =>
        repository.read(id).then((project) => ({
          updatedAt: project.metadata.updatedAt,
          text: project.text,
        })),
    });
    expect(await coordinator.start()).toBe(true);

    const groups = await coordinator.findRecoverable();
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      projectId: LIBRARY_ID,
      projectName: "Library Site (unsaved edits)",
      source: { kind: "library", revision: "2026-10-26T10:30:00.000Z" },
      original: "unchanged",
      restorable: true,
    });
    const restore = await coordinator.prepareRestore(
      groups[0],
      groups[0].versions[0].recordId,
    );
    expect(restore).toMatchObject({
      ok: true,
      location: { kind: "library", revision: "2026-10-26T10:30:00.000Z" },
    });
    if (restore.ok)
      expect(JSON.stringify(restore.project.document)).toContain(
        "Typed just before the crash",
      );
    coordinator.stop();
  });
});
