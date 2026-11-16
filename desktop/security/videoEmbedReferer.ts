import type { Session, WebContents } from "electron";
import { playerRequestHeaders, VIDEO_EMBED_REQUEST_FILTER, type VideoEmbedFrameRegistry } from "./videoEmbedFrames";

export type RefererSession = Pick<Session, "webRequest">;

/**
 * Installs the authorized-player Referer (BC-08.4; the rule and its limits
 * are playerRequestHeaders' doc comment). The listener is registered with
 * a URL filter of the exact player origins, so no other request — editor,
 * generic Embed elsewhere, media, analytics — ever reaches it, and it only
 * acts for the main window's own authorized frames.
 */
export function installVideoEmbedReferer(session: RefererSession, registry: VideoEmbedFrameRegistry, getMainContents: () => WebContents | null): void {
  session.webRequest.onBeforeSendHeaders({ urls: [...VIDEO_EMBED_REQUEST_FILTER] }, (details, callback) => {
    const main = getMainContents();
    const isMainWindow = main !== null && !main.isDestroyed() && details.webContentsId === main.id;
    callback({
      requestHeaders: playerRequestHeaders(registry, isMainWindow ? main.id : undefined, isMainWindow ? main.mainFrame : undefined, {
        resourceType: details.resourceType,
        url: details.url,
        frame: details.frame,
        requestHeaders: details.requestHeaders,
      }),
    });
  });
}
