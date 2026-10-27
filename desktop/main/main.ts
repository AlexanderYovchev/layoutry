import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  screen,
  session,
} from "electron";
import { existsSync } from "node:fs";
import path from "node:path";
import { FileCapabilityRegistry } from "../files/fileCapabilities";
import { projectFilesFromArguments } from "../files/launchArguments";
import { createProjectFileService } from "../files/projectFileService";
import { EVENT_CHANNELS } from "../ipc/channels";
import { registerDesktopIpc } from "../ipc/registerDesktopIpc";
import { APP_ENTRY_URL } from "../protocol/appOrigin";
import {
  createRecoveryService,
  type RecoveryService,
} from "../recovery/recoveryService";
import { createRecoveryStore } from "../recovery/recoveryStore";
import {
  handleAppProtocol,
  registerAppSchemePrivileges,
} from "../protocol/registerAppProtocol";
import { hardenSession } from "../security/hardenSession";
import { hardenWebContents } from "../security/hardenWebContents";
import {
  createCloseCoordinator,
  type CloseCoordinator,
} from "./closeCoordinator";
import { createCloseGuard } from "./closeGuard";
import { installDesktopShortcuts } from "./desktopShortcuts";
import { outerMinimumForContent } from "./windowSizing";

/**
 * Layoutry desktop shell entry point (ADR-0002). Serves the Next.js static
 * export over app://layoutry/ inside one hardened window. No Node.js in any
 * renderer: the editor page gets a sandboxed preload exposing a fixed,
 * validated project-file API (PROJECT-1.3, desktop/ipc/channels.ts), and
 * only ever holds opaque file tokens, never paths. Recovery snapshots of
 * unsaved work (PROJECT-1.4) go to an app-owned Recovery folder in the
 * profile, through the same kind of fixed, validated channels.
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
let closeCoordinator: CloseCoordinator | null = null;
let recoveryService: RecoveryService | null = null;

const PROJECT_FILE_FILTERS = [
  { name: "Layoutry Project", extensions: ["layoutry"] },
];

const fileCapabilities = new FileCapabilityRegistry();
const projectFiles = createProjectFileService({
  registry: fileCapabilities,
  defaultFolder: () => app.getPath("documents"),
  showOpenDialog: async (defaultFolder) => {
    const window = mainWindow;
    if (!window) return null;
    const result = await dialog.showOpenDialog(window, {
      title: "Open Project",
      defaultPath: defaultFolder ?? app.getPath("documents"),
      filters: PROJECT_FILE_FILTERS,
      properties: ["openFile"],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  },
  showSaveDialog: async (defaultPath) => {
    const window = mainWindow;
    if (!window) return null;
    const result = await dialog.showSaveDialog(window, {
      title: "Save Project",
      defaultPath,
      filters: PROJECT_FILE_FILTERS,
      properties: ["showOverwriteConfirmation"],
    });
    return result.canceled ? null : (result.filePath ?? null);
  },
});

/** Queues .layoutry files from a command line and tells the editor. */
function queueProjectFilesFrom(argv: readonly string[], cwd: string): void {
  let queued = false;
  for (const file of projectFilesFromArguments(argv, cwd))
    queued = projectFiles.queueExternalOpen(file) || queued;
  const window = mainWindow;
  if (queued && window && !window.isDestroyed())
    window.webContents.send(EVENT_CHANNELS.pendingProjectFile);
}

async function confirmDiscardUnsavedDocument(
  window: BrowserWindow,
): Promise<boolean> {
  const { response } = await dialog.showMessageBox(window, {
    type: "warning",
    title: "Layoutry",
    message: "Closing Layoutry will discard any unsaved changes. Continue?",
    detail:
      "Projects saved with File › Save are kept. Changes Layoutry captured for recovery are offered the next time it starts; anything newer is lost.",
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
      // Runs in the main frame only (no Node.js; sandboxed).
      preload: path.join(__dirname, "..", "preload", "preload.js"),
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

  const coordinator = createCloseCoordinator({
    requestPageDecision: () => {
      if (!window.isDestroyed())
        window.webContents.send(EVENT_CHANNELS.closeRequested);
    },
    fallback: () => confirmDiscardUnsavedDocument(window),
  });
  closeCoordinator = coordinator;
  const closeGuard = createCloseGuard({
    confirmDiscard: coordinator.decide,
    closeWindow: () => window.close(),
  });
  window.on("close", closeGuard.handleCloseRequest);
  // Once closing is approved, never let a page beforeunload handler keep
  // the window open silently (Electron shows no dialog for it).
  window.webContents.on("will-prevent-unload", (event) => {
    event.preventDefault();
  });
  // A crashed or hung page can't answer a close request: fall back to the
  // native dialog. Its file tokens die with it.
  const ownerId = window.webContents.id;
  window.webContents.on("render-process-gone", () => {
    coordinator.pageLost();
    fileCapabilities.revokeOwner(ownerId);
    // Its recovery snapshots are now orphaned: offered at the next start.
    recoveryService?.endSession(ownerId);
  });
  window.on("unresponsive", () => coordinator.pageLost());
  window.on("session-end", closeGuard.allowClose);
  window.on("closed", () => {
    fileCapabilities.revokeOwner(ownerId);
    recoveryService?.endSession(ownerId);
    if (mainWindow === window) mainWindow = null;
    if (closeCoordinator === coordinator) closeCoordinator = null;
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
  app.on("second-instance", (_event, argv, workingDirectory) => {
    revealMainWindow();
    queueProjectFilesFrom(argv, workingDirectory);
  });
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
      // PROJECT-1.4: recovery snapshots in an app-owned folder of the
      // profile, never next to the user's files or in the app folder.
      const recovery = createRecoveryService({
        store: createRecoveryStore({
          directory: path.join(app.getPath("userData"), "Recovery"),
        }),
        registry: fileCapabilities,
      });
      recoveryService = recovery;
      // Creates the folder and clears interrupted writes early.
      recovery.ready().catch((error: unknown) => {
        console.error("Layoutry recovery folder unavailable:", error);
      });
      registerDesktopIpc({
        ipcMain,
        getMainWindow: () => mainWindow,
        files: projectFiles,
        close: {
          reportUnsaved: (value) => closeCoordinator?.reportUnsaved(value),
          respond: (close) => closeCoordinator?.respond(close),
        },
        recovery,
      });
      // Files named on Layoutry's own command line open once the editor asks.
      queueProjectFilesFrom(process.argv, process.cwd());
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
