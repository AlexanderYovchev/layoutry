import type { ProjectFileService } from "../files/projectFileService";
import type { CloseCoordinator } from "../main/closeCoordinator";
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
}

/**
 * Registers the whole desktop IPC surface (PROJECT-1.3): seven fixed
 * channels, each validating its sender and payload. Payload errors reject
 * the call; nothing reaches the filesystem without a valid capability.
 */
export function registerDesktopIpc({
  ipcMain,
  getMainWindow,
  files,
  close,
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
}
