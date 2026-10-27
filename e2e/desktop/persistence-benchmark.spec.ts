import { expect, test, type Page } from "@playwright/test";
import { readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  killProcessTree,
  launchLayoutry,
  makeTempDir,
  removeDir,
  scriptFileDialogs,
  waitForExit,
  type LaunchedLayoutry,
} from "./support/layoutryApp";

/**
 * PROJECT-1.5 persistence benchmark (opt-in: LAYOUTRY_PERSISTENCE_BENCH=1).
 * Real Electron, real files, real recovery storage. For each project size:
 * Open, recovery snapshot and Save latency with the longest main-thread
 * task during each, the JS heap after a forced GC, and the Recovery
 * folder's size; then, for the largest project, the startup recovery scan
 * and Restore after a hard kill. LAYOUTRY_BENCH_APP points it at another
 * checkout (e.g. the previous checkpoint's build) for before/after runs.
 * Prints one JSON line per measurement, prefixed [persistence-bench].
 */

test.skip(
  process.env.LAYOUTRY_PERSISTENCE_BENCH !== "1",
  "opt-in benchmark: set LAYOUTRY_PERSISTENCE_BENCH=1",
);

const appPath = process.env.LAYOUTRY_BENCH_APP;

const SIZES = [
  { label: "small (20 elements)", elements: 20, textLength: 20 },
  { label: "medium (500 elements)", elements: 500, textLength: 20 },
  { label: "large (5,000 elements)", elements: 5_000, textLength: 20 },
  { label: "10 MB (5,000 long texts)", elements: 5_000, textLength: 2_000 },
  {
    label: "node limit (19,999 + page root)",
    elements: 19_999,
    textLength: 20,
  },
];

function projectText(id: string, elements: number, textLength: number) {
  const children = Array.from({ length: elements }, (_, index) => ({
    id: `p-${index.toString(16).padStart(8, "0")}`,
    tag: "p",
    text: `${index} `.padEnd(textLength, "x"),
  }));
  return `${JSON.stringify({
    format: "layoutry-project",
    formatVersion: 1,
    project: {
      id,
      name: "Bench",
      createdAt: "2026-10-28T08:00:00.000Z",
      updatedAt: "2026-10-28T08:00:00.000Z",
    },
    document: { id: "page-root", tag: "page", children },
  })}\n`;
}

/** Starts timing and long-task collection in the page. */
async function startMeasuring(page: Page) {
  await page.evaluate(() => {
    const longTasks: number[] = [];
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) longTasks.push(entry.duration);
    });
    observer.observe({ type: "longtask" });
    Reflect.set(window, "__bench", {
      start: performance.now(),
      longTasks,
      observer,
    });
  });
}

/** Waits in the page for `selector` to match, then returns the elapsed time and longest task. */
async function finishMeasuring(page: Page, selector: string, text?: string) {
  return page.evaluate(
    async ({ selector, text }) => {
      const bench: unknown = Reflect.get(window, "__bench");
      if (typeof bench !== "object" || bench === null)
        throw new Error("no bench");
      const start = Number(Reflect.get(bench, "start"));
      const longTasks: unknown = Reflect.get(bench, "longTasks");
      const observer: unknown = Reflect.get(bench, "observer");
      await new Promise<void>((resolve) => {
        const check = () => {
          const element = document.querySelector(selector);
          if (
            element &&
            (text === undefined || element.textContent?.includes(text))
          )
            resolve();
          else requestAnimationFrame(check);
        };
        check();
      });
      const elapsed = performance.now() - start;
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (observer instanceof PerformanceObserver) observer.disconnect();
      const tasks = Array.isArray(longTasks) ? longTasks.map(Number) : [];
      return {
        ms: Math.round(elapsed),
        longestTaskMs: Math.round(Math.max(0, ...tasks)),
        longTasks: tasks.length,
      };
    },
    { selector, text },
  );
}

async function heapAfterGcMb(page: Page): Promise<number> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("HeapProfiler.collectGarbage");
  const { usedSize } = await cdp.send("Runtime.getHeapUsage");
  await cdp.detach();
  return Math.round((usedSize / 1024 / 1024) * 10) / 10;
}

async function folderBytes(folder: string): Promise<number> {
  let total = 0;
  for (const name of await readdir(folder).catch((): string[] => []))
    total += (await stat(path.join(folder, name))).size;
  return total;
}

function report(entry: Record<string, unknown>) {
  console.log(`[persistence-bench] ${JSON.stringify(entry)}`);
}

let layoutry: LaunchedLayoutry | undefined;
let profile: string;
let folder: string;

