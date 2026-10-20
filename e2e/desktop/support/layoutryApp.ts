import {
  _electron,
  expect,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { spawnSync, type ChildProcess } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

export const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
export const EXPORT_ROOT = path.join(REPO_ROOT, "out");

/** Path of the stock development electron.exe from node_modules. */
export function electronBinary(): string {
  const resolved: unknown = createRequire(__filename)("electron");
  if (typeof resolved !== "string") {
    throw new Error("require('electron') did not return the binary path");
  }
  return resolved;
}

/**
 * Network black hole for every launch: all http(s)/ws traffic, including
 * loopback, is routed to a proxy port nothing listens on, so a request
 * the app depended on would fail rather than silently succeed. Chromium
 * switches only — app:// and file:// are unaffected.
 */
export const OFFLINE_SWITCHES = [
  "--proxy-server=http://127.0.0.1:9",
  "--proxy-bypass-list=<-loopback>",
];

/** Environment for launching Electron as an app, never as plain Node.js. */
export function electronEnv(
  extra: Record<string, string> = {},
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (value !== undefined) env[name] = value;
  }
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.LAYOUTRY_DESKTOP_DEVTOOLS;
  return { ...env, ...extra };
}

/** The same environment for node:child_process (which skips undefined entries). */
export function spawnEnv(
  extra: Record<string, string> = {},
): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ELECTRON_RUN_AS_NODE: undefined,
    LAYOUTRY_DESKTOP_DEVTOOLS: undefined,
    ...extra,
  };
}

export async function makeTempDir(prefix: string): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

export async function removeDir(dir: string): Promise<void> {
  await rm(dir, {
    recursive: true,
    force: true,
    maxRetries: 20,
    retryDelay: 250,
  });
}

/**
 * Copies exactly what a packaged app ships — package.json, the compiled
 * main process and the static export, no node_modules — into
 * `<new temp dir>/<folderName>`, plus optional extra files inside the
 * copy's `out/` (test-only pages that never touch the real build).
 */
export async function copyApp(
  folderName: string,
  extraExportFiles: Record<string, string> = {},
): Promise<{ root: string; appDir: string }> {
  const root = await makeTempDir("layoutry-app-copy-");
  const appDir = path.join(root, folderName);
  await mkdir(appDir);
  await cp(
    path.join(REPO_ROOT, "package.json"),
    path.join(appDir, "package.json"),
  );
  await cp(
    path.join(REPO_ROOT, "desktop-dist"),
    path.join(appDir, "desktop-dist"),
    {
      recursive: true,
    },
  );
  await cp(EXPORT_ROOT, path.join(appDir, "out"), { recursive: true });
  for (const [name, contents] of Object.entries(extraExportFiles)) {
    await writeFile(path.join(appDir, "out", name), contents);
  }
  return { root, appDir };
}

export function hasExited(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null;
}

export function waitForExit(
  child: ChildProcess,
  timeoutMs: number,
): Promise<number | null | "timeout"> {
  if (hasExited(child)) return Promise.resolve(child.exitCode);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve("timeout"), timeoutMs);
    child.once("exit", (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

/** Last-resort cleanup of a whole Electron process tree. */
export function killProcessTree(pid: number | undefined): void {
  if (pid === undefined) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], {
      stdio: "ignore",
    });
  } else {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // already gone
    }
  }
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export interface LaunchedLayoutry {
  app: ElectronApplication;
  page: Page;
  userDataDir: string;
  /** Hard exit (bypasses the close warning), process-tree cleanup, profile removal. */
  dispose: () => Promise<void>;
}

export interface LaunchOptions {
  /** Defaults to a fresh temporary profile owned (and removed) by this launch. */
  userDataDir?: string;
  /** Defaults to the repository checkout. */
  appPath?: string;
}

/**
 * Launches the real Electron main process with an isolated profile and the
 * offline black hole, and waits for the editor to hydrate. Also records
 * every non-app:// request the session sees from this point on, cancelling
 * any network (http/https/ws) one.
 */
