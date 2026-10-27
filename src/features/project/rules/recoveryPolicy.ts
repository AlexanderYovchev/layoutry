/**
 * When recovery snapshots are taken and how many are kept (PROJECT-1.4).
 * See docs/architecture/project-recovery.md for the reasoning.
 */

export interface RecoveryTiming {
  /** Quiet time after the last authored change before a snapshot. */
  debounceMs: number;
  /** Longest a change waits during continuous editing. */
  maxWaitMs: number;
  /** Retry after recovery storage failed. */
  retryMs: number;
  /** Re-check while a drag, resize or drawing is in progress. */
  busyRetryMs: number;
}

export const DEFAULT_RECOVERY_TIMING: RecoveryTiming = {
  debounceMs: 2_000,
  maxWaitMs: 30_000,
  retryMs: 30_000,
  busyRetryMs: 500,
};

export interface RecoveryLimits {
  /** Newest snapshots kept for one project in one session. */
  snapshotsPerProject: number;
  /** All records together, in characters of project text. */
  maxTotalSize: number;
  maxRecords: number;
}

/**
 * Browser: 5 versions per project; 128 Mi characters in total, which holds
 * five snapshots of even the largest project the loader accepts (16 Mi
 * characters) with room to spare; real projects are kilobytes to a few
 * megabytes. 100 records bounds the startup scan. The desktop app applies
 * the same policy in bytes (desktop/recovery/recoveryRecord.ts).
 */
export const DEFAULT_RECOVERY_LIMITS: RecoveryLimits = {
  snapshotsPerProject: 5,
  maxTotalSize: 128 * 1024 * 1024,
  maxRecords: 100,
};

export interface RetentionEntry {
  recordId: string;
  sessionId: string;
  projectId: string;
  generation: number;
  /** Milliseconds since the epoch. */
  savedAt: number;
  size: number;
}

/**
 * Which records to delete after `keep` was committed. Pure.
 *
 * 1. The writing session keeps its newest `snapshotsPerProject` snapshots
 *    of each project.
 * 2. Over the global budget, older snapshots go, oldest first: first
 *    those that are neither the newest nor the second newest of their
 *    project, then second-newest ones. The newest snapshot of every
 *    project is never deleted, nor is `keep`, nor anything belonging to
 *    another session that is still running.
 */
export function selectRecordsToEvict(
  records: readonly RetentionEntry[],
  context: {
    ownSessionId: string;
    liveSessionIds: ReadonlySet<string>;
    keep: string;
    limits: RecoveryLimits;
  },
): string[] {
  const { ownSessionId, liveSessionIds, keep, limits } = context;
  const evict = new Set<string>();
  const rank = new Map<string, number>();

  const groups = new Map<string, RetentionEntry[]>();
  for (const record of records) {
    const key = `${record.sessionId}/${record.projectId}`;
    const group = groups.get(key);
    if (group) group.push(record);
    else groups.set(key, [record]);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => b.generation - a.generation);
    group.forEach((record, index) => {
      rank.set(record.recordId, index);
      if (
        record.sessionId === ownSessionId &&
        index >= limits.snapshotsPerProject &&
        record.recordId !== keep
      )
        evict.add(record.recordId);
    });
  }

  const remaining = records.filter((record) => !evict.has(record.recordId));
  let totalSize = remaining.reduce((sum, record) => sum + record.size, 0);
  let count = remaining.length;
  const overBudget = () =>
    totalSize > limits.maxTotalSize || count > limits.maxRecords;
  if (!overBudget()) return [...evict];

  const tier = (record: RetentionEntry) =>
    (rank.get(record.recordId) ?? 0) >= 2 ? 0 : 1;
  const candidates = remaining
    .filter(
      (record) =>
        record.recordId !== keep &&
        (rank.get(record.recordId) ?? 0) >= 1 &&
        (record.sessionId === ownSessionId ||
          !liveSessionIds.has(record.sessionId)),
    )
    .sort((a, b) => tier(a) - tier(b) || a.savedAt - b.savedAt);
  for (const record of candidates) {
    if (!overBudget()) break;
    evict.add(record.recordId);
    totalSize -= record.size;
    count -= 1;
  }
  return [...evict];
}
