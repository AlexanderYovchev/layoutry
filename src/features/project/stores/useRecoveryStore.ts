import { create } from "zustand";

/**
 * Recovery protection as the header shows it (PROJECT-1.4). UI state only.
 * - `off`: no recovery here (not started, or tests);
 * - `idle`: running; nothing unsaved to protect;
 * - `pending`: unsaved changes not captured yet (a snapshot is scheduled);
 * - `protected`: the latest unsaved changes have a recovery copy;
 * - `unavailable`: recovery storage failed or isn't supported; `message` says why.
 */
export type RecoveryStatus =
  "off" | "idle" | "pending" | "protected" | "unavailable";

interface RecoveryState {
  status: RecoveryStatus;
  message: string | null;
  setStatus: (status: RecoveryStatus, message?: string | null) => void;
}

export const useRecoveryStore = create<RecoveryState>()((set) => ({
  status: "off",
  message: null,
  setStatus: (status, message = null) =>
    set((state) =>
      state.status === status && state.message === message
        ? state
        : { status, message },
    ),
}));
