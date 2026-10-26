import type { Input, WebContents } from "electron";

export type ShortcutInput = Pick<
  Input,
  "type" | "key" | "control" | "shift" | "alt" | "meta"
>;

export type DesktopShortcutAction =
  "block-reload" | "toggle-devtools" | "pass-through";

/**
 * A reload would silently discard unsaved changes, and the desktop app has
 * no reload confirmation. Ctrl+R, Ctrl+Shift+R, F5, Shift+F5 and Ctrl+F5 are swallowed
 * before the page sees them. F12 / Ctrl+Shift+I toggle DevTools only when
 * explicitly enabled for development. Everything else — Ctrl+Z, Ctrl+Y,
 * Ctrl+C/X/V/D, Delete, text editing — passes through untouched.
 */
export function classifyDesktopShortcut(
  input: ShortcutInput,
  options: { devToolsEnabled: boolean },
): DesktopShortcutAction {
  if (input.type !== "keyDown") return "pass-through";
  const key = input.key.toLowerCase();

  if (key === "f5") return "block-reload";
  if (input.control && !input.alt && !input.meta && key === "r")
    return "block-reload";

  if (options.devToolsEnabled) {
    if (key === "f12") return "toggle-devtools";
    if (input.control && input.shift && !input.alt && key === "i")
      return "toggle-devtools";
  }
  return "pass-through";
}

export function installDesktopShortcuts(
  contents: Pick<WebContents, "on" | "toggleDevTools">,
  options: { devToolsEnabled: boolean },
): void {
  contents.on("before-input-event", (event, input) => {
    const action = classifyDesktopShortcut(input, options);
    if (action === "pass-through") return;
    event.preventDefault();
    if (action === "toggle-devtools") contents.toggleDevTools();
  });
}
