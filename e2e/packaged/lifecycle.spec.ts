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

const CLOSE_MESSAGE =
  "Closing Layoutry will discard your current unsaved document. Continue?";

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

test("the native close warning can be cancelled, keeping the document", async () => {
  layoutry = await launchPackaged(extractedExe());
  const { page, pid } = layoutry;
  const before = await documentNodeCount(page);
  await dragInsertContainer(page);
  await expect.poll(() => documentNodeCount(page)).toBe(before + 1);

  requestMainWindowClose(pid);
  const dialog = nativeDialog(pid, "Cancel");
  expect(dialog.found).toBe(true);
  expect(dialog.text).toContain(CLOSE_MESSAGE);
  expect(dialog.text).toContain("Layoutry can't save projects yet.");
  expect(dialog.buttons).toEqual(
    expect.arrayContaining(["Cancel", "Discard and Close"]),
  );

  await expect.poll(() => nativeDialog(pid, undefined, 1).found).toBe(false);
  expect(isProcessAlive(pid)).toBe(true);
  expect(mainWindowState(pid)).toMatchObject({
    visible: true,
    minimized: false,
  });
  expect(await documentNodeCount(page)).toBe(before + 1);
});

test("confirming the native close warning exits cleanly with no leftover processes", async () => {
  layoutry = await launchPackaged(extractedExe());
  const { pid, child } = layoutry;
  const pids = processTree(pid).map((process) => process.pid);
  expect(pids.length).toBeGreaterThan(1);

  requestMainWindowClose(pid);
  expect(nativeDialog(pid, "Discard and Close").found).toBe(true);
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
    requestMainWindowClose(first.pid);
    expect(nativeDialog(first.pid, "Discard and Close").found).toBe(true);
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

test("a second launch while the close warning is open exits and opens nothing", async () => {
  const userDataDir = await makeTempDir("layoutry-packaged-single-");
  try {
    layoutry = await launchPackaged(extractedExe(), { userDataDir });
    const { pid, browser } = layoutry;
    requestMainWindowClose(pid);
    expect(nativeDialog(pid).found).toBe(true);

    expect(await launchSecond(userDataDir)).toBe(0);
    expect(pageCount(browser)).toBe(1);
    expect(isProcessAlive(pid)).toBe(true);

    expect(nativeDialog(pid, "Cancel").found).toBe(true);
    await expect.poll(() => nativeDialog(pid, undefined, 1).found).toBe(false);
    expect(isProcessAlive(pid)).toBe(true);
  } finally {
    await layoutry?.dispose();
    layoutry = undefined;
    await removeDir(userDataDir);
  }
});
