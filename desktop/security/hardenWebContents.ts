import type { WebContents } from "electron";
import {
  isAllowedSubframeNavigation,
  isAllowedTopLevelNavigation,
} from "./navigationPolicy";

export type HardenableWebContents = Pick<
  WebContents,
  "on" | "setWindowOpenHandler"
>;

/**
 * Applied to every WebContents the app creates (main.ts wires it through
 * `web-contents-created`). Untrusted authored content — links, forms,
 * iframes and anything inside them — can never open a window, replace the
 * editor as the top-level page, or embed a <webview>.
 *
 * Popups are denied outright, including http(s) ones: Layoutry has no
 * feature that opens external pages, so nothing is passed to
 * shell.openExternal.
 */
export function hardenWebContents(contents: HardenableWebContents): void {
  contents.setWindowOpenHandler(() => ({ action: "deny" }));

  contents.on("will-navigate", (event) => {
    if (!isAllowedTopLevelNavigation(event.url)) event.preventDefault();
  });

  contents.on("will-redirect", (event) => {
    if (event.isMainFrame && !isAllowedTopLevelNavigation(event.url))
      event.preventDefault();
  });

  contents.on("will-frame-navigate", (event) => {
    if (!event.isMainFrame && !isAllowedSubframeNavigation(event.url))
      event.preventDefault();
  });

  contents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });
}
