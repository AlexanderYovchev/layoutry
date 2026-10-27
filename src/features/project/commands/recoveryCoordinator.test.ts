import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElementNode } from "@/features/editor/factories/elementFactories";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import {
  createRecoveryCoordinator,
  type RecoveryClock,
  type RecoveryCoordinator,
} from "@/features/project/commands/recoveryCoordinator";
import {
  RecoveryStorageError,
  type RecoverySnapshotWrite,
  type RecoveryStorage,
} from "@/features/project/storage/recoveryStorage";
import {
  selectHasUnsavedProjectChanges,
  useProjectStore,
} from "@/features/project/stores/useProjectStore";
import { useRecoveryStore } from "@/features/project/stores/useRecoveryStore";
import {
  recoveryRecordId,
  type RecoveryRecordSummary,
} from "@/features/project/types/recoveryRecord";
import { pageWith } from "@/features/project/utils/projectTestDocuments";
import {
  createProjectMetadata,
  serializeProject,
} from "@/features/project/utils/serializeProject";
import { sha256Hex } from "@/features/project/utils/sha256Hex";

/** PROJECT-1.4: scheduling, consistency, ordering, cleanup and discovery. */

const OWN = "a".repeat(32);
const CRASHED = "c".repeat(32);
const initialEditor = useEditorStore.getState();
const initialProject = useProjectStore.getState();
const initialRecovery = useRecoveryStore.getState();
const editor = () => useEditorStore.getState();
const session = () => useProjectStore.getState();

function testClock() {
  let now = 0;
  let sequence = 0;
  let tasks: { at: number; id: number; run: () => void }[] = [];
  const clock: RecoveryClock = {
    now: () => now,
    schedule(run, ms) {
      const task = { at: now + ms, id: (sequence += 1), run };
      tasks.push(task);
      return () => {
        tasks = tasks.filter((other) => other !== task);
      };
    },
  };
  return {
    clock,
    advance(ms: number) {
      const target = now + ms;
      for (;;) {
        const due = tasks
          .filter((task) => task.at <= target)
          .sort((a, b) => a.at - b.at || a.id - b.id)[0];
        if (!due) break;
        tasks = tasks.filter((task) => task !== due);
        now = due.at;
        due.run();
      }
      now = target;
    },
  };
}

interface StoredRecord {
  summary: RecoveryRecordSummary;
  text: string;
}

/** Recovery storage in memory, with a write gate and injectable failures. */
function memoryStorage() {
  const records = new Map<string, StoredRecord>();
  const writes: RecoverySnapshotWrite[] = [];
  const removed: string[] = [];
  let gate: Promise<void> | null = null;
  let openGate: (() => void) | null = null;
  const failures: RecoveryStorageError[] = [];
  let inFlight = 0;
  let maxInFlight = 0;

  const storage: RecoveryStorage = {
    beginSession: async () => OWN,
    async write(snapshot) {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      try {
        if (gate) await gate;
        const failure = failures.shift();
        if (failure) throw failure;
        const recordId = recoveryRecordId(OWN, snapshot.generation);
        writes.push(snapshot);
        records.set(recordId, {
          summary: {
            recordId,
            sessionId: OWN,
            generation: snapshot.generation,
            projectId: snapshot.metadata.id,
            projectName: snapshot.metadata.name,
            savedAt: snapshot.savedAt,
            source:
              snapshot.source.kind === "file"
                ? { kind: "file", fileName: snapshot.source.fileName }
                : snapshot.source,
            size: snapshot.text.length,
            sha256: snapshot.sha256,
            original: null,
          },
          text: snapshot.text,
        });
      } finally {
        inFlight -= 1;
      }
    },
    async listOrphans() {
      return [...records.values()]
        .filter((record) => record.summary.sessionId !== OWN)
        .map((record) => ({ status: "ok" as const, summary: record.summary }));
    },
    async read(recordId) {
      const record = records.get(recordId);
      if (!record) throw new RecoveryStorageError("not-found", "gone");
      return { ...record, file: null, matchesOriginal: false };
    },
    async remove(recordIds) {
      for (const id of recordIds) {
        records.delete(id);
        removed.push(id);
      }
    },
    claim: async (ids) => [...ids],
    release() {},
  };

  return {
    storage,
    records,
    writes,
    removed,
    maxInFlight: () => maxInFlight,
    inFlight: () => inFlight,
    hold() {
      gate = new Promise((resolve) => {
        openGate = resolve;
      });
    },
    release() {
      openGate?.();
      gate = null;
    },
    failNext(code: RecoveryStorageError["code"], message = "storage failed") {
      failures.push(new RecoveryStorageError(code, message));
    },
    ownIds() {
      return [...records.keys()].filter((id) => id.startsWith(OWN)).sort();
    },
    /** Plants a crashed session's snapshot. */
    async plant(
      generation: number,
      project: Parameters<typeof serializeProject>[0],
      overrides: Partial<RecoveryRecordSummary> = {},
      text = serializeProject(project),
    ) {
      const recordId = recoveryRecordId(CRASHED, generation);
      records.set(recordId, {
        summary: {
          recordId,
          sessionId: CRASHED,
          generation,
          projectId: project.metadata.id,
          projectName: project.metadata.name,
          savedAt: new Date(Date.UTC(2026, 9, 28, 9, generation)).toISOString(),
          source: { kind: "unsaved" },
          size: text.length,
          sha256: await sha256Hex(text),
          original: null,
          ...overrides,
        },
        text,
      });
      return recordId;
    },
  };
}

