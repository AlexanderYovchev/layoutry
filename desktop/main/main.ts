import { app, BrowserWindow, dialog, Menu, screen, session } from "electron";
import { existsSync } from "node:fs";
import path from "node:path";
import { APP_ENTRY_URL } from "../protocol/appOrigin";
import {
  handleAppProtocol,
  registerAppSchemePrivileges,
} from "../protocol/registerAppProtocol";
import { hardenSession } from "../security/hardenSession";
import { hardenWebContents } from "../security/hardenWebContents";
import { createCloseGuard } from "./closeGuard";
import { installDesktopShortcuts } from "./desktopShortcuts";
import { outerMinimumForContent } from "./windowSizing";

/**
 * Layoutry desktop shell entry point (ADR-0002). Serves the Next.js static
 * export over app://layoutry/ inside one hardened window. No preload, no
 * IPC, no Node.js in any renderer.
 *
 * Single instance: a second launch never opens a second editor. It hands
 * over to the running instance (which restores and focuses its window,
 * leaving the open document untouched) and exits before `ready`, so it
 * never registers the protocol or creates a window. The lock is scoped to
 * the user-data directory.
 */

const DEFAULT_WINDOW_SIZE = { width: 1440, height: 900 };
// The editor's minimum supported viewport (AppShell shows an "unsupported
// viewport" notice instead of the editor below 900px wide). Applied to the
// window's content area — see outerMinimumForContent.
const MIN_CONTENT_SIZE = { width: 900, height: 600 };

const devToolsEnabled = process.env.LAYOUTRY_DESKTOP_DEVTOOLS === "1";
const exportRoot = path.join(app.getAppPath(), "out");

let mainWindow: BrowserWindow | null = null;

async function confirmDiscardUnsavedDocument(
  window: BrowserWindow,
): Promise<boolean> {
  const { response } = await dialog.showMessageBox(window, {
    type: "warning",
    title: "Layoutry",
    message: "Closing Layoutry will discard any unsaved changes. Continue?",
    detail:
      "Projects saved with File › Save are kept. Unsaved changes are lost.",
    buttons: ["Cancel", "Discard and Close"],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  return response === 1;
}

/** Brings the existing editor forward for a second launch. */
function revealMainWindow(): void {
  const window = mainWindow;
  if (!window || window.isDestroyed()) return;
  // Checked first: on Windows a minimized window reports isVisible() false.
  if (window.isMinimized()) {
    window.restore();
  } else if (!window.isVisible()) {
    // Still starting up: ready-to-show will reveal it.
    return;
  }
  window.focus();
}

function createMainWindow(): BrowserWindow {
  const workArea = screen.getPrimaryDisplay().workAreaSize;
  const window = new BrowserWindow({
    title: "Layoutry",
    width: Math.min(DEFAULT_WINDOW_SIZE.width, workArea.width),
    height: Math.min(DEFAULT_WINDOW_SIZE.height, workArea.height),
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
      devTools: devToolsEnabled,
    },
  });

  // minWidth/minHeight would constrain the outer window, letting the
  // viewport shrink below the editor's floor by the frame's size (884px
  // at 100% scaling) and replacing the editor with its "unsupported
  // viewport" notice. Size the outer minimum from the actual frame.
  const [outerWidth, outerHeight] = window.getSize();
  const [contentWidth, contentHeight] = window.getContentSize();
  const minimum = outerMinimumForContent(
    MIN_CONTENT_SIZE,
    { width: outerWidth, height: outerHeight },
    { width: contentWidth, height: contentHeight },
  );
  window.setMinimumSize(minimum.width, minimum.height);

  installDesktopShortcuts(window.webContents, { devToolsEnabled });

  const closeGuard = createCloseGuard({
    confirmDiscard: () => confirmDiscardUnsavedDocument(window),
    closeWindow: () => window.close(),
  });
  window.on("close", closeGuard.handleCloseRequest);
  // The page asks for confirmation (beforeunload) while it has unsaved
  // changes. Electron shows no dialog for that and would silently keep the
  // window open; the close guard above has already asked, so let it unload.
  window.webContents.on("will-prevent-unload", (event) => {
    event.preventDefault();
  });
  window.on("session-end", closeGuard.allowClose);
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = null;
  });

  // Show on first paint — or on a failed load, so a broken start is never
  // an invisible window holding the process (and the single-instance lock).
  window.once("ready-to-show", () => window.show());
  window.webContents.on(
    "did-fail-load",
    (_event, _code, _description, _url, isMainFrame) => {
      if (isMainFrame && !window.isDestroyed()) window.show();
    },
  );
  window.loadURL(APP_ENTRY_URL).catch((error: unknown) => {
    console.error("Layoutry failed to load its editor:", error);
  });
  return window;
}

function startLayoutry(): void {
  registerAppSchemePrivileges();
  app.enableSandbox();

  app.on("web-contents-created", (_event, contents) => {
    hardenWebContents(contents);
  });
  app.on("second-instance", revealMainWindow);
  app.on("window-all-closed", () => {
    app.quit();
  });

  app
    .whenReady()
    .then(() => {
      if (!existsSync(path.join(exportRoot, "index.html"))) {
        dialog.showErrorBox(
          "Layoutry",
          `The desktop frontend has not been built (missing ${exportRoot}). Run "npm run desktop:build" first.`,
        );
        app.quit();
        return;
      }

      // No application menu: removes Electron's default Reload, Force
      // Reload, DevTools and zoom accelerators. Text editing shortcuts are
      // handled by Chromium itself and keep working.
      Menu.setApplicationMenu(null);
      hardenSession(session.defaultSession);
      handleAppProtocol(exportRoot);
      mainWindow = createMainWindow();
    })
    .catch((error: unknown) => {
      console.error("Layoutry failed to start:", error);
      app.exit(1);
    });
}

if (app.requestSingleInstanceLock()) {
  startLayoutry();
} else {
  app.quit();
}
