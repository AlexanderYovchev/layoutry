import { describe, expect, it } from "vitest";
import {
  DEFAULT_RECOVERY_LIMITS,
  DEFAULT_RECOVERY_TIMING,
  selectRecordsToEvict,
  type RetentionEntry,
} from "@/features/project/rules/recoveryPolicy";
import { DEFAULT_PROJECT_LIMITS } from "@/features/project/rules/projectLimits";

const OWN = "a".repeat(32);
const ENDED = "b".repeat(32);
const RUNNING = "c".repeat(32);
const limits = { snapshotsPerProject: 5, maxTotalSize: 1000, maxRecords: 100 };

function entry(
  sessionId: string,
  generation: number,
  size = 10,
  projectId = "p",
): RetentionEntry {
  return {
    recordId: `${sessionId}-${generation}`,
    sessionId,
    projectId,
    generation,
    savedAt: generation * 1000,
    size,
  };
}

describe("recovery policy", () => {
  it("uses the documented timing", () => {
    expect(DEFAULT_RECOVERY_TIMING).toEqual({
      debounceMs: 2000,
      maxWaitMs: 30000,
      retryMs: 30000,
      busyRetryMs: 500,
    });
  });

  it("holds five snapshots of the largest loadable project", () => {
    expect(DEFAULT_RECOVERY_LIMITS.maxTotalSize).toBeGreaterThanOrEqual(
      5 * DEFAULT_PROJECT_LIMITS.maxFileCharacters,
    );
  });

  it("keeps the writing session's newest five per project", () => {
    const records = [1, 2, 3, 4, 5, 6].map((g) => entry(OWN, g));
    expect(
      selectRecordsToEvict(records, {
        ownSessionId: OWN,
        liveSessionIds: new Set([OWN]),
        keep: `${OWN}-6`,
        limits,
      }),
    ).toEqual([`${OWN}-1`]);
  });

  it("over budget: oldest redundant first, never a project's newest, never a running tab's", () => {
    const records = [
      ...[1, 2, 3].map((g) => entry(ENDED, g, 300)),
      ...[1, 2, 3].map((g) => entry(RUNNING, g, 300)),
      entry(OWN, 1, 300),
    ];
    const evicted = selectRecordsToEvict(records, {
      ownSessionId: OWN,
      liveSessionIds: new Set([OWN, RUNNING]),
      keep: `${OWN}-1`,
      limits,
    });
    expect(evicted).toEqual([`${ENDED}-1`, `${ENDED}-2`]);
  });
});
