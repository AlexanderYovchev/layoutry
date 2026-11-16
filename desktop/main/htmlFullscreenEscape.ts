import type { Input } from "electron";

export type EscapeInput = Pick<Input, "type" | "key">;

/** The parts of BrowserWindow this module uses. */
export interface FullscreenWindow {
  on(event: "enter-html-full-screen" | "leave-html-full-screen", listener: () => void): unknown;
  setFullScreen(flag: boolean): void;
  webContents: { on(event: "before-input-event", listener: (event: { preventDefault(): void }, input: EscapeInput) => void): unknown };
}

/** Whether this key press should end an element's (HTML) fullscreen. */
export function isFullscreenEscape(input: EscapeInput, inHtmlFullScreen: boolean): boolean {
  return inHtmlFullScreen && input.type === "keyDown" && input.key === "Escape";
}

export interface HtmlFullscreenControl {
  /** A fullscreen request was granted to the player frames with these names. */
  granted(frameNames: readonly string[]): void;
  /** A player frame went away (its registration ended). */
  playerRemoved(frameName: string): void;
}

/**
 * Element (HTML) fullscreen in the main window (BC-08.4).
 *
 * - Escape leaves it. A browser does this in its own UI; Electron does
 *   not. While an element is fullscreen, Escape is consumed here (so it
 *   does not also leave Preview, as in a browser) and the window returns to
 *   its normal size, which ends the element's fullscreen. Every other key
 *   passes through.
 * - A removed player never leaves the window stuck. When the fullscreen
 *   player is removed (Preview exit, hidden, ancestor hidden, project
 *   change), the page leaves fullscreen but Electron intermittently never
 *   receives the exit (verified: no leave-html-full-screen, window still
 *   fullscreen). So when the player that was granted fullscreen is
 *   unregistered while the window is still in element fullscreen, the
 *   window is returned to normal here.
 * Only element fullscreen is affected; the window's own state is untouched.
 */
export function installHtmlFullscreenControl(window: FullscreenWindow): HtmlFullscreenControl {
  let inHtmlFullScreen = false;
  let grantedNames: ReadonlySet<string> = new Set();
  window.on("enter-html-full-screen", () => {
    inHtmlFullScreen = true;
  });
  window.on("leave-html-full-screen", () => {
    inHtmlFullScreen = false;
    grantedNames = new Set();
  });
  window.webContents.on("before-input-event", (event, input) => {
    if (!isFullscreenEscape(input, inHtmlFullScreen)) return;
    event.preventDefault();
    window.setFullScreen(false);
  });
  return {
    granted(frameNames) {
      grantedNames = new Set(frameNames);
    },
    playerRemoved(frameName) {
      if (!grantedNames.has(frameName)) return;
      grantedNames = new Set();
      if (inHtmlFullScreen) window.setFullScreen(false);
    },
  };
}
