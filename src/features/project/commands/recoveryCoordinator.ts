import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import {
  DEFAULT_PROJECT_LIMITS,
  type ProjectLimits,
} from "@/features/project/rules/projectLimits";
import {
  DEFAULT_RECOVERY_TIMING,
  type RecoveryTiming,
} from "@/features/project/rules/recoveryPolicy";
import {
  RecoveryStorageError,
  type RecoverySnapshotWrite,
  type RecoveryStorage,
} from "@/features/project/storage/recoveryStorage";
import {
  selectHasUnsavedProjectChanges,
  UNSAVED_LOCATION,
  useProjectStore,
  type ProjectLocation,
} from "@/features/project/stores/useProjectStore";
import { useRecoveryStore } from "@/features/project/stores/useRecoveryStore";
import type {
  LayoutryProject,
  ProjectMetadata,
} from "@/features/project/types/projectFile";
import {
  recoveryRecordId,
  type OriginalState,
  type RecoveryGroup,
  type RecoveryListEntry,
  type RecoveryRecordSummary,
} from "@/features/project/types/recoveryRecord";
import { parseProjectFile } from "@/features/project/utils/parseProjectFile";
import { serializeProject } from "@/features/project/utils/serializeProject";
import { sha256Hex } from "@/features/project/utils/sha256Hex";
import type { EditorElementNode } from "@/features/editor/types/document";

/** Timers, injectable so tests control time. */
export interface RecoveryClock {
  now(): number;
  /** Runs `callback` after `ms`; returns a cancel function. */
  schedule(callback: () => void, ms: number): () => void;
}

const realClock: RecoveryClock = {
  now: () => Date.now(),
  schedule(callback, ms) {
    const handle = setTimeout(callback, ms);
    return () => clearTimeout(handle);
  },
};

export interface RecoveryCoordinatorOptions {
  storage: RecoveryStorage;
  timing?: Partial<RecoveryTiming>;
  clock?: RecoveryClock;
  hashText?: (text: string) => Promise<string>;
  limits?: ProjectLimits;
  /**
   * The library's stored copy of a project, used to recognize recovered
   * work that was in fact saved (a crash after Save, before cleanup).
   */
  findLibraryProject?: (
    id: string,
  ) => Promise<{ updatedAt: string; text: string } | null>;
  /** Gives back a desktop file token that won't be used after all. */
  releaseFile?: (token: string) => void;
}

interface CapturedState {
  document: EditorElementNode;
  metadata: ProjectMetadata;
  location: ProjectLocation;
}

export type RecoveryLoadResult =
  | {
      ok: true;
      project: LayoutryProject;
      text: string;
      summary: RecoveryRecordSummary;
      file: { token: string; fileName: string } | null;
      matchesOriginal: boolean;
    }
  | { ok: false; message: string };

const DAMAGED_MESSAGE =
  "This version of the recovered work is damaged and can't be restored. Try an older version.";

function sameLocation(a: ProjectLocation, b: ProjectLocation): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "library" && b.kind === "library")
    return a.revision === b.revision;
  if (a.kind === "file" && b.kind === "file") return a.token === b.token;
  return true;
}

function sourceOf(location: ProjectLocation): RecoverySnapshotWrite["source"] {
  switch (location.kind) {
    case "unsaved":
      return { kind: "unsaved" };
    case "library":
      return { kind: "library", revision: location.revision };
    case "file":
      return {
        kind: "file",
        fileName: location.fileName,
        token: location.token,
      };
  }
}

/** Same id, name and authored document. */
function sameContent(a: string, b: string): boolean {
  const left = parseProjectFile(a);
  const right = parseProjectFile(b);
  return (
    left.ok &&
    right.ok &&
    left.project.metadata.id === right.project.metadata.id &&
    left.project.metadata.name === right.project.metadata.name &&
    JSON.stringify(left.project.document) ===
      JSON.stringify(right.project.document)
  );
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof RecoveryStorageError ? error.message : fallback;
}