export async function launchLayoutry(
  options: LaunchOptions = {},
): Promise<LaunchedLayoutry> {
  const ownsProfile = options.userDataDir === undefined;
  const userDataDir =
    options.userDataDir ?? (await makeTempDir("layoutry-desktop-test-"));

  const app = await _electron.launch({
    executablePath: electronBinary(),
    args: [
      options.appPath ?? REPO_ROOT,
      `--user-data-dir=${userDataDir}`,
      ...OFFLINE_SWITCHES,
    ],
    cwd: REPO_ROOT,
    env: electronEnv(),
  });
  // Captured now: app.process() is unavailable once the app has exited.
  const child = app.process();

  await app.evaluate(({ session }) => {
    const seen: string[] = [];
    Reflect.set(globalThis, "__layoutryNonAppRequests", seen);
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      if (details.url.startsWith("app:")) return callback({});
      seen.push(details.url);
      callback({ cancel: /^(https?|wss?|ftp):/i.test(details.url) });
    });
  });

  const page = await app.firstWindow();
  await expect(page.locator("[data-document-surface] h1").first()).toBeVisible({
    timeout: 30_000,
  });
  // The window is shown on ready-to-show, a moment after first DOM paint.
  await expect
    .poll(() =>
      app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().some((window) => window.isVisible()),
      ),
    )
    .toBe(true);

  const dispose = async () => {
    if (!hasExited(child)) {
      await app
        .evaluate(({ app: electronApp }) => electronApp.exit(0))
        .catch(() => {});
      if ((await waitForExit(child, 10_000)) === "timeout") {
        killProcessTree(child.pid);
      }
    }
    if (ownsProfile) await removeDir(userDataDir);
  };

  return { app, page, userDataDir, dispose };
}

/** Non-app:// URLs the session has seen since launch (see launchLayoutry). */
export async function nonAppRequests(
  app: ElectronApplication,
): Promise<string[]> {
  return app.evaluate(() => {
    const seen: unknown = Reflect.get(globalThis, "__layoutryNonAppRequests");
    return Array.isArray(seen) ? seen.map(String) : [];
  });
}

/** Number of authored document nodes rendered on the Canvas. */
export function documentNodeCount(page: Page): Promise<number> {
  return page.locator("[data-document-surface] [data-node-id]").count();
}

/** Drags the Resource library's Container card onto the Canvas page. */
export async function dragInsertContainer(page: Page): Promise<void> {
  const card = page.getByRole("button", { name: /^Container/ }).first();
  const surface = page.locator("[data-document-surface]").first();
  const from = await card.boundingBox();
  const to = await surface.boundingBox();
  if (!from || !to) throw new Error("Container card or Canvas not visible");

  const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  const end = {
    x: to.x + Math.min(300, to.width / 2),
    y: to.y + Math.min(650, to.height - 40),
  };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let step = 1; step <= 15; step += 1) {
    await page.mouse.move(
      start.x + ((end.x - start.x) * step) / 15,
      start.y + ((end.y - start.y) * step) / 15,
    );
  }
  await page.mouse.up();
}

/**
 * Replaces the native close dialog with a scripted one in the main
 * process: "cancel", "discard", or "pending" (never answers until
 * answerPendingCloseDialog). Records every call's options.
 */
export async function scriptCloseDialog(
  app: ElectronApplication,
  answer: "cancel" | "discard" | "pending",
): Promise<void> {
  await app.evaluate(({ dialog }, scripted) => {
    const calls: unknown[] = [];
    Reflect.set(globalThis, "__layoutryDialogCalls", calls);
    dialog.showMessageBox = (...args: unknown[]) => {
      calls.push(args[args.length - 1]);
      if (scripted === "pending") {
        return new Promise<Electron.MessageBoxReturnValue>((resolve) => {
          Reflect.set(
            globalThis,
            "__layoutryAnswerDialog",
            (response: number) => resolve({ response, checkboxChecked: false }),
          );
        });
      }
      return Promise.resolve({
        response: scripted === "discard" ? 1 : 0,
        checkboxChecked: false,
      });
    };
  }, answer);
}

export async function answerPendingCloseDialog(
  app: ElectronApplication,
  answer: "cancel" | "discard",
): Promise<void> {
  await app.evaluate(
    (_electron, response) => {
      const answerDialog: unknown = Reflect.get(
        globalThis,
        "__layoutryAnswerDialog",
      );
      if (typeof answerDialog === "function") answerDialog(response);
    },
    answer === "discard" ? 1 : 0,
  );
}

export async function closeDialogCalls(
  app: ElectronApplication,
): Promise<{ message?: unknown; buttons?: unknown }[]> {
  return app.evaluate(() => {
    const calls: unknown = Reflect.get(globalThis, "__layoutryDialogCalls");
    if (!Array.isArray(calls)) return [];
    return calls.map((options: unknown) =>
      typeof options === "object" && options !== null
        ? {
            message: Reflect.get(options, "message"),
            buttons: Reflect.get(options, "buttons"),
          }
        : {},
    );
  });
}

/** Asks the main window to close, exactly like the title-bar X. */
export async function requestWindowClose(
  app: ElectronApplication,
): Promise<void> {
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.close();
  });
}

export function windowCount(app: ElectronApplication): Promise<number> {
  return app.evaluate(
    ({ BrowserWindow }) => BrowserWindow.getAllWindows().length,
  );
}
