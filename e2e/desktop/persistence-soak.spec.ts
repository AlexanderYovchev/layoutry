import {
  expect,
  test,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  documentNodeCount,
  dragInsertContainer,
  killProcessTree,
  launchLayoutry,
  makeTempDir,
  removeDir,
  requestWindowClose,
  scriptFileDialogs,
  waitForExit,
  type LaunchedLayoutry,
} from "./support/layoutryApp";

/**
 * PROJECT-1.5 persistence stability run in the real Electron app. Each cycle
 * edits, takes a recovery snapshot, saves, edits again and saves as a new
 * file, opens the first file again, saves over an outside change after the
 * conflict prompt, and every few cycles restarts the app — cleanly
 * (nothing may be offered for recovery afterwards) or with a hard kill
 * while unsaved (the work must be offered; it is discarded). Watched for
 * leaks: JS heap after GC, window event listeners, the main process's
 * active handles, temporary files and recovery records, and Save latency.
 *
 * The normal suite runs two short cycles as a regression check; set
 * LAYOUTRY_PERSISTENCE_SOAK_MINUTES for a long run. Prints one JSON line
 * per sample, prefixed [persistence-soak].
 */

const MINUTES = Number(process.env.LAYOUTRY_PERSISTENCE_SOAK_MINUTES ?? "0");
const SHORT_CYCLES = 2;
const RESTART_EVERY = 4;

let layoutry: LaunchedLayoutry | undefined;
let profile: string;
let folder: string;

test.beforeEach(async () => {
  profile = await makeTempDir("layoutry-soak-profile-");
  folder = await makeTempDir("layoutry-soak-files-");
});

test.afterEach(async () => {
  await layoutry?.dispose();
  layoutry = undefined;
  await removeDir(profile);
  await removeDir(folder);
});

function status(page: Page) {
  return page.locator("[data-project-status]");
}

async function protectedNow(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.locator("[data-recovery-status]")).toHaveAttribute(
    "data-recovery-status",
    "protected",
  );
}

/**
 * A real document edit that leaves the document the same size (insert a
 * Container, then delete it), so memory and listener counts stay
 * comparable from cycle to cycle. The Canvas registers one window keydown
 * listener per resizable node, so a growing document would grow them too.
 */
async function editKeepingSize(page: Page) {
  const before = await documentNodeCount(page);
  await dragInsertContainer(page);
  await expect.poll(() => documentNodeCount(page)).toBe(before + 1);
  await page.keyboard.press("Delete");
  await expect.poll(() => documentNodeCount(page)).toBe(before);
  await expect(status(page)).toHaveText("Unsaved changes");
}

async function rename(page: Page, name: string) {
  await page.getByRole("button", { name: /Rename project/ }).click();
  await page.getByRole("textbox", { name: "Project name" }).fill(name);
  await page.keyboard.press("Enter");
  await expect(status(page)).toHaveText("Unsaved changes");
}

async function timedSave(page: Page, keys: string): Promise<number> {
  const started = Date.now();
  await page.keyboard.press(keys);
  await expect(status(page)).toHaveText("Saved");
  return Date.now() - started;
}

async function leftovers(): Promise<{ temp: string[]; recovery: string[] }> {
  const files = await readdir(folder);
  const recovery = await readdir(path.join(profile, "Recovery")).catch(
    (): string[] => [],
  );
  return {
    temp: [...files, ...recovery].filter((name) => name.endsWith("-tmp")),
    recovery: recovery.filter((name) => name.endsWith(".layoutry-recovery")),
  };
}

async function sample(app: ElectronApplication, page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("HeapProfiler.collectGarbage");
  const { usedSize } = await cdp.send("Runtime.getHeapUsage");
  const { result } = await cdp.send("Runtime.evaluate", {
    expression: "window",
  });
  const { listeners } = result.objectId
    ? await cdp.send("DOMDebugger.getEventListeners", {
        objectId: result.objectId,
      })
    : { listeners: [] };
  await cdp.detach();
  const handles = await app.evaluate(() => {
    const counts: Record<string, number> = {};
    for (const resource of process.getActiveResourcesInfo())
      counts[resource] = (counts[resource] ?? 0) + 1;
    return counts;
  });
  return {
    heapMb: Math.round((usedSize / 1024 / 1024) * 10) / 10,
    windowListeners: listeners.length,
    mainHandles: handles,
  };
}

async function launch() {
  layoutry = await launchLayoutry({ userDataDir: profile });
  return layoutry;
}

