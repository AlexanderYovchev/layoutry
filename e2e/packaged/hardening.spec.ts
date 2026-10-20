import { expect, test } from "@playwright/test";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  electronBinary,
  killProcessTree,
  makeTempDir,
  OFFLINE_SWITCHES,
  removeDir,
  spawnEnv,
  waitForExit,
} from "../desktop/support/layoutryApp";
import {
  devToolsListening,
  extractedAppDir,
  extractedExe,
  freePort,
  launchPackaged,
  waitUntil,
} from "./support/packagedApp";

/**
 * Proves each packaged fuse by behavior on the real Layoutry.exe — not by
 * reading configuration. Tamper tests run on throwaway copies of the
 * extracted app.
 */

test.describe.configure({ timeout: 240_000 });

let workDir: string;

test.beforeAll(async () => {
  workDir = await makeTempDir("layoutry-packaged-hardening-");
});

test.afterAll(async () => {
  await removeDir(workDir);
});

async function copyOfExtractedApp(name: string): Promise<string> {
  const copy = path.join(workDir, name);
  await cp(extractedAppDir(), copy, { recursive: true });
  return copy;
}

/** Starts an exe and reports whether it ever served a DevTools endpoint. */
async function startAndObserve(
  exe: string,
  extraEnv: Record<string, string> = {},
) {
  const profile = await makeTempDir("layoutry-hardening-profile-");
  const port = await freePort();
  const child = spawn(
    exe,
    [
      `--user-data-dir=${profile}`,
      `--remote-debugging-port=${port}`,
      ...OFFLINE_SWITCHES,
    ],
    { cwd: os.tmpdir(), env: spawnEnv(extraEnv), stdio: "ignore" },
  );
  const served = await waitUntil(() => devToolsListening(port), 15_000);
  const exited = await waitForExit(child, served ? 1 : 10_000);
  killProcessTree(child.pid);
  await waitForExit(child, 10_000);
  await removeDir(profile);
  return { served, exited };
}

test("ELECTRON_RUN_AS_NODE cannot turn Layoutry.exe into Node.js", async () => {
  const launched = await launchPackaged(extractedExe(), {
    env: { ELECTRON_RUN_AS_NODE: "1" },
  });
  try {
    await expect(launched.page).toHaveTitle("Layoutry");
  } finally {
    await launched.dispose();
  }
});

test("NODE_OPTIONS cannot inject code into Layoutry.exe", async () => {
  const marker = path.join(workDir, "node-options-marker.txt");
  const injected = path.join(workDir, "injected.cjs");
  await writeFile(
    injected,
    `require("node:fs").writeFileSync(${JSON.stringify(marker)}, "ran");`,
  );
  const launched = await launchPackaged(extractedExe(), {
    env: { NODE_OPTIONS: `--require "${injected.split(path.sep).join("/")}"` },
  });
  try {
    await expect(launched.page).toHaveTitle("Layoutry");
    expect(existsSync(marker)).toBe(false);
  } finally {
    await launched.dispose();
  }
});

test("--inspect cannot open a debugger on Layoutry.exe's main process", async () => {
  const inspectPort = await freePort();
  const launched = await launchPackaged(extractedExe(), {
    args: [`--inspect=${inspectPort}`],
  });
  try {
    expect(await waitUntil(() => devToolsListening(inspectPort), 5_000)).toBe(
      false,
    );
    expect(launched.output()).not.toContain("Debugger listening");
  } finally {
    await launched.dispose();
  }
});

test("a tampered app.asar is refused (embedded ASAR integrity)", async () => {
  const copy = await copyOfExtractedApp("tampered");
  const asarPath = path.join(copy, "resources", "app.asar");
  const asar = await readFile(asarPath);
  // Same-length edit inside the archive header's JSON file table.
  const target = Buffer.from('"index.html"');
  const at = asar.indexOf(target);
  expect(at).toBeGreaterThan(0);
  Buffer.from('"indey.html"').copy(asar, at);
  await writeFile(asarPath, asar);

  const result = await startAndObserve(path.join(copy, "Layoutry.exe"));
  expect(result.served, "tampered app must not start").toBe(false);
  expect(result.exited).not.toBe(0);
});

async function plantLooseApp(copy: string, marker: string) {
  const planted = path.join(copy, "resources", "app");
  await mkdir(planted);
  await writeFile(
    path.join(planted, "package.json"),
    JSON.stringify({ name: "planted", main: "main.js" }),
  );
  await writeFile(
    path.join(planted, "main.js"),
    `require("node:fs").writeFileSync(${JSON.stringify(marker)}, "planted app ran");\nrequire("electron").app.quit();\n`,
  );
}

test("a loose resources/app folder is never loaded (OnlyLoadAppFromAsar)", async () => {
  const copy = await copyOfExtractedApp("loose-app");
  const marker = path.join(workDir, "loose-app-marker.txt");
  await rm(path.join(copy, "resources", "app.asar"));
  await plantLooseApp(copy, marker);

  // Control: a stock (unfused) Electron runtime in the same folder loads
  // the loose folder — proving the planted app is a valid, loadable app.
  const unhardened = path.join(copy, "Unhardened.exe");
  await cp(electronBinary(), unhardened);
  const control = spawn(unhardened, [], {
    cwd: copy,
    env: spawnEnv(),
    stdio: "ignore",
  });
  try {
    expect(await waitUntil(() => existsSync(marker), 20_000), "control").toBe(
      true,
    );
  } finally {
    killProcessTree(control.pid);
    await waitForExit(control, 10_000);
  }
  await rm(marker, { force: true });

  // Hardened: Layoutry.exe refuses to run anything but app.asar.
  const result = await startAndObserve(path.join(copy, "Layoutry.exe"));
  expect(existsSync(marker), "planted code must not run").toBe(false);
  expect(result.served, "no app may start").toBe(false);
});

test("a folder planted next to app.asar is ignored; Layoutry still runs from app.asar", async () => {
  const copy = await copyOfExtractedApp("planted-beside-asar");
  const marker = path.join(workDir, "planted-beside-marker.txt");
  await plantLooseApp(copy, marker);

  const launched = await launchPackaged(path.join(copy, "Layoutry.exe"));
  try {
    await expect(launched.page).toHaveTitle("Layoutry");
    expect(launched.page.url()).toBe("app://layoutry/");
    expect(existsSync(marker)).toBe(false);
  } finally {
    await launched.dispose();
  }
});
