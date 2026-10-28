import type { ExportFileService } from "../export/exportFileService";
import type { ProjectFileService } from "../files/projectFileService";
import type { CloseCoordinator } from "../main/closeCoordinator";
import type { RecoveryService } from "../recovery/recoveryService";
import { APP_ORIGIN } from "../protocol/appOrigin";
import { INVOKE_CHANNELS } from "./channels";

/** The parts of Electron's invoke event this module relies on. */
export interface DesktopIpcEvent {
  sender: { id: number; mainFrame: unknown };
  senderFrame: { url: string } | null;
}

/** The parts of BrowserWindow this module relies on. */
export interface DesktopIpcWindow {
  isDestroyed(): boolean;
  webContents: unknown;
}

export interface DesktopIpcRegistry {
  handle(
    channel: string,
    listener: (event: DesktopIpcEvent, ...args: unknown[]) => unknown,
  ): void;
}

/**
 * Only the editor itself may call the desktop API: the main window's top
 * frame, showing app://layoutry/. Authored iframes (other origins, no
 * preload), other windows and navigated-away pages are refused.
 */
export function isTrustedSender(
  event: DesktopIpcEvent,
  window: DesktopIpcWindow | null,
): boolean {
  if (!window || window.isDestroyed()) return false;
  if (event.sender !== window.webContents) return false;
  const frame = event.senderFrame;
  if (!frame || frame !== event.sender.mainFrame) return false;
  return frame.url.startsWith(`${APP_ORIGIN}/`);
}

export interface DesktopIpcOptions {
  ipcMain: DesktopIpcRegistry;
  getMainWindow: () => DesktopIpcWindow | null;
  files: Pick<
    ProjectFileService,
    "open" | "takePending" | "chooseSaveLocation" | "write" | "release"
  >;
  close: Pick<CloseCoordinator, "reportUnsaved" | "respond">;
  recovery: Pick<
    RecoveryService,
    "beginSession" | "write" | "list" | "read" | "discard"
  >;
  /** EXPORT-1.4: native saving of generated code, with its own tokens. */
  exportFiles: Pick<ExportFileService, "chooseDestination" | "write">;
}

/**
 * Registers the whole desktop IPC surface (PROJECT-1.3): fourteen fixed
 * channels (five for recovery since PROJECT-1.4, two for code export since
 * EXPORT-1.4), each validating its sender and payload. Payload errors reject
 * the call; nothing reaches the filesystem without a valid capability.
 */
export function registerDesktopIpc({
  ipcMain,
  getMainWindow,
  files,
  close,
  recovery,
  exportFiles,
}: DesktopIpcOptions): void {
  function handle(
    channel: string,
    handler: (ownerId: number, payload: unknown) => unknown,
  ) {
    ipcMain.handle(channel, (event, ...args: unknown[]) => {
      if (!isTrustedSender(event, getMainWindow()))
        throw new Error("Layoutry desktop API: caller not allowed");
      if (args.length > 1)
        throw new Error("Layoutry desktop API: unexpected arguments");
      return handler(event.sender.id, args[0]);
    });
  }

  function expectNoPayload(payload: unknown) {
    if (payload !== undefined)
      throw new Error("Layoutry desktop API: unexpected payload");
  }

  function expectBooleanField(payload: unknown, key: string): boolean {
    if (
      typeof payload !== "object" ||
      payload === null ||
      Object.keys(payload).length !== 1 ||
      typeof Reflect.get(payload, key) !== "boolean"
    )
      throw new Error(`Layoutry desktop API: expected {${key}: boolean}`);
    return Reflect.get(payload, key) === true;
  }

  handle(INVOKE_CHANNELS.openProjectFile, (owner, payload) => {
    expectNoPayload(payload);
    return files.open(owner);
  });
  handle(INVOKE_CHANNELS.takePendingProjectFile, (owner, payload) => {
    expectNoPayload(payload);
    return files.takePending(owner);
  });
  handle(INVOKE_CHANNELS.chooseSaveLocation, (owner, payload) =>
    files.chooseSaveLocation(owner, payload),
  );
  handle(INVOKE_CHANNELS.writeProjectFile, (owner, payload) =>
    files.write(owner, payload),
  );
  handle(INVOKE_CHANNELS.releaseProjectFile, (owner, payload) =>
    files.release(owner, payload),
  );
  handle(INVOKE_CHANNELS.setUnsavedChanges, (_owner, payload) => {
    close.reportUnsaved(expectBooleanField(payload, "unsaved"));
  });
  handle(INVOKE_CHANNELS.respondToCloseRequest, (_owner, payload) => {
    close.respond(expectBooleanField(payload, "close"));
  });
  handle(INVOKE_CHANNELS.beginRecoverySession, (owner, payload) =>
    recovery.beginSession(owner, payload),
  );
  handle(INVOKE_CHANNELS.writeRecoverySnapshot, (owner, payload) =>
    recovery.write(owner, payload),
  );
  handle(INVOKE_CHANNELS.listRecovery, (owner, payload) =>
    recovery.list(owner, payload),
  );
  handle(INVOKE_CHANNELS.readRecovery, (owner, payload) =>
    recovery.read(owner, payload),
  );
  handle(INVOKE_CHANNELS.discardRecovery, (owner, payload) =>
    recovery.discard(owner, payload),
  );
  handle(INVOKE_CHANNELS.chooseExportDestination, (owner, payload) =>
    exportFiles.chooseDestination(owner, payload),
  );
  handle(INVOKE_CHANNELS.writeExportFiles, (owner, payload) =>
    exportFiles.write(owner, payload),
  );
}
