/**
 * Which browser editor sessions are still running (PROJECT-1.4). Each tab
 * holds a Web Lock named after its recovery session for as long as the
 * page lives; the browser releases it when the tab closes or crashes. A
 * session whose lock is free has ended, so its snapshots can be offered.
 * A tab offering ended sessions holds their locks too, so no other tab
 * offers the same work at the same time.
 */
export interface RecoveryLocks {
  /** Holds `name` until the returned release is called; null when it is held elsewhere. */
  tryHold(name: string): Promise<(() => void) | null>;
  /** Names currently held or requested by any tab of this origin. */
  heldNames(): Promise<ReadonlySet<string>>;
}

export const SESSION_LOCK_PREFIX = "layoutry-recovery-session:";

/** navigator.locks (secure contexts only), or null. */
export function webRecoveryLocks(): RecoveryLocks | null {
  if (typeof navigator === "undefined" || !("locks" in navigator)) return null;
  const locks = navigator.locks;
  return {
    tryHold(name) {
      return new Promise((resolve, reject) => {
        locks
          .request(name, { ifAvailable: true }, (lock) => {
            if (!lock) {
              resolve(null);
              return undefined;
            }
            // Held until release() settles this promise.
            return new Promise<void>((release) => resolve(() => release()));
          })
          .catch(reject);
      });
    },
    async heldNames() {
      const state = await locks.query();
      const names = new Set<string>();
      for (const lock of [...(state.held ?? []), ...(state.pending ?? [])])
        if (lock.name) names.add(lock.name);
      return names;
    },
  };
}

/** In-memory locks shared by simulated tabs (tests). */
export function createMemoryRecoveryLocks() {
  const held = new Set<string>();
  const locks: RecoveryLocks = {
    async tryHold(name) {
      if (held.has(name)) return null;
      held.add(name);
      return () => {
        held.delete(name);
      };
    },
    async heldNames() {
      return new Set(held);
    },
  };
  return {
    locks,
    /** Simulates a tab dying: the browser drops its locks. */
    drop(name: string) {
      held.delete(name);
    },
  };
}
