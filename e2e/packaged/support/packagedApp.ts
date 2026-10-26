import { chromium, expect, type Browser, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import {
  killProcessTree,
  makeTempDir,
  OFFLINE_SWITCHES,
  removeDir,
  REPO_ROOT,
  spawnEnv,
  waitForExit,
} from "../../desktop/support/layoutryApp";
import {
  RELEASE,
  releasePaths,
} from "../../../desktop/packaging/releaseInfo.mjs";

export const {
  unpackedDir: UNPACKED_DIR,
  unpackedExe: UNPACKED_EXE,
  zipPath: ZIP_PATH,
} = releasePaths(REPO_ROOT);

/** Where globalSetup extracted the release ZIP (a path with spaces and Unicode). */
export function extractedAppDir(): string {
  const dir = process.env.LAYOUTRY_EXTRACTED_APP_DIR;
  if (!dir || !existsSync(dir)) {
    throw new Error("Extracted release not found; globalSetup did not run.");
  }
  return dir;
}

export function extractedExe(): string {
  return path.join(extractedAppDir(), `${RELEASE.executableName}.exe`);
}

export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

export async function waitUntil(
  check: () => Promise<boolean> | boolean,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
}

export async function devToolsListening(port: number): Promise<boolean> {
  try {
    return (await fetch(`http://127.0.0.1:${port}/json/version`)).ok;
  } catch {
    return false;
  }
}

export interface PackagedLayoutry {
  child: ChildProcess;
  pid: number;
  browser: Browser;
  page: Page;
  userDataDir: string;
  /** Spawn → editor hydrated and window visible, in ms. */
  startupMs: number;
  /** The test-only DevTools port this launch was given. */
  devToolsPort: number;
  output: () => string;
  dispose: () => Promise<void>;
}

export interface PackagedLaunchOptions {
  userDataDir?: string;
  env?: Record<string, string>;
  /** Extra leading arguments (e.g. --inspect, which must come first). */
  args?: string[];
}

/**
 * Starts the packaged Layoutry.exe the way a tester would (no app path, no
 * repository, cwd = temp), plus an isolated profile, the offline black
 * hole and a DevTools port so the test can observe the page.
 */
export async function launchPackaged(
  exe: string,
  options: PackagedLaunchOptions = {},
): Promise<PackagedLayoutry> {
  const ownsProfile = options.userDataDir === undefined;
  const userDataDir =
    options.userDataDir ?? (await makeTempDir("layoutry-packaged-profile-"));
  const port = await freePort();
  let output = "";

  const started = performance.now();
  const child = spawn(
    exe,
    [
      ...(options.args ?? []),
      `--user-data-dir=${userDataDir}`,
      `--remote-debugging-port=${port}`,
      ...OFFLINE_SWITCHES,
    ],
    {
      cwd: os.tmpdir(),
      env: spawnEnv(options.env),
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout?.on("data", (chunk) => (output += String(chunk)));
  child.stderr?.on("data", (chunk) => (output += String(chunk)));
  const pid = child.pid;
  if (pid === undefined) throw new Error(`failed to start ${exe}`);

  const cleanup = async () => {
    killProcessTree(pid);
    await waitForExit(child, 10_000);
    if (ownsProfile) await removeDir(userDataDir);
  };

  try {
    expect(await waitUntil(() => devToolsListening(port), 30_000), output).toBe(
      true,
    );
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    const findAppPage = () =>
      browser
        .contexts()
        .flatMap((context) => context.pages())
        .find((page) => page.url().startsWith("app://layoutry/"));
    expect(await waitUntil(() => findAppPage() !== undefined, 30_000)).toBe(
      true,
    );
    const page = findAppPage();
    if (!page) throw new Error("app://layoutry/ page disappeared");
    await expect(
      page.locator("[data-document-surface] h1").first(),
    ).toBeVisible({
      timeout: 30_000,
    });
    await expect
      .poll(() => page.evaluate(() => document.visibilityState))
      .toBe("visible");
    const startupMs = performance.now() - started;

    return {
      child,
      pid,
      browser,
      page,
      userDataDir,
      startupMs,
      devToolsPort: port,
      output: () => output,
      dispose: async () => {
        await browser.close().catch(() => {});
        await cleanup();
      },
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

/** All page targets the app currently has (a popup would add one). */
export function pageCount(browser: Browser): number {
  return browser.contexts().flatMap((context) => context.pages()).length;
}
