import { contextBridge, ipcRenderer } from "electron";

/**
 * The desktop bridge (PROJECT-1.3), exposed to the editor page as
 * `window.layoutryDesktop`. Sandboxed preload: it may only require
 * "electron", so it is self-contained — channel names repeat
 * desktop/ipc/channels.ts (kept in sync by a test).
 *
 * The page gets a fixed set of functions, never ipcRenderer itself, never a
 * path and never Node.js. Arguments are checked here and again, strictly,
 * in the main process. Listeners receive no event object.
 */

const INVOKE = {
  openProjectFile: "layoutry:project-file:open",
  takePendingProjectFile: "layoutry:project-file:take-pending",
  chooseSaveLocation: "layoutry:project-file:choose-save-location",
  writeProjectFile: "layoutry:project-file:write",
  releaseProjectFile: "layoutry:project-file:release",
  setUnsavedChanges: "layoutry:window:set-unsaved",
  respondToCloseRequest: "layoutry:window:close-response",
} as const;

const EVENTS = {
  closeRequested: "layoutry:window:close-requested",
  pendingProjectFile: "layoutry:project-file:pending",
} as const;

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string")
    throw new TypeError(`${name} must be a string`);
  return value;
}

function requireBoolean(value: unknown, name: string): boolean {
  if (typeof value !== "boolean")
    throw new TypeError(`${name} must be a boolean`);
  return value;
}

function subscribe(channel: string, listener: unknown): () => void {
  if (typeof listener !== "function")
    throw new TypeError("listener must be a function");
  const forward = () => {
    listener();
  };
  ipcRenderer.on(channel, forward);
  return () => {
    ipcRenderer.removeListener(channel, forward);
  };
}

contextBridge.exposeInMainWorld(
  "layoutryDesktop",
  Object.freeze({
    apiVersion: 1,
    openProjectFile: () => ipcRenderer.invoke(INVOKE.openProjectFile),
    takePendingProjectFile: () =>
      ipcRenderer.invoke(INVOKE.takePendingProjectFile),
    chooseSaveLocation: (suggestedName: unknown) =>
      ipcRenderer.invoke(INVOKE.chooseSaveLocation, {
        suggestedName: requireString(suggestedName, "suggestedName"),
      }),
    writeProjectFile: (token: unknown, text: unknown, force: unknown) =>
      ipcRenderer.invoke(INVOKE.writeProjectFile, {
        token: requireString(token, "token"),
        text: requireString(text, "text"),
        force: requireBoolean(force, "force"),
      }),
    releaseProjectFile: (token: unknown) =>
      ipcRenderer.invoke(INVOKE.releaseProjectFile, {
        token: requireString(token, "token"),
      }),
    setUnsavedChanges: (unsaved: unknown) =>
      ipcRenderer.invoke(INVOKE.setUnsavedChanges, {
        unsaved: requireBoolean(unsaved, "unsaved"),
      }),
    respondToCloseRequest: (close: unknown) =>
      ipcRenderer.invoke(INVOKE.respondToCloseRequest, {
        close: requireBoolean(close, "close"),
      }),
    onCloseRequested: (listener: unknown) =>
      subscribe(EVENTS.closeRequested, listener),
    onPendingProjectFile: (listener: unknown) =>
      subscribe(EVENTS.pendingProjectFile, listener),
  }),
);
