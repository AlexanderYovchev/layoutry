import { afterEach, describe, expect, it, vi } from "vitest";
import type { EditorElementNode } from "@/features/editor/types/document";
import { DEFAULT_PROJECT_LIMITS } from "@/features/project/rules/projectLimits";
import type { SnapshotPreparer } from "@/features/project/utils/prepareRecoverySnapshot";
import { pageWith } from "@/features/project/utils/projectTestDocuments";
import {
  createProjectMetadata,
  ProjectSerializationError,
  serializeProject,
} from "@/features/project/utils/serializeProject";
import { sha256Hex } from "@/features/project/utils/sha256Hex";
import {
  createWorkerSnapshotPreparer,
  type SnapshotWorkerPort,
} from "@/features/project/workers/createWorkerSnapshotPreparer";
import {
  handleSnapshotRequest,
  type SnapshotRequest,
  type SnapshotResponse,
} from "@/features/project/workers/snapshotWorkerProtocol";

/**
 * A worker double: postMessage clones its message like the real thing
 * (structuredClone, which also throws DataCloneError), and answers with
 * the real worker logic — automatically, or when the test says so.
 */
function fakeWorker(mode: "auto" | "manual" = "auto") {
  const received: SnapshotRequest[] = [];
  let terminated = false;
  const port: SnapshotWorkerPort = {
    onmessage: null,
    onerror: null,
    onmessageerror: null,
    postMessage(message) {
      if (terminated) throw new Error("posted to a terminated worker");
      const clone = structuredClone(message);
      received.push(clone);
      if (mode === "auto") void answer(clone);
    },
    terminate() {
      terminated = true;
    },
  };
  async function answer(request: SnapshotRequest) {
    const response = await handleSnapshotRequest(request);
    if (response) send(response);
  }
  function send(data: SnapshotResponse | unknown) {
    port.onmessage?.(new MessageEvent("message", { data }));
  }
  return {
    port,
    received,
    answer,
    send,
    crash() {
      port.onerror?.(new ErrorEvent("error", { message: "worker crashed" }));
    },
    terminated: () => terminated,
  };
}

const metadata = createProjectMetadata({ id: "p-1", name: "Project" });
const projectWith = (text: string) => ({
  metadata,
  document: pageWith({ id: "h", tag: "h1", text }),
});

async function expected(project: ReturnType<typeof projectWith>) {
  const text = serializeProject(project);
  return { text, sha256: await sha256Hex(text) };
}

