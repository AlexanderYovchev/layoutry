import { expect, test } from "@playwright/test";
import { spawn } from "node:child_process";
import {
  closeDialogCalls,
  crashRenderer,
  copyApp,
  documentNodeCount,
  dragInsertContainer,
  electronBinary,
  spawnEnv,
  isProcessAlive,
  launchLayoutry,
  REPO_ROOT,
  removeDir,
  requestWindowClose,
  scriptCloseDialog,
  waitForExit,
  windowCount,
  type LaunchedLayoutry,
} from "./support/layoutryApp";

const CLOSE_MESSAGE =
  "Closing Layoutry will discard any unsaved changes. Continue?";

let layoutry: LaunchedLayoutry | undefined;

test.afterEach(async () => {
  await layoutry?.dispose();
  layoutry = undefined;
});

/** Runs a second Layoutry process against the same profile; resolves with its exit code. */
async function launchSecondInstance(userDataDir: string) {
  const second = spawn(
    electronBinary(),
    [REPO_ROOT, `--user-data-dir=${userDataDir}`],
    { cwd: REPO_ROOT, env: spawnEnv(), stdio: "ignore" },
  );
  return waitForExit(second, 20_000);
}

async function recordSecondInstanceEvents(launched: LaunchedLayoutry) {
  await launched.app.evaluate(({ app }) => {
    Reflect.set(globalThis, "__secondInstances", 0);
    app.on("second-instance", () => {
      const count = Number(Reflect.get(globalThis, "__secondInstances"));
      Reflect.set(globalThis, "__secondInstances", count + 1);
    });
  });
}

function secondInstanceEvents(launched: LaunchedLayoutry) {
  return launched.app.evaluate(() =>
    Number(Reflect.get(globalThis, "__secondInstances")),
  );
}

/** The editor's own unsaved-changes prompt (PROJECT-1.3), shown for a close. */
function closePrompt(page: LaunchedLayoutry["page"]) {
  return page.getByRole("dialog", { name: "Unsaved Changes" });
}

async function makeUnsavedChange(page: LaunchedLayoutry["page"]) {
  const before = await documentNodeCount(page);
  await dragInsertContainer(page);
  await expect.poll(() => documentNodeCount(page)).toBe(before + 1);
  return before + 1;
}

test("a saved (or untouched) project closes at once, with no prompt at all", async () => {
  layoutry = await launchLayoutry();
  const { app } = layoutry;
  await scriptCloseDialog(app, "cancel");
  const child = app.process();
  await requestWindowClose(app).catch(() => {
    // the main process may already be exiting
  });
  expect(await waitForExit(child, 15_000)).toBe(0);
  layoutry = undefined;
});

test("cancelling the close prompt keeps the window and the document", async () => {
  layoutry = await launchLayoutry();
  const { app, page } = layoutry;
  const nodes = await makeUnsavedChange(page);
  await scriptCloseDialog(app, "cancel");

  await requestWindowClose(app);
  const prompt = closePrompt(page);
  await expect(prompt).toContainText("Save them before closing Layoutry?");
  // The editor asks; the native dialog is not shown on top of it.
  expect(await closeDialogCalls(app)).toEqual([]);

  await prompt.getByRole("button", { name: "Cancel" }).click();
  await expect(prompt).toBeHidden();
  expect(await windowCount(app)).toBe(1);
  expect(await documentNodeCount(page)).toBe(nodes);

  // Asking again shows the prompt again.
  await requestWindowClose(app);
  await expect(prompt).toBeVisible();
  expect(await windowCount(app)).toBe(1);
});

test("repeated close requests while the prompt is open show a single prompt", async () => {
  layoutry = await launchLayoutry();
  const { app, page } = layoutry;
  await makeUnsavedChange(page);
  await scriptCloseDialog(app, "cancel");
  await requestWindowClose(app);
  await requestWindowClose(app);
  await requestWindowClose(app);
  await expect(closePrompt(page)).toBeVisible();
  expect(await page.locator("dialog[open]").count()).toBe(1);
  expect(await closeDialogCalls(app)).toEqual([]);
  expect(await windowCount(app)).toBe(1);

  await closePrompt(page).getByRole("button", { name: "Cancel" }).click();
  await expect.poll(() => windowCount(app)).toBe(1);
});

