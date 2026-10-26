import type {
  DesktopChooseResult,
  DesktopOpenResult,
  DesktopProjectFiles,
  DesktopWriteResult,
} from "@/features/project/desktop/desktopProjectFiles";

/**
 * Test double for the desktop bridge, behaving like the main process: an
 * in-memory "disk" keyed by file name, tokens bound to files, version
 * checks on write (external edits and deletions are conflicts), and
 * scriptable native dialogs. Test-only.
 */
export function createFakeDesktopProjectFiles() {
  const disk = new Map<string, string>();
  const tokens = new Map<
    string,
    { fileName: string; version: string | null }
  >();
  const released: string[] = [];
  const closeResponses: boolean[] = [];
  const unsavedReports: boolean[] = [];
  let closeListener: (() => void) | null = null;
  let pendingListener: (() => void) | null = null;
  let nextToken = 0;
  let writeGate: Promise<void> | null = null;

  const script: {
    saveAs: string | null;
    open: string | null;
    pending: string[];
    failWrite: string | null;
  } = {
    /** File name the Save dialog returns, or null for Cancel. */
    saveAs: null,
    /** File name the Open dialog returns, or null for Cancel. */
    open: null,
    /** Files queued by the command line / Explorer / a second launch. */
    pending: [],
    /** Makes the next write fail with this error code. */
    failWrite: null,
  };

  function issue(fileName: string, version: string | null): string {
    nextToken += 1;
    const token = nextToken.toString(16).padStart(32, "0");
    tokens.set(token, { fileName, version });
    return token;
  }

  function openNamed(fileName: string): DesktopOpenResult {
    const text = disk.get(fileName);
    if (text === undefined)
      return {
        status: "error",
        error: {
          code: "not-found",
          message: `“${fileName}” couldn't be found.`,
        },
      };
    return {
      status: "opened",
      file: { token: issue(fileName, text), fileName, text },
    };
  }

  const bridge: DesktopProjectFiles = {
    async openProjectFile() {
      return script.open === null
        ? { status: "cancelled" }
        : openNamed(script.open);
    },
    async takePendingProjectFile() {
      const next = script.pending.shift();
      return next === undefined ? { status: "none" } : openNamed(next);
    },
    async chooseSaveLocation(): Promise<DesktopChooseResult> {
      if (script.saveAs === null) return { status: "cancelled" };
      return {
        status: "chosen",
        target: { token: issue(script.saveAs, null), fileName: script.saveAs },
      };
    },
    async writeProjectFile(token, text, force): Promise<DesktopWriteResult> {
      if (writeGate) await writeGate;
      const capability = tokens.get(token);
      if (!capability)
        return {
          status: "error",
          error: { code: "invalid-token", message: "No access." },
        };
      const { fileName } = capability;
      if (script.failWrite) {
        const code = script.failWrite;
        script.failWrite = null;
        return {
          status: "error",
          error: {
            code,
            message: `“${fileName}” couldn't be saved (${code}).`,
          },
        };
      }
      if (!force && capability.version !== null) {
        const current = disk.get(fileName);
        if (current === undefined)
          return { status: "conflict", reason: "missing", fileName };
        if (current !== capability.version)
          return { status: "conflict", reason: "modified", fileName };
      }
      disk.set(fileName, text);
      capability.version = text;
      return { status: "saved", fileName };
    },
    releaseProjectFile(token) {
      released.push(token);
      tokens.delete(token);
    },
    setUnsavedChanges(unsaved) {
      unsavedReports.push(unsaved);
    },
    respondToCloseRequest(close) {
      closeResponses.push(close);
    },
    onCloseRequested(listener) {
      closeListener = listener;
      return () => (closeListener = null);
    },
    onPendingProjectFile(listener) {
      pendingListener = listener;
      return () => (pendingListener = null);
    },
  };

  return {
    bridge,
    disk,
    script,
    released,
    closeResponses,
    unsavedReports,
    liveTokens: () => [...tokens.keys()],
    requestClose: () => closeListener?.(),
    notifyPending: () => pendingListener?.(),
    /** Holds every write until the returned function is called. */
    holdWrites(): () => void {
      let release!: () => void;
      writeGate = new Promise<void>((resolve) => (release = resolve));
      return () => {
        writeGate = null;
        release();
      };
    },
  };
}

export type FakeDesktopProjectFiles = ReturnType<
  typeof createFakeDesktopProjectFiles
>;
