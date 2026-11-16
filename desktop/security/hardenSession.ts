import type { Session, WebContents } from "electron";

export type HardenableSession = Pick<
  Session,
  | "setPermissionRequestHandler"
  | "setPermissionCheckHandler"
  | "setDevicePermissionHandler"
>;

export interface HardenSessionOptions {
  /**
   * BC-08.4: the ONE reviewed exception. Asked only for a "fullscreen"
   * request; returns true only for an authorized Video Embed player frame
   * of the main window (see security/videoEmbedFrames.ts).
   */
  isFullscreenAllowed?: (contents: WebContents, details: { isMainFrame: boolean; requestingUrl: string }) => boolean;
}

/**
 * The editor needs no browser permission (its clipboard is editor state,
 * not the OS clipboard), so every request and check is denied — camera,
 * microphone, geolocation, notifications, openExternal, device access,
 * media key systems (DRM), and anything an authored iframe might ask for.
 *
 * Single exception (BC-08.4, approved): a fullscreen REQUEST is granted
 * when `isFullscreenAllowed` says it comes from an authorized Video Embed
 * player. Chromium already requires a user gesture for requestFullscreen.
 * Permission CHECKS stay denied for everything; fullscreen works through
 * the request alone. Add another reviewed allowance here only if a future
 * feature genuinely needs one.
 */
export function hardenSession(session: HardenableSession, options: HardenSessionOptions = {}): void {
  session.setPermissionRequestHandler((webContents, permission, callback, details) => {
    if (permission === "fullscreen" && options.isFullscreenAllowed && webContents) {
      callback(options.isFullscreenAllowed(webContents, { isMainFrame: details.isMainFrame, requestingUrl: details.requestingUrl }));
      return;
    }
    callback(false);
  });
  session.setPermissionCheckHandler(() => false);
  session.setDevicePermissionHandler(() => false);
}
