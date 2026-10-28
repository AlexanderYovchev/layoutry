import { contextBridge, ipcRenderer } from "electron";

/**
 * The desktop bridge (PROJECT-1.3; recovery since PROJECT-1.4; code export
 * since EXPORT-1.4), exposed to the editor page as
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
  beginRecoverySession: "layoutry:recovery:begin-session",
  writeRecoverySnapshot: "layoutry:recovery:write",
  listRecovery: "layoutry:recovery:list",
  readRecovery: "layoutry:recovery:read",
  discardRecovery: "layoutry:recovery:discard",
  chooseExportDestination: "layoutry:export:choose-destination",
  writeExportFiles: "layoutry:export:write",
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

function requireInteger(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isInteger(value))
    throw new TypeError(`${name} must be an integer`);
  return value;
}

/** A fresh object with only the known source fields: nothing else crosses. */
function copySource(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null)
    throw new TypeError("source must be an object");
  const copy: Record<string, string> = {};
  for (const key of ["kind", "revision", "token", "fileName"]) {
    const field: unknown = Reflect.get(value, key);
    if (field !== undefined) copy[key] = requireString(field, key);
  }
  return copy;
}

/** Export files: a fresh array of fresh {path, content} objects, nothing else. */
function copyExportFiles(value: unknown): { path: string; content: string }[] {
  if (!Array.isArray(value)) throw new TypeError("files must be an array");
  return value.map((file: unknown) => {
    if (typeof file !== "object" || file === null)
      throw new TypeError("file must be an object");
    return {
      path: requireString(Reflect.get(file, "path"), "path"),
      content: requireString(Reflect.get(file, "content"), "content"),
    };
  });
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
    apiVersion: 3,
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
    // PROJECT-1.4: recovery snapshots in the app-owned Recovery folder.
    beginRecoverySession: () => ipcRenderer.invoke(INVOKE.beginRecoverySession),
    writeRecoverySnapshot: (snapshot: unknown) => {
      if (typeof snapshot !== "object" || snapshot === null)
        throw new TypeError("snapshot must be an object");
      return ipcRenderer.invoke(INVOKE.writeRecoverySnapshot, {
        generation: requireInteger(
          Reflect.get(snapshot, "generation"),
          "generation",
        ),
        source: copySource(Reflect.get(snapshot, "source")),
        sha256: requireString(Reflect.get(snapshot, "sha256"), "sha256"),
        text: requireString(Reflect.get(snapshot, "text"), "text"),
      });
    },
    listRecovery: () => ipcRenderer.invoke(INVOKE.listRecovery),
    readRecovery: (recordId: unknown, forRestore: unknown) =>
      ipcRenderer.invoke(INVOKE.readRecovery, {
        recordId: requireString(recordId, "recordId"),
        forRestore: requireBoolean(forRestore, "forRestore"),
      }),
    discardRecovery: (recordIds: unknown) => {
      if (!Array.isArray(recordIds))
        throw new TypeError("recordIds must be an array");
      return ipcRenderer.invoke(INVOKE.discardRecovery, {
        recordIds: recordIds.map((id: unknown) =>
          requireString(id, "recordId"),
        ),
      });
    },
    // EXPORT-1.4: generated code, saved natively. Destinations are tokens.
    chooseExportDestination: (mode: unknown, suggestedName: unknown) =>
      ipcRenderer.invoke(INVOKE.chooseExportDestination, {
        mode: requireString(mode, "mode"),
        suggestedName: requireString(suggestedName, "suggestedName"),
      }),
    writeExportFiles: (token: unknown, files: unknown, overwrite: unknown) =>
      ipcRenderer.invoke(INVOKE.writeExportFiles, {
        token: requireString(token, "token"),
        files: copyExportFiles(files),
        overwrite: requireBoolean(overwrite, "overwrite"),
      }),
    onCloseRequested: (listener: unknown) =>
      subscribe(EVENTS.closeRequested, listener),
    onPendingProjectFile: (listener: unknown) =>
      subscribe(EVENTS.pendingProjectFile, listener),
  }),
);