const coordinators: RecoveryCoordinator[] = [];

function setup(
  options: Partial<Parameters<typeof createRecoveryCoordinator>[0]> = {},
) {
  const time = testClock();
  const memory = memoryStorage();
  const coordinator = createRecoveryCoordinator({
    storage: memory.storage,
    clock: time.clock,
    ...options,
  });
  coordinators.push(coordinator);
  return { ...time, ...memory, coordinator };
}

function edit() {
  editor().insertElement("page-root", createElementNode("paragraph"));
}

function isDirty() {
  return selectHasUnsavedProjectChanges(session(), editor());
}

beforeEach(() => {
  useEditorStore.setState(initialEditor, true);
  useProjectStore.setState(initialProject, true);
  useRecoveryStore.setState(initialRecovery, true);
});

afterEach(() => {
  for (const coordinator of coordinators.splice(0)) coordinator.stop();
});

describe("scheduling", () => {
  it("waits 2 s after the last change, then writes one snapshot", async () => {
    const { coordinator, advance, writes } = setup();
    await coordinator.start();
    edit();
    advance(1_900);
    await coordinator.settle();
    expect(writes).toHaveLength(0);
    expect(useRecoveryStore.getState().status).toBe("pending");
    advance(100);
    await coordinator.settle();
    expect(writes).toHaveLength(1);
    expect(useRecoveryStore.getState().status).toBe("protected");
  });

  it("coalesces rapid edits, but never waits more than 30 s during continuous editing", async () => {
    const { coordinator, advance, writes } = setup();
    await coordinator.start();
    for (let second = 0; second < 29; second += 1) {
      edit();
      advance(1_000);
    }
    await coordinator.settle();
    expect(writes).toHaveLength(0);
    edit();
    advance(1_000);
    await coordinator.settle();
    expect(writes).toHaveLength(1);
  });

  it("never snapshots a project without unsaved changes, or UI-only changes", async () => {
    const { coordinator, advance, writes } = setup();
    await coordinator.start();
    editor().selectElement(editor().document.children?.[0]?.id ?? "page-root");
    editor().setSnapEnabled(false);
    advance(60_000);
    await coordinator.settle();
    expect(writes).toHaveLength(0);
    expect(useRecoveryStore.getState().status).toBe("idle");
  });

  it("waits for a drag or resize in progress to finish", async () => {
    const { coordinator, advance, writes } = setup();
    await coordinator.start();
    edit();
    editor().beginTransaction();
    advance(10_000);
    await coordinator.settle();
    expect(writes).toHaveLength(0);
    editor().commitTransaction();
    // Finishing the drag is itself a change: the usual quiet time applies.
    advance(2_000);
    await coordinator.settle();
    expect(writes).toHaveLength(1);
  });

  it("writes at once when the page is hidden or loses focus", async () => {
    const { coordinator, writes } = setup();
    await coordinator.start();
    edit();
    window.dispatchEvent(new Event("blur"));
    await coordinator.settle();
    expect(writes).toHaveLength(1);
  });
});

