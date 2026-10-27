import { chromium, type BrowserContext } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * A Chromium with a real on-disk profile (PROJECT-1.4 recovery tests), so
 * IndexedDB outlives the browser process — and the process can be killed
 * outright, the way a browser crash or a forced shutdown ends it.
 */
export async function makeProfileDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "layoutry-browser-profile-"));
}

export async function removeProfileDir(dir: string): Promise<void> {
  await rm(dir, {
    recursive: true,
    force: true,
    maxRetries: 20,
    retryDelay: 250,
  });
}

export function launchWithProfile(
  profileDir: string,
  baseURL: string,
): Promise<BrowserContext> {
  return chromium.launchPersistentContext(profileDir, { baseURL });
}

/**
 * Kills every process of the browser using `profileDir` at once — no
 * unload events, no IndexedDB shutdown, nothing graceful.
 */
export function killBrowser(profileDir: string): void {
  if (process.platform === "win32") {
    const needle = profileDir.replace(/'/g, "''");
    spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine.Contains('${needle}') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
      ],
      { stdio: "ignore" },
    );
  } else {
    spawnSync("pkill", ["-9", "-f", profileDir], { stdio: "ignore" });
  }
}