test.beforeEach(async () => {
  profile = await makeTempDir("layoutry-bench-profile-");
  folder = await makeTempDir("layoutry-bench-files-");
});

test.afterEach(async () => {
  await layoutry?.dispose();
  layoutry = undefined;
  await removeDir(profile);
  await removeDir(folder);
});

test("open, snapshot and save at every project size", async () => {
  test.setTimeout(600_000);
  layoutry = await launchLayoutry({ userDataDir: profile, appPath });
  const { app, page } = layoutry;
  const status = page.locator("[data-project-status]");

  for (const size of SIZES) {
    const file = path.join(
      folder,
      `bench-${size.elements}-${size.textLength}.layoutry`,
    );
    const text = projectText(
      `bench-${size.elements}-${size.textLength}`,
      size.elements,
      size.textLength,
    );
    await writeFile(file, text);

    await scriptFileDialogs(app, { open: [file] });
    await startMeasuring(page);
    await page.keyboard.press("Control+o");
    const open = await finishMeasuring(
      page,
      "[data-project-source]",
      path.basename(file),
    );
    await expect(status).toHaveText("Saved");

    await page.getByRole("button", { name: /Rename project/ }).click();
    await page
      .getByRole("textbox", { name: "Project name" })
      .fill(`Bench ${size.label}`);
    await page.keyboard.press("Enter");
    await expect(status).toHaveText("Unsaved changes");
    await expect(page.locator("[data-recovery-status]")).toHaveCount(0);
    await startMeasuring(page);
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    const snapshot = await finishMeasuring(
      page,
      '[data-recovery-status="protected"]',
    );
    const recoveryBytes = await folderBytes(path.join(profile, "Recovery"));

    await startMeasuring(page);
    await page.keyboard.press("Control+s");
    const save = await finishMeasuring(page, "[data-project-status]", "Saved");
    await expect(page.locator("[data-recovery-status]")).toHaveCount(0);

    report({
      size: size.label,
      projectMb: Math.round((text.length / 1024 / 1024) * 100) / 100,
      open,
      snapshot,
      save,
      recoveryFolderMb: Math.round((recoveryBytes / 1024 / 1024) * 100) / 100,
      heapAfterGcMb: await heapAfterGcMb(page),
    });
  }
});

test("startup recovery scan and Restore after a hard kill (10 MB project)", async () => {
  test.setTimeout(300_000);
  const size = SIZES[3];
  const file = path.join(folder, "restore.layoutry");
  await writeFile(
    file,
    projectText("bench-restore", size.elements, size.textLength),
  );
  layoutry = await launchLayoutry({ userDataDir: profile, appPath });
  await scriptFileDialogs(layoutry.app, { open: [file] });
  await layoutry.page.keyboard.press("Control+o");
  await expect(layoutry.page.locator("[data-project-status]")).toHaveText(
    "Saved",
  );
  await layoutry.page.getByRole("button", { name: /Rename project/ }).click();
  await layoutry.page
    .getByRole("textbox", { name: "Project name" })
    .fill("Restore bench");
  await layoutry.page.keyboard.press("Enter");
  await layoutry.page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(layoutry.page.locator("[data-recovery-status]")).toHaveAttribute(
    "data-recovery-status",
    "protected",
  );
  const child = layoutry.app.process();
  killProcessTree(child.pid);
  await waitForExit(child, 15_000);
  layoutry = undefined;

  const launchedAt = Date.now();
  layoutry = await launchLayoutry({ userDataDir: profile, appPath });
  const dialog = layoutry.page.getByRole("dialog", {
    name: "Recover Unsaved Work",
  });
  await expect(dialog).toBeVisible({ timeout: 60_000 });
  const dialogAfterLaunchMs = Date.now() - launchedAt;
  const navigation = await layoutry.page.evaluate(() => {
    const [entry] = performance.getEntriesByType("navigation");
    return entry instanceof PerformanceNavigationTiming
      ? Math.round(performance.now() - entry.domContentLoadedEventEnd)
      : -1;
  });

  await startMeasuring(layoutry.page);
  await dialog.getByRole("button", { name: "Restore" }).click();
  const restore = await finishMeasuring(
    layoutry.page,
    "[data-project-status]",
    "Unsaved changes",
  );
  await expect(
    layoutry.page.getByRole("button", { name: /Rename project/ }),
  ).toContainText("Restore bench");
  report({
    size: size.label,
    dialogAfterLaunchMs,
    dialogShownMsAfterDomReady: navigation,
    restore,
    heapAfterGcMb: await heapAfterGcMb(layoutry.page),
  });
});