describe("snapshot content and consistency", () => {
  it("is the exact serialized project — document and metadata together", async () => {
    const { coordinator, advance, writes } = setup();
    await coordinator.start();
    edit();
    session().renameProject("Renamed");
    advance(2_000);
    await coordinator.settle();
    const [snapshot] = writes;
    expect(snapshot.text).toBe(
      serializeProject({
        metadata: session().metadata,
        document: editor().document,
      }),
    );
    expect(snapshot.metadata).toBe(session().metadata);
    expect(snapshot.sha256).toBe(await sha256Hex(snapshot.text));
    expect(snapshot.source).toEqual({ kind: "unsaved" });
  });

  it("never marks the project saved, and never touches history, selection or location", async () => {
    const { coordinator, advance } = setup();
    await coordinator.start();
    edit();
    const before = {
      document: editor().document,
      persisted: editor().persistedDocument,
      past: editor().past,
      selection: editor().selection,
      location: session().location,
      savedName: session().savedName,
    };
    advance(2_000);
    await coordinator.settle();
    expect(isDirty()).toBe(true);
    expect({
      document: editor().document,
      persisted: editor().persistedDocument,
      past: editor().past,
      selection: editor().selection,
      location: session().location,
      savedName: session().savedName,
    }).toEqual(before);
  });

  it("skips identical content: a change and its reversal write nothing new", async () => {
    const { coordinator, advance, writes } = setup();
    await coordinator.start();
    edit();
    advance(2_000);
    await coordinator.settle();
    session().renameProject("Other");
    session().renameProject("Untitled Project");
    advance(2_000);
    await coordinator.settle();
    expect(writes).toHaveLength(1);
    expect(useRecoveryStore.getState().status).toBe("protected");
  });

  it("takes increasing generations, one write at a time, and captures edits made during a write next", async () => {
    const memoryEdits = setup();
    const { coordinator, advance, writes, hold, release, maxInFlight } =
      memoryEdits;
    await coordinator.start();
    edit();
    hold();
    advance(2_000);
    await vi.waitFor(() => expect(memoryEdits.inFlight()).toBe(1));
    // The first write is in flight: edit again.
    edit();
    const duringWrite = editor().document;
    advance(2_000);
    release();
    await coordinator.settle();
    await coordinator.settle();
    expect(writes.map((write) => write.generation)).toEqual([1, 2]);
    expect(maxInFlight()).toBe(1);
    expect(writes[1].text).toBe(
      serializeProject({ metadata: session().metadata, document: duringWrite }),
    );
  });
});

describe("cleanup", () => {
  async function protectedEdit(context: ReturnType<typeof setup>) {
    await context.coordinator.start();
    edit();
    context.advance(2_000);
    await context.coordinator.settle();
  }

  it("removes this session's snapshots once the work is saved", async () => {
    const context = setup();
    await protectedEdit(context);
    expect(context.ownIds()).toHaveLength(1);
    // A successful save: the saved baseline catches up with the document.
    editor().markDocumentPersisted(editor().document);
    await context.coordinator.settle();
    expect(context.ownIds()).toEqual([]);
    expect(useRecoveryStore.getState().status).toBe("idle");
  });

  it("keeps snapshots of edits made after the save snapshot", async () => {
    const context = setup();
    await protectedEdit(context);
    const saved = editor().document;
    edit(); // during the save
    context.advance(2_000);
    await context.coordinator.settle();
    editor().markDocumentPersisted(saved); // the save completes
    await context.coordinator.settle();
    expect(isDirty()).toBe(true);
    expect(context.ownIds()).toEqual([
      recoveryRecordId(OWN, 1),
      recoveryRecordId(OWN, 2),
    ]);
  });

  it("keeps everything when a save fails (nothing changes)", async () => {
    const context = setup();
    await protectedEdit(context);
    await context.coordinator.settle();
    expect(context.ownIds()).toHaveLength(1);
  });

  it("Don't Save discards only this session's snapshots up to that moment", async () => {
    const context = setup();
    await protectedEdit(context);
    await context.plant(1, {
      metadata: createProjectMetadata({ id: "other" }),
      document: pageWith(),
    });
    const boundary = context.coordinator.boundary();
    edit();
    context.advance(2_000);
    await context.coordinator.settle();
    await context.coordinator.discardThrough(boundary);
    expect(context.ownIds()).toEqual([recoveryRecordId(OWN, 2)]);
    expect(context.records.has(recoveryRecordId(CRASHED, 1))).toBe(true);
  });
});