test("repeated edit, snapshot, save, Save As, open, conflict and restart stay stable", async () => {
  const long = MINUTES > 0;
  test.setTimeout(long ? (MINUTES + 10) * 60_000 : 240_000);
  const deadline = Date.now() + MINUTES * 60_000;
  const original = path.join(folder, "Soak.layoutry");
  let { app, page } = await launch();

  // The first file: a new project saved through the (scripted) Save dialog.
  await dragInsertContainer(page);
  await scriptFileDialogs(app, { save: [original] });
  await timedSave(page, "Control+s");

  const saveTimes: number[] = [];
  const samples: ({ session: number; cycle: number } & Awaited<
    ReturnType<typeof sample>
  >)[] = [];
  let session = 0;
  let operations = 0;
  let restarts = 0;
  let kills = 0;
  for (
    let cycle = 1;
    long ? Date.now() < deadline : cycle <= SHORT_CYCLES;
    cycle += 1
  ) {
    // Edit, snapshot, save in place: the snapshot goes with the save.
    await editKeepingSize(page);
    await protectedNow(page);
    saveTimes.push(await timedSave(page, "Control+s"));
    await expect(page.locator("[data-recovery-status]")).toHaveCount(0);

    // Edit, Save As a new file (new identity).
    await rename(page, `Soak copy ${cycle}`);
    await scriptFileDialogs(app, {
      save: [path.join(folder, `Soak copy ${cycle}.layoutry`)],
      open: [original],
    });
    await timedSave(page, "Control+Shift+s");

    // Open the first file again (nothing unsaved: no prompt).
    await page.keyboard.press("Control+o");
    await expect(page.locator("[data-project-source]")).toContainText(
      "Soak.layoutry",
    );
    await expect(status(page)).toHaveText("Saved");

    // Another program changes it; saving asks, Overwrite wins.
    const onDisk: unknown = JSON.parse(await readFile(original, "utf8"));
    await writeFile(original, `${JSON.stringify(onDisk, null, 1)}\n`);
    await rename(page, `Soak ${cycle}`);
    await page.keyboard.press("Control+s");
    const conflict = page.getByRole("dialog", {
      name: "File Changed Outside Layoutry",
    });
    await conflict.getByRole("button", { name: "Overwrite" }).click();
    await expect(status(page)).toHaveText("Saved");
    operations += 9;

    expect(await leftovers()).toEqual({ temp: [], recovery: [] });
    samples.push({ session, cycle, ...(await sample(app, page)) });

    if (cycle % RESTART_EVERY === 0 || (!long && cycle === SHORT_CYCLES)) {
      // A clean close: nothing is offered afterwards.
      const child = app.process();
      await requestWindowClose(app);
      await waitForExit(child, 20_000);
      ({ app, page } = await launch());
      await page.waitForTimeout(1_000);
      await expect(
        page.getByRole("dialog", { name: "Recover Unsaved Work" }),
      ).toBeHidden();
      restarts += 1;
      await scriptFileDialogs(app, { open: [original] });
      await page.keyboard.press("Control+o");
      await expect(status(page)).toHaveText("Saved");

      // A hard kill while unsaved: offered, then discarded.
      await dragInsertContainer(page);
      await protectedNow(page);
      killProcessTree(app.process().pid);
      await waitForExit(app.process(), 15_000);
      ({ app, page } = await launch());
      const dialog = page.getByRole("dialog", { name: "Recover Unsaved Work" });
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "Discard…" }).click();
      await dialog.getByRole("button", { name: "Discard Permanently" }).click();
      await expect(dialog).toBeHidden();
      expect(await leftovers()).toEqual({ temp: [], recovery: [] });
      kills += 1;
      session += 1;
      await scriptFileDialogs(app, { open: [original] });
      await page.keyboard.press("Control+o");
      await expect(status(page)).toHaveText("Saved");
      operations += 8;
    }
  }
  const first = saveTimes.slice(0, 5);
  const last = saveTimes.slice(-5);
  const average = (values: number[]) =>
    Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  const summary = {
    minutes: MINUTES,
    cycles: saveTimes.length,
    operations,
    restarts,
    kills,
    saveMsFirst5: average(first),
    saveMsLast5: average(last),
    samples,
  };
  console.log(`[persistence-soak] ${JSON.stringify(summary)}`);
  // Leak guard for short and long runs alike: within one page load the
  // window's listeners stay flat cycle after cycle (a fresh page adds some
  // lazily, so sessions aren't compared with each other).
  for (const id of new Set(samples.map((entry) => entry.session))) {
    const counts = samples
      .filter((entry) => entry.session === id)
      .map((entry) => entry.windowListeners);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(2);
  }
});
