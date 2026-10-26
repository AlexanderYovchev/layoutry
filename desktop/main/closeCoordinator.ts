/**
 * Decides whether the window may close (PROJECT-1.3). Once the page's
 * desktop bridge has reported its unsaved state, the page decides: a clean
 * project closes at once; a project with unsaved changes gets the editor's
 * own Save / Don't Save / Cancel dialog, and the page answers when the user
 * has chosen (and any save has finished). The native discard dialog
 * (`fallback`) is used only when the page can't answer: it never loaded its
 * bridge, crashed, or hung.
 *
 * Plugged into createCloseGuard as `confirmDiscard`, which already absorbs
 * repeated close requests while a decision is pending.
 */
export interface CloseCoordinatorOptions {
  /** Sends the close request to the page. */
  requestPageDecision: () => void;
  /** The native "discard unsaved changes?" dialog. */
  fallback: () => Promise<boolean>;
}

export function createCloseCoordinator({
  requestPageDecision,
  fallback,
}: CloseCoordinatorOptions) {
  let bridgeReady = false;
  let unsaved = false;
  let pending: ((close: boolean) => void) | null = null;

  function settle(close: boolean) {
    const resolve = pending;
    pending = null;
    resolve?.(close);
  }

  return {
    /** The page reported its state (unsaved changes, or a save in flight). */
    reportUnsaved(value: boolean) {
      bridgeReady = true;
      unsaved = value;
    },

    decide(): Promise<boolean> {
      if (!bridgeReady) return fallback();
      if (!unsaved) return Promise.resolve(true);
      return new Promise<boolean>((resolve) => {
        pending = resolve;
        requestPageDecision();
      });
    },

    /** The page's answer. Ignored when no decision was asked for. */
    respond(close: boolean) {
      settle(close);
    },

    /**
     * The page crashed, hung or navigated away: it can no longer answer or
     * report. A pending decision falls back to the native dialog.
     */
    pageLost() {
      bridgeReady = false;
      if (pending) {
        const resolve = pending;
        pending = null;
        fallback().then(resolve, () => resolve(false));
      }
    },
  };
}

export type CloseCoordinator = ReturnType<typeof createCloseCoordinator>;
