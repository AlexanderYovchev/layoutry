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

/**
 * Layoutry desktop shell entry point (ADR-0002). Serves the Next.js static
 * export over app://layoutry/ inside one hardened window. No preload, no
 * IPC, no Node.js in any renderer.
 */

const DEFAULT_WINDOW_SIZE = { width: 1440, height: 900 };
// The editor's minimum supported viewport width.
const MIN_WINDOW_SIZE = { width: 900, height: 600 };

const devToolsEnabled = process.env.LAYOUTRY_DESKTOP_DEVTOOLS === "1";
const exportRoot = path.join(app.getAppPath(), "out");

registerAppSchemePrivileges();
app.enableSandbox();

app.on("web-contents-created", (_event, contents) => {
  hardenWebContents(contents);
});

async function confirmDiscardUnsavedDocument(
  window: BrowserWindow,
): Promise<boolean> {
  const { response } = await dialog.showMessageBox(window, {
    type: "warning",
    title: "Layoutry",
    message:
      "Closing Layoutry will discard your current unsaved document. Continue?",
    detail: "Layoutry can't save projects yet.",
    buttons: ["Cancel", "Discard and Close"],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  return response === 1;
}

function createMainWindow(): BrowserWindow {
  const workArea = screen.getPrimaryDisplay().workAreaSize;
  const window = new BrowserWindow({
    title: "Layoutry",
    width: Math.min(DEFAULT_WINDOW_SIZE.width, workArea.width),
    height: Math.min(DEFAULT_WINDOW_SIZE.height, workArea.height),
    minWidth: MIN_WINDOW_SIZE.width,
    minHeight: MIN_WINDOW_SIZE.height,
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

  installDesktopShortcuts(window.webContents, { devToolsEnabled });

  const closeGuard = createCloseGuard({
    confirmDiscard: () => confirmDiscardUnsavedDocument(window),
    closeWindow: () => window.close(),
  });
  window.on("close", closeGuard.handleCloseRequest);
  window.on("session-end", closeGuard.allowClose);

  window.once("ready-to-show", () => window.show());
  void window.loadURL(APP_ENTRY_URL);
  return window;
}

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

    // No application menu: removes Electron's default Reload, Force Reload,
    // DevTools and zoom accelerators. Text editing shortcuts are handled by
    // Chromium itself and keep working.
    Menu.setApplicationMenu(null);
    hardenSession(session.defaultSession);
    handleAppProtocol(exportRoot);
    createMainWindow();
  })
  .catch((error: unknown) => {
    console.error("Layoutry failed to start:", error);
    app.exit(1);
  });