test("Don't Save exits cleanly with no leftover processes", async () => {
  layoutry = await launchLayoutry();
  const { app, page } = layoutry;
  await makeUnsavedChange(page);
  const pids = await app.evaluate(({ app: electronApp }) =>
    electronApp.getAppMetrics().map((metric) => metric.pid),
  );
  expect(pids.length).toBeGreaterThan(1);

  const child = app.process();
  await requestWindowClose(app);
  await closePrompt(page).getByRole("button", { name: "Don't Save" }).click();
  expect(await waitForExit(child, 15_000)).toBe(0);

  await expect
    .poll(() => pids.filter(isProcessAlive), { timeout: 10_000 })
    .toEqual([]);
});

test("if the editor page has crashed, closing falls back to the native warning", async () => {
  layoutry = await launchLayoutry();
  const { app, page } = layoutry;
  await makeUnsavedChange(page);
  await scriptCloseDialog(app, "cancel");
  await crashRenderer(app);

  await requestWindowClose(app);
  await expect.poll(async () => (await closeDialogCalls(app)).length).toBe(1);
  const [call] = await closeDialogCalls(app);
  expect(call).toEqual({
    message: CLOSE_MESSAGE,
    buttons: ["Cancel", "Discard and Close"],
  });
  expect(await windowCount(app)).toBe(1);

  await scriptCloseDialog(app, "discard");
  const child = app.process();
  await requestWindowClose(app).catch(() => undefined);
  expect(await waitForExit(child, 15_000)).toBe(0);
});

test("a second launch focuses the running editor instead of opening another", async () => {
  layoutry = await launchLayoutry();
  const { app, page, userDataDir } = layoutry;
  await recordSecondInstanceEvents(layoutry);

  const before = await documentNodeCount(page);
  await dragInsertContainer(page);
  await expect.poll(() => documentNodeCount(page)).toBe(before + 1);

  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].minimize(),
  );
  await expect
    .poll(() =>
      app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].isMinimized(),
      ),
    )
    .toBe(true);

  expect(await launchSecondInstance(userDataDir)).toBe(0);

  await expect.poll(() => secondInstanceEvents(layoutry!)).toBe(1);
  const state = await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0];
    return {
      windows: BrowserWindow.getAllWindows().length,
      minimized: window.isMinimized(),
      visible: window.isVisible(),
    };
  });
  expect(state).toEqual({ windows: 1, minimized: false, visible: true });
  // The open, unsaved document is untouched.
  expect(await documentNodeCount(page)).toBe(before + 1);
  expect(page.url()).toBe("app://layoutry/");
});

test("a second launch while the close prompt is open still exits and opens nothing", async () => {
  layoutry = await launchLayoutry();
  const { app, page, userDataDir } = layoutry;
  await recordSecondInstanceEvents(layoutry);
  await makeUnsavedChange(page);
  await requestWindowClose(app);
  await expect(closePrompt(page)).toBeVisible();

  expect(await launchSecondInstance(userDataDir)).toBe(0);
  await expect.poll(() => secondInstanceEvents(layoutry!)).toBe(1);
  expect(await windowCount(app)).toBe(1);
  expect(await page.locator("dialog[open]").count()).toBe(1);

  await closePrompt(page).getByRole("button", { name: "Cancel" }).click();
  expect(await windowCount(app)).toBe(1);
});

test("separate profiles are separate instances (the lock is per user-data directory)", async () => {
  layoutry = await launchLayoutry();
  const other = await launchLayoutry();
  try {
    expect(other.userDataDir).not.toBe(layoutry.userDataDir);
    expect(await windowCount(other.app)).toBe(1);
    expect(await windowCount(layoutry.app)).toBe(1);
  } finally {
    await other.dispose();
  }
});

test("runs from a folder with spaces and non-ASCII characters, without node_modules", async () => {
  const { root, appDir } = await copyApp("Layoutry Тест 測試 – alpha");
  try {
    layoutry = await launchLayoutry({ appPath: appDir });
    const { app, page } = layoutry;
    expect(
      await app.evaluate(({ app: electronApp }) => electronApp.getAppPath()),
    ).toBe(appDir);
    expect(page.url()).toBe("app://layoutry/");
    const ok = await page.evaluate(async () => {
      await document.fonts.ready;
      return {
        interAvailable: document.fonts.check('16px "Inter"'),
        root: (await fetch("/")).status,
      };
    });
    expect(ok).toEqual({ interAvailable: true, root: 200 });
  } finally {
    await layoutry?.dispose();
    layoutry = undefined;
    await removeDir(root);
  }
});
