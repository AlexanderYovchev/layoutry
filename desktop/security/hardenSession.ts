import type { Session } from "electron";

export type HardenableSession = Pick<
  Session,
  | "setPermissionRequestHandler"
  | "setPermissionCheckHandler"
  | "setDevicePermissionHandler"
>;

/**
 * The editor needs no browser permission (its clipboard is editor state,
 * not the OS clipboard), so every request and check is denied — camera,
 * microphone, geolocation, notifications, fullscreen, openExternal, device
 * access, and anything an authored iframe might ask for. Add an explicit,
 * reviewed allowance here if a future feature genuinely needs one.
 */
export function hardenSession(session: HardenableSession): void {
  session.setPermissionRequestHandler((_webContents, _permission, callback) =>
    callback(false),
  );
  session.setPermissionCheckHandler(() => false);
  session.setDevicePermissionHandler(() => false);
}