/** Counts page-side (fallback) runs. */
function pageFallback() {
  const calls: string[] = [];
  const fallback: SnapshotPreparer = async (project, limits) => {
    calls.push(project.metadata.id);
    const text = serializeProject(project, limits);
    return { text, sha256: await sha256Hex(text) };
  };
  return { fallback, calls };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("createWorkerSnapshotPreparer", () => {
  it("prepares in the worker, with exactly the page's result", async () => {
    const worker = fakeWorker();
    const page = pageFallback();
    const preparer = createWorkerSnapshotPreparer({
      createWorker: () => worker.port,
      fallback: page.fallback,
    });
    const project = projectWith("Hello");
    expect(await preparer.prepare(project, DEFAULT_PROJECT_LIMITS)).toEqual(
      await expected(project),
    );
    expect(worker.received).toHaveLength(1);
    expect(page.calls).toEqual([]);
    expect(preparer.usesWorker()).toBe(true);
  });

  it("snapshots the state at the moment of the request, whatever happens to it next", async () => {
    const worker = fakeWorker("manual");
    const preparer = createWorkerSnapshotPreparer({
      createWorker: () => worker.port,
    });
    const document: EditorElementNode = pageWith({
      id: "h",
      tag: "h1",
      text: "Before",
    });
    const pending = preparer.prepare(
      { metadata, document },
      DEFAULT_PROJECT_LIMITS,
    );
    // Not something the editor does (its state is immutable), but the
    // worker must not depend on that.
    const heading = document.children?.[0];
    if (heading) heading.text = "After";
    await worker.answer(worker.received[0]);
    expect((await pending).text).toContain('"Before"');
  });

  it("matches answers to their own requests, even out of order", async () => {
    const worker = fakeWorker("manual");
    const preparer = createWorkerSnapshotPreparer({
      createWorker: () => worker.port,
    });
    const first = preparer.prepare(
      projectWith("First"),
      DEFAULT_PROJECT_LIMITS,
    );
    const second = preparer.prepare(
      projectWith("Second"),
      DEFAULT_PROJECT_LIMITS,
    );
    await worker.answer(worker.received[1]);
    await worker.answer(worker.received[0]);
    expect((await first).text).toContain('"First"');
    expect((await second).text).toContain('"Second"');
  });

  it("fails an unwritable project exactly as the page would, and keeps the worker", async () => {
    const worker = fakeWorker();
    const page = pageFallback();
    const preparer = createWorkerSnapshotPreparer({
      createWorker: () => worker.port,
      fallback: page.fallback,
    });
    const broken = {
      metadata,
      document: pageWith({
        id: "d",
        tag: "div",
        transform: { scale: Number.NaN },
      }),
    };
    await expect(
      preparer.prepare(broken, DEFAULT_PROJECT_LIMITS),
    ).rejects.toBeInstanceOf(ProjectSerializationError);
    expect(page.calls).toEqual([]);
    expect(preparer.usesWorker()).toBe(true);
  });

  it("does the work on the page when the worker can't (e.g. no Web Crypto there), from then on", async () => {
    const worker = fakeWorker("manual");
    const page = pageFallback();
    const preparer = createWorkerSnapshotPreparer({
      createWorker: () => worker.port,
      fallback: page.fallback,
    });
    const project = projectWith("Hello");
    const pending = preparer.prepare(project, DEFAULT_PROJECT_LIMITS);
    worker.send({ id: 0, ok: false, reason: "failed", message: "no crypto" });
    expect(await pending).toEqual(await expected(project));
    expect(worker.terminated()).toBe(true);
    await preparer.prepare(project, DEFAULT_PROJECT_LIMITS);
    expect(page.calls).toHaveLength(2);
    expect(worker.received).toHaveLength(1);
  });

  it("finishes everything a crashed worker owed on the page", async () => {
    const worker = fakeWorker("manual");
    const page = pageFallback();
    const preparer = createWorkerSnapshotPreparer({
      createWorker: () => worker.port,
      fallback: page.fallback,
    });
    const a = preparer.prepare(projectWith("A"), DEFAULT_PROJECT_LIMITS);
    const b = preparer.prepare(projectWith("B"), DEFAULT_PROJECT_LIMITS);
    worker.crash();
    expect((await a).text).toContain('"A"');
    expect((await b).text).toContain('"B"');
    expect(page.calls).toHaveLength(2);
    expect(preparer.usesWorker()).toBe(false);
  });

  it("stops trusting a worker that answers nonsense", async () => {
    const worker = fakeWorker("manual");
    const page = pageFallback();
    const preparer = createWorkerSnapshotPreparer({
      createWorker: () => worker.port,
      fallback: page.fallback,
    });
    const project = projectWith("Hello");
    const pending = preparer.prepare(project, DEFAULT_PROJECT_LIMITS);
    worker.send({ id: 0, ok: true, text: "{}", sha256: "not-a-hash" });
    expect(await pending).toEqual(await expected(project));
    expect(worker.terminated()).toBe(true);
  });

  it("never waits forever: an unanswered request is finished on the page, a late answer ignored", async () => {
    vi.useFakeTimers();
    const worker = fakeWorker("manual");
    const page = pageFallback();
    const preparer = createWorkerSnapshotPreparer({
      createWorker: () => worker.port,
      fallback: page.fallback,
      timeoutMs: 5_000,
    });
    const project = projectWith("Hello");
    const pending = preparer.prepare(project, DEFAULT_PROJECT_LIMITS);
    await vi.advanceTimersByTimeAsync(5_000);
    vi.useRealTimers();
    expect(await pending).toEqual(await expected(project));
    expect(page.calls).toHaveLength(1);
    // The stuck worker answers after all: nothing breaks, nothing doubles.
    await worker.answer(worker.received[0]);
    expect(page.calls).toHaveLength(1);
  });

  it("lets the page decide about a project the worker can't be sent", async () => {
    const worker = fakeWorker();
    const page = pageFallback();
    const preparer = createWorkerSnapshotPreparer({
      createWorker: () => worker.port,
      fallback: page.fallback,
    });
    const document: EditorElementNode = { id: "page-root", tag: "page" };
    Reflect.set(document, "onClick", () => undefined);
    const uncloneable = { metadata, document };
    await expect(
      preparer.prepare(uncloneable, DEFAULT_PROJECT_LIMITS),
    ).rejects.toBeInstanceOf(ProjectSerializationError);
    expect(page.calls).toHaveLength(1);
    // The worker itself is fine and still used.
    await preparer.prepare(projectWith("Next"), DEFAULT_PROJECT_LIMITS);
    expect(worker.received).toHaveLength(1);
  });

  it("works without any worker (none here, or it failed to start)", async () => {
    const page = pageFallback();
    const none = createWorkerSnapshotPreparer({
      createWorker: () => null,
      fallback: page.fallback,
    });
    const throwing = createWorkerSnapshotPreparer({
      createWorker: () => {
        throw new Error("blocked by CSP");
      },
      fallback: page.fallback,
    });
    const project = projectWith("Hello");
    expect(await none.prepare(project, DEFAULT_PROJECT_LIMITS)).toEqual(
      await expected(project),
    );
    expect(await throwing.prepare(project, DEFAULT_PROJECT_LIMITS)).toEqual(
      await expected(project),
    );
    expect(page.calls).toHaveLength(2);
  });

  it("dispose finishes pending work on the page and stops the worker", async () => {
    const worker = fakeWorker("manual");
    const page = pageFallback();
    const preparer = createWorkerSnapshotPreparer({
      createWorker: () => worker.port,
      fallback: page.fallback,
    });
    const pending = preparer.prepare(projectWith("A"), DEFAULT_PROJECT_LIMITS);
    preparer.dispose();
    expect((await pending).text).toContain('"A"');
    expect(worker.terminated()).toBe(true);
  });
});
