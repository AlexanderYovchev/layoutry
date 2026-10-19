import { net, protocol } from "electron";
import { pathToFileURL } from "node:url";
import { APP_SCHEME } from "./appOrigin";
import { createAppProtocolHandler } from "./appProtocolHandler";

/**
 * Must run before the app's `ready` event. `standard` gives app:// normal
 * URL resolution (root-absolute `/_next/...` paths resolve against
 * app://layoutry/) and a stable origin for localStorage; `secure` makes it
 * a secure context; `supportFetchAPI` lets the bundle fetch its own files.
 * Deliberately NOT bypassCSP, corsEnabled, or allowServiceWorkers.
 */
export function registerAppSchemePrivileges(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true },
    },
  ]);
}

/** Must run after `ready`. */
export function handleAppProtocol(exportRoot: string): void {
  protocol.handle(
    APP_SCHEME,
    createAppProtocolHandler({
      exportRoot,
      fetchFile: (filePath) => net.fetch(pathToFileURL(filePath).toString()),
    }),
  );
}