describe("closing the window", () => {
  it("Don't Save: nothing starts writing afterwards, and every own snapshot goes", async () => {
    const context = setup();
    await context.coordinator.start();
    edit();
    context.advance(2_000);
    await context.coordinator.settle();
    edit(); // newer unsaved work, its snapshot scheduled
    await context.coordinator.shutdown({ discard: true });
    window.dispatchEvent(new Event("blur"));
    context.advance(60_000);
    await context.coordinator.settle();
    expect(context.writes).toHaveLength(1);
    expect(context.ownIds()).toEqual([]);
  });

  it("a snapshot queued before the close is skipped, not written after the discard", async () => {
    const context = setup();
    await context.coordinator.start();
    edit();
    context.hold();
    context.advance(2_000);
    await vi.waitFor(() => expect(context.inFlight()).toBe(1));
    edit();
    void context.coordinator.flush(); // queued behind the write in flight
    const closing = context.coordinator.shutdown({ discard: true });
    context.release();
    await closing;
    expect(context.writes.map((write) => write.generation)).toEqual([1]);
    expect(context.ownIds()).toEqual([]);
  });

  it("an ordinary close leaves existing snapshots untouched", async () => {
    const context = setup();
    await context.coordinator.start();
    edit();
    context.advance(2_000);
    await context.coordinator.settle();
    await context.coordinator.shutdown({ discard: false });
    expect(context.ownIds()).toEqual([recoveryRecordId(OWN, 1)]);
  });
});

describe("failures", () => {
  it("reports recovery as unavailable, keeps the project unsaved, and retries", async () => {
    const context = setup();
    await context.coordinator.start();
    context.failNext("quota-exceeded", "No space for a recovery copy.");
    edit();
    context.advance(2_000);
    await context.coordinator.settle();
    expect(useRecoveryStore.getState()).toMatchObject({
      status: "unavailable",
      message: "No space for a recovery copy.",
    });
    expect(isDirty()).toBe(true);
    context.advance(30_000);
    await context.coordinator.settle();
    expect(context.writes).toHaveLength(1);
    expect(useRecoveryStore.getState().status).toBe("protected");
  });

  it("an unavailable storage leaves the editor fully usable", async () => {
    const coordinator = createRecoveryCoordinator({
      storage: {
        ...memoryStorage().storage,
        beginSession: () =>
          Promise.reject(
            new RecoveryStorageError("unavailable", "No storage here."),
          ),
      },
    });
    coordinators.push(coordinator);
    expect(await coordinator.start()).toBe(false);
    expect(useRecoveryStore.getState()).toMatchObject({
      status: "unavailable",
      message: "No storage here.",
    });
    edit();
    expect(isDirty()).toBe(true);
    expect(await coordinator.findRecoverable()).toEqual([]);
  });
});

