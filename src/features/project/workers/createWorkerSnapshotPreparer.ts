import type { ProjectLimits } from "@/features/project/rules/projectLimits";
import type { LayoutryProject } from "@/features/project/types/projectFile";
import {
  prepareRecoverySnapshot,
  type PreparedSnapshot,
  type SnapshotPreparer,
} from "@/features/project/utils/prepareRecoverySnapshot";
import { ProjectSerializationError } from "@/features/project/utils/serializeProject";
import {
  snapshotResponseSchema,
  type SnapshotRequest,
} from "@/features/project/workers/snapshotWorkerProtocol";

/** The parts of a dedicated Worker this uses; tests pass a fake. */
export interface SnapshotWorkerPort {
  postMessage(message: SnapshotRequest): void;
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null;
  terminate(): void;
}

export interface WorkerSnapshotPreparerOptions {
  /** Defaults to the real recovery snapshot worker; null where there is none. */
  createWorker?: () => SnapshotWorkerPort | null;
  /** Where the work happens without a worker. */
  fallback?: SnapshotPreparer;
  /**
   * A worker that hasn't answered by then is treated as broken, so a stuck
   * worker can never hold up the recovery queue (or closing the window).
   * Generous: the largest project the loader accepts takes seconds.
   */
  timeoutMs?: number;
}

function createRealWorker(): SnapshotWorkerPort | null {
  if (typeof Worker === "undefined") return null;
  return new Worker(new URL("./recoverySnapshot.worker.ts", import.meta.url));
}

interface PendingRequest {
  project: LayoutryProject;
  limits: ProjectLimits;
  resolve: (prepared: PreparedSnapshot) => void;
  reject: (error: unknown) => void;
  cancelTimeout: () => void;
}

/**
 * Prepares recovery snapshots in a worker (PROJECT-1.5), so serializing,
 * self-checking and hashing a large project no longer blocks editing.
 *
 * The page posts a structured clone of the captured project, taken at
 * once, so the snapshot is exactly the state the recovery coordinator
 * captured, whatever the user does meanwhile. Each answer is matched to
 * its own request; ordering and generations stay with the coordinator.
 *
 * Without a usable worker — none in this environment, it failed to start,
 * crashed, answered nonsense or didn't answer in time — the same
 * prepareRecoverySnapshot runs on the page instead, for that request and
 * every later one. A project that can't be written fails exactly as it
 * would on the page (ProjectSerializationError).
 */
export function createWorkerSnapshotPreparer(
  options: WorkerSnapshotPreparerOptions = {},
) {
  const createWorker = options.createWorker ?? createRealWorker;
  const fallback: SnapshotPreparer =
    options.fallback ??
    ((project, limits) => prepareRecoverySnapshot(project, limits));
  const timeoutMs = options.timeoutMs ?? 60_000;

  let worker: SnapshotWorkerPort | null = null;
  let unavailable = false;
  let nextId = 0;
  const pending = new Map<number, PendingRequest>();

  function runOnPage(request: PendingRequest): void {
    request.cancelTimeout();
    fallback(request.project, request.limits).then(
      request.resolve,
      request.reject,
    );
  }

  /** Stops using the worker; whatever it still owed is done on the page. */
  function abandonWorker(): void {
    unavailable = true;
    const port = worker;
    worker = null;
    if (port) {
      port.onmessage = null;
      port.onerror = null;
      port.onmessageerror = null;
      port.terminate();
    }
    const owed = [...pending.values()];
    pending.clear();
    for (const request of owed) runOnPage(request);
  }

  function onMessage(event: MessageEvent<unknown>): void {
    const response = snapshotResponseSchema.safeParse(event.data);
    if (!response.success) {
      abandonWorker();
      return;
    }
    const answer = response.data;
    const request = pending.get(answer.id);
    // Already handled on the page (timed out): nothing left to answer.
    if (!request) return;
    pending.delete(answer.id);
    request.cancelTimeout();
    if (answer.ok) {
      request.resolve({ text: answer.text, sha256: answer.sha256 });
    } else if (answer.reason === "invalid") {
      request.reject(
        new ProjectSerializationError(answer.message, answer.path),
      );
    } else {
      // The worker can't do this here (e.g. no Web Crypto): stop asking it.
      abandonWorker();
      runOnPage(request);
    }
  }

  function port(): SnapshotWorkerPort | null {
    if (unavailable) return null;
    if (worker) return worker;
    try {
      worker = createWorker();
    } catch {
      worker = null;
    }
    if (!worker) {
      unavailable = true;
      return null;
    }
    worker.onmessage = onMessage;
    worker.onerror = () => abandonWorker();
    worker.onmessageerror = () => abandonWorker();
    return worker;
  }

  const prepare: SnapshotPreparer = (project, limits) => {
    const target = port();
    if (!target) return fallback(project, limits);
    return new Promise<PreparedSnapshot>((resolve, reject) => {
      const id = nextId;
      nextId += 1;
      const timer = setTimeout(() => {
        if (pending.has(id)) abandonWorker();
      }, timeoutMs);
      const request: PendingRequest = {
        project,
        limits,
        resolve,
        reject,
        cancelTimeout: () => clearTimeout(timer),
      };
      pending.set(id, request);
      try {
        target.postMessage({ id, project, limits });
      } catch {
        // This project couldn't be cloned (DataCloneError): the page
        // decides, and reports it exactly as it would without a worker.
        pending.delete(id);
        runOnPage(request);
      }
    });
  };

  return {
    prepare,
    /** True while snapshots are being prepared off the main thread. */
    usesWorker: () => worker !== null,
    /** Stops the worker; anything still pending is finished on the page. */
    dispose: abandonWorker,
  };
}

export type WorkerSnapshotPreparer = ReturnType<
  typeof createWorkerSnapshotPreparer
>;
