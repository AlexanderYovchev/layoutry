import { chromium, expect, test } from "@playwright/test";
import {
  FuseState,
  FuseV1Options,
  flipFuses,
  getCurrentFuseWire,
} from "@electron/fuses";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import {
  ASAR_DEPENDENT_FUSES,
  PACKAGED_FUSES,
  UNPACKED_VERIFICATION_FUSES,
} from "../../desktop/fuses/layoutryFuses";
import {
  electronBinary,
  spawnEnv,
  killProcessTree,
  makeTempDir,
  OFFLINE_SWITCHES,
  REPO_ROOT,
  removeDir,
  waitForExit,
} from "./support/layoutryApp";

/**
 * Proves the fuse configuration on a real binary without touching the dev
 * one: electron.exe is copied to a temporary folder, the fuses that work
 * on an unpacked app are flipped there, and that hardened copy is checked
 * against the stock binary for every Node.js entry point the fuses close.
 * The two ASAR-dependent fuses are only verified as configured — they are
 * flipped for real in DESKTOP-0.4 packaging.
 */

test.describe.configure({ timeout: 240_000 });

let workDir: string;
let hardenedExe: string;
const children: ChildProcess[] = [];

function freePort(): Promise<number> {
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

async function isListening(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitUntil(check: () => Promise<boolean>, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

interface Started {
  child: ChildProcess;
  stdout: () => string;
  userDataDir: string;
}

/** Starts an Electron binary against the checkout with an isolated profile. */
async function start(
  executable: string,
  extraArgs: string[],
  extraEnv: Record<string, string> = {},
): Promise<Started> {
  const userDataDir = await makeTempDir("layoutry-fuse-profile-");
  let output = "";
  // Node.js switches (--inspect) only count when they come first, before
  // the app path and before any Chromium switch.
  const nodeArgs = extraArgs.filter((arg) => arg.startsWith("--inspect"));
  const chromiumArgs = extraArgs.filter((arg) => !arg.startsWith("--inspect"));
  const child = spawn(
    executable,
    [
      ...nodeArgs,
      REPO_ROOT,
      `--user-data-dir=${userDataDir}`,
      ...OFFLINE_SWITCHES,
      ...chromiumArgs,
    ],
    {
      cwd: REPO_ROOT,
      env: spawnEnv(extraEnv),
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout?.on("data", (chunk) => (output += String(chunk)));
  child.stderr?.on("data", (chunk) => (output += String(chunk)));
  children.push(child);
  return { child, stdout: () => output, userDataDir };
}

async function stop(started: Started) {
  killProcessTree(started.child.pid);
  await waitForExit(started.child, 10_000);
  await removeDir(started.userDataDir);
}

test.beforeAll(async () => {
  workDir = await makeTempDir("layoutry-fuses-");
  const distCopy = path.join(workDir, "electron-dist");
  await cp(path.dirname(electronBinary()), distCopy, { recursive: true });
  hardenedExe = path.join(distCopy, path.basename(electronBinary()));
  await flipFuses(hardenedExe, UNPACKED_VERIFICATION_FUSES);
});

test.afterAll(async () => {
  for (const child of children) killProcessTree(child.pid);
  await removeDir(workDir);
});

test("the packaged configuration decides every fuse; only the ASAR pair is deferred", async () => {
  const wire = await getCurrentFuseWire(hardenedExe);
  const allFuses = Object.values(FuseV1Options).filter(
    (value): value is FuseV1Options => typeof value === "number",
  );
  for (const fuse of allFuses) {
    expect(wire[fuse], FuseV1Options[fuse]).toBe(
      UNPACKED_VERIFICATION_FUSES[fuse] ? FuseState.ENABLE : FuseState.DISABLE,
    );
  }
  for (const fuse of ASAR_DEPENDENT_FUSES) {
    expect(PACKAGED_FUSES[fuse], FuseV1Options[fuse]).toBe(true);
    expect(wire[fuse], FuseV1Options[fuse]).toBe(FuseState.DISABLE);
  }

  // The stock development binary stays untouched.
  const stock = await getCurrentFuseWire(electronBinary());
  expect(stock[FuseV1Options.RunAsNode]).toBe(FuseState.ENABLE);
});

test("the hardened binary still runs Layoutry offline over app://", async () => {
  const port = await freePort();
  const started = await start(hardenedExe, [`--remote-debugging-port=${port}`]);
  try {
    expect(await waitUntil(() => isListening(port), 30_000)).toBe(true);
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    try {
      // The DevTools port opens before the window exists: poll for the page.
      const findAppPage = () =>
        browser
          .contexts()
          .flatMap((context) => context.pages())
          .find((candidate) => candidate.url().startsWith("app://layoutry/"));
      await expect
        .poll(() => findAppPage() !== undefined, { timeout: 30_000 })
        .toBe(true);
      const page = findAppPage();
      if (!page) throw new Error("app://layoutry/ page disappeared");
      await expect(
        page.locator("[data-document-surface] h1").first(),
      ).toBeVisible({
        timeout: 30_000,
      });
      const fontsOk = await page.evaluate(async () => {
        await document.fonts.ready;
        return document.fonts.check('16px "Inter"');
      });
      expect(fontsOk).toBe(true);
    } finally {
      await browser.close();
    }
  } finally {
    await stop(started);
  }
});

test("ELECTRON_RUN_AS_NODE no longer turns the binary into Node.js", async () => {
  // Stock binary (control): runs the app folder as a plain Node.js script,
  // where require("electron") is just a path string, so it fails fast.
  const stock = await start(electronBinary(), [], {
    ELECTRON_RUN_AS_NODE: "1",
  });
  const stockExit = await waitForExit(stock.child, 20_000);
  await stop(stock);
  expect(stockExit).not.toBe("timeout");
  expect(stockExit).not.toBe(0);

  // Hardened: the variable is ignored and Layoutry starts as an app.
  const port = await freePort();
  const hardened = await start(
    hardenedExe,
    [`--remote-debugging-port=${port}`],
    {
      ELECTRON_RUN_AS_NODE: "1",
    },
  );
  try {
    expect(await waitUntil(() => isListening(port), 30_000)).toBe(true);
    expect(hardened.child.exitCode).toBeNull();
  } finally {
    await stop(hardened);
  }
});

test("NODE_OPTIONS can no longer inject code into the main process", async () => {
  const injected = path.join(workDir, "injected.cjs");

  async function injectionRan(executable: string): Promise<boolean> {
    const marker = path.join(workDir, `marker-${Date.now()}.txt`);
    await writeFile(
      injected,
      `require("node:fs").writeFileSync(${JSON.stringify(marker)}, "ran");`,
    );
    const port = await freePort();
    const started = await start(
      executable,
      [`--remote-debugging-port=${port}`],
      {
        // Forward slashes: NODE_OPTIONS treats a backslash as an escape.
        NODE_OPTIONS: `--require "${injected.split(path.sep).join("/")}"`,
      },
    );
    try {
      expect(
        await waitUntil(() => isListening(port), 30_000),
        started.stdout(),
      ).toBe(true);
      return existsSync(marker);
    } finally {
      await stop(started);
    }
  }

  expect(await injectionRan(electronBinary()), "stock binary (control)").toBe(
    true,
  );
  expect(await injectionRan(hardenedExe), "hardened binary").toBe(false);
});

test("--inspect no longer opens a main-process debugger", async () => {
  async function inspectorOpened(executable: string) {
    const debugPort = await freePort();
    const inspectPort = await freePort();
    // --inspect must be the very first argument to reach Node.js.
    const started = await start(executable, [
      `--inspect=${inspectPort}`,
      `--remote-debugging-port=${debugPort}`,
    ]);
    try {
      expect(
        await waitUntil(() => isListening(debugPort), 30_000),
        started.stdout(),
      ).toBe(true);
      // Polled, not probed once: the inspector can bind a moment later.
      const opened = await waitUntil(() => isListening(inspectPort), 5_000);
      return {
        opened,
        output: `ports ${debugPort}/${inspectPort}\n${started.stdout()}`,
      };
    } finally {
      await stop(started);
    }
  }

  const stock = await inspectorOpened(electronBinary());
  expect(stock.opened, `stock binary (control)\n${stock.output}`).toBe(true);
  const hardened = await inspectorOpened(hardenedExe);
  expect(hardened.opened, `hardened binary\n${hardened.output}`).toBe(false);
});