describe("finding recovered work", () => {
  const crashedProject = {
    metadata: createProjectMetadata({ id: "crashed-1", name: "Crashed" }),
    document: pageWith({ id: "h", tag: "h1", text: "Unsaved headline" }),
  };

  it("offers an ended session's work, newest first, validated", async () => {
    const context = setup();
    await context.coordinator.start();
    await context.plant(1, crashedProject);
    await context.plant(2, crashedProject);
    const [group, ...rest] = await context.coordinator.findRecoverable();
    expect(rest).toEqual([]);
    expect(group).toMatchObject({
      projectId: "crashed-1",
      projectName: "Crashed",
      restorable: true,
      versions: [
        { recordId: recoveryRecordId(CRASHED, 2), damaged: false },
        { recordId: recoveryRecordId(CRASHED, 1), damaged: false },
      ],
    });
  });

  it("detects a hash mismatch and a corrupted record, and falls back to an older version", async () => {
    const context = setup();
    await context.coordinator.start();
    await context.plant(1, crashedProject);
    const text = serializeProject(crashedProject);
    await context.plant(2, crashedProject, { sha256: "0".repeat(64) });
    await context.plant(3, crashedProject, {}, text.slice(0, -40));
    const [group] = await context.coordinator.findRecoverable();
    expect(group.versions.map((version) => version.damaged)).toEqual([
      true,
      true,
      false,
    ]);
    expect(group.restorable).toBe(true);
    const restore = await context.coordinator.prepareRestore(
      group,
      recoveryRecordId(CRASHED, 2),
    );
    expect(restore).toMatchObject({ ok: false });
  });

  it("offers damaged-only work for discarding, never as restorable", async () => {
    const context = setup();
    await context.coordinator.start();
    await context.plant(1, crashedProject, {}, "{ not json");
    const [group] = await context.coordinator.findRecoverable();
    expect(group.restorable).toBe(false);
  });

  it("silently drops work the library already holds (crash between Save and cleanup)", async () => {
    const context = setup({
      findLibraryProject: async () => ({
        updatedAt: "2026-10-28T10:00:00.000Z",
        text: serializeProject({
          ...crashedProject,
          metadata: {
            ...crashedProject.metadata,
            updatedAt: "2026-10-28T10:00:00.000Z",
          },
        }),
      }),
    });
    await context.coordinator.start();
    await context.plant(1, crashedProject, {
      source: { kind: "library", revision: "2026-10-28T09:00:00.000Z" },
    });
    expect(await context.coordinator.findRecoverable()).toEqual([]);
    expect(context.records.size).toBe(0);
  });

  it("reports whether the library copy changed since, and restores with the old revision", async () => {
    const context = setup({
      findLibraryProject: async () => ({
        updatedAt: "2026-10-28T11:00:00.000Z",
        text: serializeProject({
          metadata: crashedProject.metadata,
          document: pageWith(),
        }),
      }),
    });
    await context.coordinator.start();
    await context.plant(1, crashedProject, {
      source: { kind: "library", revision: "2026-10-28T09:00:00.000Z" },
    });
    const [group] = await context.coordinator.findRecoverable();
    expect(group.original).toBe("modified");
    const restore = await context.coordinator.prepareRestore(
      group,
      recoveryRecordId(CRASHED, 1),
    );
    expect(restore).toMatchObject({
      ok: true,
      location: { kind: "library", revision: "2026-10-28T09:00:00.000Z" },
      project: { metadata: { id: "crashed-1" } },
    });
  });

  it("adopting restored work protects it first, then removes the ended session's copies", async () => {
    const context = setup();
    await context.coordinator.start();
    await context.plant(1, crashedProject);
    const [group] = await context.coordinator.findRecoverable();
    editor().replaceDocument(crashedProject.document);
    session().activateRecovered(crashedProject.metadata, { kind: "unsaved" });
    await context.coordinator.adopt(group, []);
    expect(context.writes).toHaveLength(1);
    expect(context.records.has(recoveryRecordId(CRASHED, 1))).toBe(false);
    expect(context.ownIds()).toEqual([recoveryRecordId(OWN, 1)]);
  });

  it("keeps the ended session's copies if the new snapshot can't be written", async () => {
    const context = setup();
    await context.coordinator.start();
    await context.plant(1, crashedProject);
    const [group] = await context.coordinator.findRecoverable();
    editor().replaceDocument(crashedProject.document);
    session().activateRecovered(crashedProject.metadata, { kind: "unsaved" });
    context.failNext("quota-exceeded");
    await context.coordinator.adopt(group, []);
    expect(context.records.has(recoveryRecordId(CRASHED, 1))).toBe(true);
  });
});