/**
 * Automatic recovery snapshots (PROJECT-1.4). Watches the editor and the
 * project session, and while there are unsaved changes writes a separate
 * recovery copy of them: 2 s after the last authored change, at most 30 s
 * apart during continuous editing, and right away when the page is hidden
 * or loses focus. It never saves the project, never touches the saved
 * baseline, the project's location, history or selection.
 *
 * - Coherent: document, metadata and location are read together in one
 *   tick, serialized exactly (with the loader's own self-check), hashed
 *   and committed. A snapshot of a half-finished drag is never taken.
 * - Ordered: one operation at a time; every snapshot has a higher
 *   generation than the last, and storage refuses an older one.
 * - Deduplicated: unchanged state or identical content isn't written.
 * - Cleaned up: once the project has no unsaved changes (it was saved, or
 *   its changes were explicitly discarded), this session's snapshots up to
 *   that moment are deleted. Nothing else ever is, except by the user.
 *
 * It also finds the work of ended sessions (crash, kill, closed tab) for
 * the recovery dialog, and validates it before anything is restored.
 */
export function createRecoveryCoordinator(options: RecoveryCoordinatorOptions) {
  const { storage } = options;
  const timing: RecoveryTiming = {
    ...DEFAULT_RECOVERY_TIMING,
    ...options.timing,
  };
  const clock = options.clock ?? realClock;
  const hashText = options.hashText ?? sha256Hex;
  const limits = options.limits ?? DEFAULT_PROJECT_LIMITS;
  const editor = () => useEditorStore.getState();
  const session = () => useProjectStore.getState();

  let sessionId: string | null = null;
  let starting: Promise<boolean> | null = null;
  let startFailure: string | null = null;
  let detach: (() => void) | null = null;
  let generation = 0;
  /** Generations of this session's committed snapshots not yet removed. */
  const ownRecords = new Set<number>();
  /** The state the newest committed snapshot captured. */
  let captured: CapturedState | null = null;
  /** sha256 + source of the newest committed snapshot, for deduplication. */
  let capturedKey: string | null = null;
  let cancelTimer: (() => void) | null = null;
  let firstPendingAt: number | null = null;
  let failure: string | null = null;
  /** The window is closing: no snapshot may start any more. */
  let closed = false;
  let cleaning = false;
  let lastCleanupFailureAt = -Infinity;
  let queue: Promise<unknown> = Promise.resolve();

  /** One recovery operation at a time, in order. */
  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task, task);
    queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  function isDirty(): boolean {
    return selectHasUnsavedProjectChanges(session(), editor());
  }

  function isCaptured(): boolean {
    return (
      captured !== null &&
      captured.document === editor().document &&
      captured.metadata === session().metadata &&
      sameLocation(captured.location, session().location)
    );
  }

  function refreshStatus(): void {
    const store = useRecoveryStore.getState();
    if (!sessionId) {
      store.setStatus(startFailure ? "unavailable" : "off", startFailure);
      return;
    }
    if (!isDirty()) store.setStatus("idle");
    else if (failure) store.setStatus("unavailable", failure);
    else store.setStatus(isCaptured() ? "protected" : "pending");
  }

  function clearTimer(): void {
    cancelTimer?.();
    cancelTimer = null;
  }

  function schedule(delayMs?: number): void {
    const now = clock.now();
    firstPendingAt ??= now;
    const wait =
      delayMs ??
      Math.max(
        0,
        Math.min(timing.debounceMs, firstPendingAt + timing.maxWaitMs - now),
      );
    clearTimer();
    cancelTimer = clock.schedule(fire, wait);
  }

  function fire(): void {
    cancelTimer = null;
    // Mid-drag, mid-resize or mid-drawing: wait for the edit to finish.
    if (editor().transactionSnapshot !== null) {
      cancelTimer = clock.schedule(fire, timing.busyRetryMs);
      return;
    }
    void snapshotNow();
  }

  function onChange(): void {
    if (!sessionId || closed) return;
    if (!isDirty()) {
      clearTimer();
      firstPendingAt = null;
      if (
        ownRecords.size > 0 &&
        !cleaning &&
        clock.now() - lastCleanupFailureAt >= timing.retryMs
      ) {
        cleaning = true;
        void cleanup(generation).finally(() => {
          cleaning = false;
        });
      }
    } else if (isCaptured()) {
      clearTimer();
      firstPendingAt = null;
    } else if (!failure || cancelTimer === null) {
      schedule();
    }
    refreshStatus();
  }

  /**
   * Captures and commits the current unsaved work unless it already has a
   * snapshot. Resolves true when the current work is protected.
   */
  function snapshotNow(): Promise<boolean> {
    return enqueue(async () => {
      const own = sessionId;
      if (!own || closed || !isDirty()) return false;
      if (isCaptured()) return true;

      // One coherent state, read in one tick.
      const state: CapturedState = {
        document: editor().document,
        metadata: session().metadata,
        location: session().location,
      };
      firstPendingAt = null;
      generation += 1;
      const snapshotGeneration = generation;

      let text: string;
      try {
        text = serializeProject(
          { metadata: state.metadata, document: state.document },
          limits,
        );
      } catch {
        failure =
          "Layoutry couldn't make a recovery copy of this project. Save your work to keep it.";
        refreshStatus();
        return false;
      }
      const source = sourceOf(state.location);
      const sha256 = await hashText(text);
      const key = `${sha256}|${JSON.stringify(source)}`;
      if (key === capturedKey) {
        // Identical content (e.g. a change and its reversal): nothing new to keep.
        captured = state;
        refreshStatus();
        return isCaptured();
      }
      try {
        await storage.write({
          generation: snapshotGeneration,
          metadata: state.metadata,
          source,
          savedAt: new Date(clock.now()).toISOString(),
          sha256,
          text,
        });
      } catch (error) {
        failure = messageOf(
          error,
          "Layoutry couldn't update its recovery copy. Save your work to keep it.",
        );
        schedule(timing.retryMs);
        refreshStatus();
        return false;
      }
      ownRecords.add(snapshotGeneration);
      captured = state;
      capturedKey = key;
      failure = null;
      refreshStatus();
      return isCaptured();
    });
  }

  /** Deletes this session's snapshots up to `boundary`. */
  function cleanup(boundary: number): Promise<void> {
    return enqueue(async () => {
      const own = sessionId;
      const generations = [...ownRecords].filter((g) => g <= boundary);
      if (!own || generations.length === 0) return;
      try {
        await storage.remove(generations.map((g) => recoveryRecordId(own, g)));
        for (const g of generations) ownRecords.delete(g);
      } catch {
        // Kept, and retried later. Never lose data on doubt.
        lastCleanupFailureAt = clock.now();
      }
      if (ownRecords.size === 0) {
        captured = null;
        capturedKey = null;
      }
      refreshStatus();
    });
  }

  function attach(): () => void {
    const stopEditor = useEditorStore.subscribe(onChange);
    const stopProject = useProjectStore.subscribe(onChange);
    // Lifecycle hints: write now when the page may be about to go away.
    // Storage can't be awaited during unload, so these start the write
    // early rather than relying on it finishing.
    const flush = () => {
      if (isDirty() && !isCaptured()) {
        clearTimer();
        void snapshotNow();
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    window.addEventListener("blur", flush);
    return () => {
      stopEditor();
      stopProject();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("blur", flush);
    };
  }

  async function load(
    recordId: string,
    forRestore: boolean,
  ): Promise<RecoveryLoadResult> {
    const read = await storage.read(recordId, { forRestore }).then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({ ok: false as const, error }),
    );
    if (!read.ok)
      return { ok: false, message: messageOf(read.error, DAMAGED_MESSAGE) };
    const result = read.value;
    const giveBack = () => {
      if (result.file) options.releaseFile?.(result.file.token);
    };
    if ((await hashText(result.text)) !== result.summary.sha256) {
      giveBack();
      return { ok: false, message: DAMAGED_MESSAGE };
    }
    const parsed = parseProjectFile(result.text, limits);
    if (!parsed.ok) {
      giveBack();
      return {
        ok: false,
        message:
          parsed.error.code === "unsupported-version"
            ? parsed.error.message
            : DAMAGED_MESSAGE,
      };
    }
    if (parsed.project.metadata.id !== result.summary.projectId) {
      giveBack();
      return { ok: false, message: DAMAGED_MESSAGE };
    }
    return {
      ok: true,
      project: parsed.project,
      text: result.text,
      summary: result.summary,
      file: result.file,
      matchesOriginal: result.matchesOriginal,
    };
  }

  function groupsOf(entries: RecoveryListEntry[]) {
    const groups = new Map<
      string,
      { sessionId: string; entries: RecoveryListEntry[] }
    >();
    for (const entry of entries) {
      const sessionOf =
        entry.status === "ok" ? entry.summary.sessionId : entry.sessionId;
      // Damaged records can't name their project: grouped per session.
      const key =
        entry.status === "ok"
          ? `${sessionOf}/${entry.summary.projectId}`
          : `${sessionOf}/`;
      const group = groups.get(key);
      if (group) group.entries.push(entry);
      else groups.set(key, { sessionId: sessionOf, entries: [entry] });
    }
    return groups;
  }

  return {
    /**
     * Starts this page's recovery session and watching for changes.
     * Resolves false if recovery storage is unavailable (the editor works
     * normally; the header says recovery is unavailable).
     */
    async start(): Promise<boolean> {
      starting ??= storage.beginSession().then(
        (id) => {
          sessionId = id;
          return true;
        },
        (error: unknown) => {
          startFailure = messageOf(
            error,
            "Layoutry can't keep recovery copies here. Save your work to keep it.",
          );
          refreshStatus();
          return false;
        },
      );
      const started = await starting;
      if (started && !detach) {
        detach = attach();
        onChange();
      }
      return started;
    },

    /** Stops watching (the page is going away or unmounting). */
    stop(): void {
      detach?.();
      detach = null;
      clearTimer();
    },

    /** Takes a snapshot now if the current unsaved work has none. */
    flush: () => snapshotNow(),

    /**
     * The desktop window is about to close. No snapshot starts after this
     * (one already queued is skipped). `discard`: the user chose Don't
     * Save, so every snapshot of this session goes too; otherwise they are
     * left exactly as they are. Resolves once storage is settled.
     */
    shutdown(options: { discard: boolean }): Promise<void> {
      closed = true;
      detach?.();
      detach = null;
      clearTimer();
      return options.discard
        ? cleanup(Number.POSITIVE_INFINITY)
        : enqueue(async () => undefined);
    },

    /** Resolves when every queued snapshot and cleanup has finished. */
    settle(): Promise<void> {
      return enqueue(async () => undefined);
    },

    /** The newest generation so far: the boundary for discardThrough. */
    boundary: () => generation,

    /** Explicit Don't Save: drops this session's snapshots up to `boundary`. */
    discardThrough(boundary: number): Promise<void> {
      return cleanup(boundary);
    },

    /**
     * Recovered work of ended sessions, newest version first and the newest
     * restorable one validated. Work that was in fact saved already is
     * removed silently. Offered groups are claimed until restored,
     * discarded or released.
     */
    async findRecoverable(): Promise<RecoveryGroup[]> {
      if (!sessionId) return [];
      let entries: RecoveryListEntry[];
      try {
        entries = await storage.listOrphans();
      } catch {
        return [];
      }
      const grouped = groupsOf(entries);
      const claimed = new Set(
        await storage
          .claim([...new Set([...grouped.values()].map((g) => g.sessionId))])
          .catch((): string[] => []),
      );

      const found: RecoveryGroup[] = [];
      for (const [key, group] of grouped) {
        if (!claimed.has(group.sessionId)) continue;
        const summaries = group.entries
          .flatMap((entry) => (entry.status === "ok" ? [entry.summary] : []))
          .sort((a, b) => b.generation - a.generation);
        const damagedIds = new Set(
          group.entries.flatMap((entry) =>
            entry.status === "damaged" ? [entry.recordId] : [],
          ),
        );
        let newestValid: Extract<RecoveryLoadResult, { ok: true }> | null =
          null;
        for (const summary of summaries) {
          const loaded = await load(summary.recordId, false);
          if (loaded.ok) {
            newestValid = loaded;
            break;
          }
          damagedIds.add(summary.recordId);
        }

        const allIds = group.entries.map((entry) =>
          entry.status === "ok" ? entry.summary.recordId : entry.recordId,
        );
        const head = summaries[0];
        let original: OriginalState | null = head?.original ?? null;
        if (newestValid && head) {
          let redundant = newestValid.matchesOriginal;
          if (head.source.kind === "library" && options.findLibraryProject) {
            const stored = await options
              .findLibraryProject(head.projectId)
              .catch(() => null);
            original = !stored
              ? "missing"
              : stored.updatedAt === head.source.revision
                ? "unchanged"
                : "modified";
            redundant =
              stored !== null && sameContent(stored.text, newestValid.text);
          }
          if (redundant) {
            // Saved after all (a crash between Save and cleanup).
            await storage.remove(allIds).catch(() => undefined);
            continue;
          }
        }

        found.push({
          key,
          sessionId: group.sessionId,
          projectId: head?.projectId ?? "",
          projectName: head?.projectName ?? "Unknown project",
          source: head?.source ?? { kind: "unsaved" },
          original,
          versions: [
            ...summaries.map((summary) => ({
              recordId: summary.recordId,
              generation: summary.generation,
              savedAt: summary.savedAt,
              damaged: damagedIds.has(summary.recordId),
            })),
            ...group.entries.flatMap((entry) =>
              entry.status === "damaged"
                ? [
                    {
                      recordId: entry.recordId,
                      generation: Number(entry.recordId.split("-")[1]),
                      savedAt: "",
                      damaged: true,
                    },
                  ]
                : [],
            ),
          ],
          restorable: newestValid !== null,
        });
      }
      const offered = new Set(found.map((group) => group.sessionId));
      storage.release([...claimed].filter((id) => !offered.has(id)));
      return found;
    },

    /**
     * Validates one version for restoring and works out where it will be
     * saved: its library project (with its old revision, so another tab's
     * save is a conflict), its original file (re-authorized with the
     * pre-crash version, so an outside change is a conflict), or nowhere
     * yet. Nothing in the editor changes here.
     */
    async prepareRestore(
      group: RecoveryGroup,
      recordId: string,
    ): Promise<
      | { ok: true; project: LayoutryProject; location: ProjectLocation }
      | { ok: false; message: string }
    > {
      if (!group.versions.some((version) => version.recordId === recordId))
        return { ok: false, message: DAMAGED_MESSAGE };
      const loaded = await load(recordId, true);
      if (!loaded.ok) return loaded;
      const source = loaded.summary.source;
      const location: ProjectLocation =
        source.kind === "library"
          ? { kind: "library", revision: source.revision }
          : source.kind === "file" && loaded.file
            ? {
                kind: "file",
                token: loaded.file.token,
                fileName: loaded.file.fileName,
              }
            : UNSAVED_LOCATION;
      return { ok: true, project: loaded.project, location };
    },

    /**
     * After a restore: the work now belongs to this session. It is
     * protected by a fresh snapshot first; only then are the ended
     * session's copies removed.
     */
    adopt(
      group: RecoveryGroup,
      stillOffered: readonly RecoveryGroup[],
    ): Promise<void> {
      const protectedNow = snapshotNow();
      // Queued behind that snapshot, so settle() covers the whole hand-over.
      return enqueue(async () => {
        if (await protectedNow)
          await storage
            .remove(group.versions.map((version) => version.recordId))
            .catch(() => undefined);
        if (!stillOffered.some((other) => other.sessionId === group.sessionId))
          storage.release([group.sessionId]);
      });
    },

    /** Permanently deletes a group's recovered work (after the user confirmed). */
    async discard(
      group: RecoveryGroup,
      stillOffered: readonly RecoveryGroup[],
    ): Promise<{ ok: true } | { ok: false; message: string }> {
      try {
        await storage.remove(group.versions.map((version) => version.recordId));
      } catch (error) {
        return {
          ok: false,
          message: messageOf(
            error,
            "The recovered work couldn't be discarded. Try again.",
          ),
        };
      }
      if (!stillOffered.some((other) => other.sessionId === group.sessionId))
        storage.release([group.sessionId]);
      return { ok: true };
    },

    /** Keep for Later: stops offering these groups; their data stays. */
    release(groups: readonly RecoveryGroup[]): void {
      storage.release([...new Set(groups.map((group) => group.sessionId))]);
    },
  };
}

export type RecoveryCoordinator = ReturnType<typeof createRecoveryCoordinator>;
