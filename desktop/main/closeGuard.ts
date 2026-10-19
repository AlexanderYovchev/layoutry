export interface CloseGuardOptions {
  /** Asks the user; resolves true to discard the document and close. */
  confirmDiscard: () => Promise<boolean>;
  /** Re-issues the close once approved. */
  closeWindow: () => void;
}

export interface CloseGuard {
  /** The window's `close` listener. */
  handleCloseRequest: (event: { preventDefault: () => void }) => void;
  /** Lets the next close through without asking (e.g. Windows is shutting down). */
  allowClose: () => void;
}

/**
 * Alpha safeguard while Layoutry cannot save: every close asks before the
 * in-memory document is discarded. Repeated close requests while the
 * dialog is open are absorbed (one dialog, never a stack of them), and an
 * approved close goes through exactly once without asking again.
 */
export function createCloseGuard({
  confirmDiscard,
  closeWindow,
}: CloseGuardOptions): CloseGuard {
  let approved = false;
  let prompting = false;

  return {
    handleCloseRequest(event) {
      if (approved) return;
      event.preventDefault();
      if (prompting) return;

      prompting = true;
      confirmDiscard().then(
        (discard) => {
          prompting = false;
          if (!discard) return;
          approved = true;
          closeWindow();
        },
        () => {
          prompting = false;
        },
      );
    },
    allowClose() {
      approved = true;
    },
  };
}
