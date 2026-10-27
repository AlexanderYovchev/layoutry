import { describe, expect, it } from "vitest";
import { DEFAULT_PROJECT_LIMITS } from "@/features/project/rules/projectLimits";
import { pageWith } from "@/features/project/utils/projectTestDocuments";
import {
  createProjectMetadata,
  serializeProject,
} from "@/features/project/utils/serializeProject";
import { sha256Hex } from "@/features/project/utils/sha256Hex";
import { handleSnapshotRequest } from "@/features/project/workers/snapshotWorkerProtocol";

const project = {
  metadata: createProjectMetadata({ id: "worker-1", name: "Worker" }),
  document: pageWith({ id: "h", tag: "h1", text: "Hello" }),
};

describe("handleSnapshotRequest (the worker's job)", () => {
  it("produces exactly the text and hash the page would", async () => {
    const response = await handleSnapshotRequest({
      id: 7,
      project: structuredClone(project),
      limits: DEFAULT_PROJECT_LIMITS,
    });
    const text = serializeProject(project);
    expect(response).toEqual({
      id: 7,
      ok: true,
      text,
      sha256: await sha256Hex(text),
    });
  });

  it("reports a project that can't be written as invalid, like the page", async () => {
    const broken = {
      ...project,
      document: pageWith({
        id: "d",
        tag: "div",
        transform: { scale: Number.POSITIVE_INFINITY },
      }),
    };
    const response = await handleSnapshotRequest({
      id: 1,
      project: broken,
      limits: DEFAULT_PROJECT_LIMITS,
    });
    expect(response).toMatchObject({ id: 1, ok: false, reason: "invalid" });
  });

  it("enforces the limits it was given", async () => {
    const response = await handleSnapshotRequest({
      id: 2,
      project,
      limits: { ...DEFAULT_PROJECT_LIMITS, maxElementNodes: 1 },
    });
    expect(response).toMatchObject({ id: 2, ok: false, reason: "invalid" });
  });

  it("answers a request it can't read as failed, so the page does the work", async () => {
    expect(
      await handleSnapshotRequest({ id: 3, project: "nope", limits: {} }),
    ).toMatchObject({ id: 3, ok: false, reason: "failed" });
    expect(
      await handleSnapshotRequest({
        id: 4,
        project: { ...project, extra: true },
        limits: DEFAULT_PROJECT_LIMITS,
      }),
    ).toMatchObject({ id: 4, ok: false, reason: "failed" });
  });

  it("ignores messages that aren't requests at all", async () => {
    expect(await handleSnapshotRequest(null)).toBeNull();
    expect(await handleSnapshotRequest({ hello: "world" })).toBeNull();
  });

  it("reports a hashing failure (no Web Crypto) as failed, not invalid", async () => {
    const response = await handleSnapshotRequest(
      { id: 5, project, limits: DEFAULT_PROJECT_LIMITS },
      () => Promise.reject(new Error("crypto.subtle is undefined")),
    );
    expect(response).toMatchObject({ id: 5, ok: false, reason: "failed" });
  });
});
