import { expect, test } from "@playwright/test";
import { spawn } from "node:child_process";
import os from "node:os";
import {
  documentNodeCount,
  dragInsertContainer,
  isProcessAlive,
  makeTempDir,
  removeDir,
  spawnEnv,
  waitForExit,
} from "../desktop/support/layoutryApp";
import {
  extractedExe,
  launchPackaged,
  pageCount,
  type PackagedLayoutry,
} from "./support/packagedApp";
import {
  mainWindowState,
  minimizeMainWindow,
  nativeDialog,
  processTree,
  requestMainWindowClose,
} from "./support/windows";

let layoutry: PackagedLayoutry | undefined;

test.afterEach(async () => {
  await layoutry?.dispose();
  layoutry = undefined;
});

async function launchSecond(userDataDir: string) {
  const second = spawn(extractedExe(), [`--user-data-dir=${userDataDir}`], {
    cwd: os.tmpdir(),
    env: spawnEnv(),
    stdio: "ignore",
  });
  return waitForExit(second, 20_000);
}

/**
 * PROJECT-1.3: closing is decided by the editor itself — no prompt for a
 * saved project, Layoutry's own Save / Don't Save / Cancel prompt for
 * unsaved work. The native warning is only a fallback for a dead page
 * (covered in the Electron suite).
 */
test("closing with unsaved work shows Layoutry's own prompt; Cancel keeps the document", async () => {
  layoutry = await launchPackaged(extractedExe());
  const { page, pid } = layoutry;
  const before = await documentNodeCount(page);
  await dragInsertContainer(page);
  await expect.poll(() => documentNodeCount(page)).toBe(before + 1);

  requestMainWindowClose(pid);
  const prompt = page.getByRole("dialog", { name: "Unsaved Changes" });
  await expect(prompt).toContainText("Save them before closing Layoutry?");
  // No native warning on top of it.
  expect(nativeDialog(pid, undefined, 1).found).toBe(false);

  await prompt.getByRole("button", { name: "Cancel" }).click();
  await expect(prompt).toBeHidden();
  expect(isProcessAlive(pid)).toBe(true);
  expect(mainWindowState(pid)).toMatchObject({
    visible: true,
    minimized: false,
  });
  expect(await documentNodeCount(page)).toBe(before + 1);
});

test("Don't Save exits cleanly with no leftover processes", async () => {
  layoutry = await launchPackaged(extractedExe());
  const { page, pid, child } = layoutry;
  await dragInsertContainer(page);
  const pids = processTree(pid).map((process) => process.pid);
  expect(pids.length).toBeGreaterThan(1);

  requestMainWindowClose(pid);
  await page
    .getByRole("dialog", { name: "Unsaved Changes" })
    .getByRole("button", { name: "Don't Save" })
    .click();
  expect(await waitForExit(child, 15_000)).toBe(0);
  await expect
    .poll(() => pids.filter(isProcessAlive), { timeout: 10_000 })
    .toEqual([]);
});

test("an untouched project closes at once, with no prompt and no leftover processes", async () => {
  layoutry = await launchPackaged(extractedExe());
  const { pid, child } = layoutry;
  const pids = processTree(pid).map((process) => process.pid);

  requestMainWindowClose(pid);
  expect(await waitForExit(child, 15_000)).toBe(0);
  await expect
    .poll(() => pids.filter(isProcessAlive), { timeout: 10_000 })
    .toEqual([]);
});

test("Layoutry reopens normally with the same profile after a normal exit", async () => {
  const userDataDir = await makeTempDir("layoutry-packaged-reopen-");
  try {
    layoutry = await launchPackaged(extractedExe(), { userDataDir });
    const first = layoutry;
    // Untouched, so it closes without asking.
    requestMainWindowClose(first.pid);
    expect(await waitForExit(first.child, 15_000)).toBe(0);
    await first.dispose();

    // The single-instance lock was released; a fresh, editable session starts.
    layoutry = await launchPackaged(extractedExe(), { userDataDir });
    await expect(layoutry.page).toHaveTitle("Layoutry");
    expect(await documentNodeCount(layoutry.page)).toBeGreaterThan(0);
    await dragInsertContainer(layoutry.page);
    expect(mainWindowState(layoutry.pid)).toMatchObject({
      visible: true,
      minimized: false,
    });
  } finally {
    await layoutry?.dispose();
    layoutry = undefined;
    await removeDir(userDataDir);
  }
});

test("a second launch restores and focuses the running editor without opening another", async () => {
  const userDataDir = await makeTempDir("layoutry-packaged-single-");
  try {
    layoutry = await launchPackaged(extractedExe(), { userDataDir });
    const { page, pid, browser } = layoutry;
    const before = await documentNodeCount(page);
    await dragInsertContainer(page);
    await expect.poll(() => documentNodeCount(page)).toBe(before + 1);

    minimizeMainWindow(pid);
    await expect.poll(() => mainWindowState(pid).minimized).toBe(true);

    expect(await launchSecond(userDataDir)).toBe(0);

    await expect.poll(() => mainWindowState(pid).minimized).toBe(false);
    const state = mainWindowState(pid);
    expect(state).toMatchObject({
      visible: true,
      minimized: false,
      title: "Layoutry",
    });
    expect(state.foreground).toBe(true);
    expect(pageCount(browser)).toBe(1);
    expect(await documentNodeCount(page)).toBe(before + 1);
  } finally {
    await layoutry?.dispose();
    layoutry = undefined;
    await removeDir(userDataDir);
  }
});

test("a second launch while the close prompt is open exits and opens nothing", async () => {
  const userDataDir = await makeTempDir("layoutry-packaged-single-");
  try {
    layoutry = await launchPackaged(extractedExe(), { userDataDir });
    const { pid, browser, page } = layoutry;
    await dragInsertContainer(page);
    requestMainWindowClose(pid);
    const prompt = page.getByRole("dialog", { name: "Unsaved Changes" });
    await expect(prompt).toBeVisible();

    expect(await launchSecond(userDataDir)).toBe(0);
    expect(pageCount(browser)).toBe(1);
    expect(isProcessAlive(pid)).toBe(true);
    expect(await page.locator("dialog[open]").count()).toBe(1);

    await prompt.getByRole("button", { name: "Cancel" }).click();
    await expect(prompt).toBeHidden();
    expect(isProcessAlive(pid)).toBe(true);
  } finally {
    await layoutry?.dispose();
    layoutry = undefined;
    await removeDir(userDataDir);
  }
});
