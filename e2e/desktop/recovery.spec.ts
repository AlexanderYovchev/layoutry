import { expect, test, type Page } from "@playwright/test";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  crashRenderer,
  documentNodeCount,
  dragInsertContainer,
  killProcessTree,
  launchLayoutry,
  makeTempDir,
  removeDir,
  requestWindowClose,
  scriptCloseDialog,
  scriptFileDialogs,
  waitForExit,
  type LaunchedLayoutry,
} from "./support/layoutryApp";

/**
 * PROJECT-1.4 — recovery snapshots in the real Electron app: real preload
 * and IPC, real files in the profile's Recovery folder, and real hard
 * failures (a crashed renderer, a killed process tree), not simulated
 * clean shutdowns. Native Save/Open dialogs are scripted as in
 * files.spec.ts; the packaged suite drives the genuine ones.
 */

let layoutry: LaunchedLayoutry | undefined;
let profile: string;
let folder: string;

test.beforeEach(async () => {
  profile = await makeTempDir("layoutry-recovery-profile-");
  folder = await makeTempDir("layoutry-recovery-files-");
});

test.afterEach(async () => {
  await layoutry?.dispose();
  layoutry = undefined;
  await removeDir(profile);
  await removeDir(folder);
});

function recoveryFolder() {
  return path.join(profile, "Recovery");
}

async function recoveryFiles(): Promise<string[]> {
  return (await readdir(recoveryFolder()).catch(() => [])).sort();
}

/** The header line of a record file, as the main process wrote it. */
async function recordHeader(fileName: string) {
  const text = await readFile(path.join(recoveryFolder(), fileName), "utf8");
  const parsed: unknown = JSON.parse(text.slice(0, text.indexOf("\n")));
  if (typeof parsed !== "object" || parsed === null)
    throw new Error("bad header");
  return parsed;
}

function status(page: Page) {
  return page.locator("[data-project-status]");
}

async function waitForProtection(page: Page) {
  await expect(page.locator("[data-recovery-status]")).toHaveAttribute(
    "data-recovery-status",
    "protected",
  );
}

function recoveryDialog(page: Page) {
  return page.getByRole("dialog", { name: "Recover Unsaved Work" });
}

/** Hard-kills the whole Electron process tree: no close events, no cleanup. */
async function killApp(app: LaunchedLayoutry["app"]) {
  const child = app.process();
  killProcessTree(child.pid);
  await waitForExit(child, 15_000);
}

function projectFile(name: string, heading: string, id = "file-project-1") {
  return `${JSON.stringify(
    {
      format: "layoutry-project",
      formatVersion: 1,
      project: {
        id,
        name,
        createdAt: "2026-10-28T08:00:00.000Z",
        updatedAt: "2026-10-28T08:00:00.000Z",
      },
      document: {
        id: "page-root",
        tag: "page",
        children: [{ id: "heading-f", tag: "h1", text: heading }],
      },
    },
    null,
    2,
  )}\n`;
}

test("snapshots land in the profile's Recovery folder, apart from project files, and never clear 'Unsaved'", async () => {
  layoutry = await launchLayoutry({ userDataDir: profile });
  const { page } = layoutry;
  await dragInsertContainer(page);
  await waitForProtection(page);
  await expect(status(page)).toHaveText("Unsaved changes");

  const files = await recoveryFiles();
  expect(files).toHaveLength(1);
  expect(files[0]).toMatch(/^[0-9a-f]{32}-\d+\.layoutry-recovery$/);
  expect(await recordHeader(files[0])).toMatchObject({
    format: "layoutry-recovery",
    recoveryVersion: 1,
    projectName: "Untitled Project",
    source: { kind: "unsaved" },
    association: null,
  });
  expect(await readdir(folder)).toEqual([]);
});

test("after a real renderer crash and a restart, the work is restored exactly, unsaved, and a native Save cleans up", async () => {
  layoutry = await launchLayoutry({ userDataDir: profile });
  const { app, page } = layoutry;
  await dragInsertContainer(page);
  await dragInsertContainer(page);
  const nodes = await documentNodeCount(page);
  await waitForProtection(page);

  await crashRenderer(app);
  // The user closes the dead window; the native fallback asks once.
  await scriptCloseDialog(app, "discard");
  const child = app.process();
  await requestWindowClose(app).catch(() => undefined);
  expect(await waitForExit(child, 15_000)).toBe(0);
  layoutry = undefined;

  layoutry = await launchLayoutry({ userDataDir: profile });
  const dialog = recoveryDialog(layoutry.page);
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Untitled Project");
  await dialog.getByRole("button", { name: "Restore" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => documentNodeCount(layoutry!.page)).toBe(nodes);
  await expect(status(layoutry.page)).toHaveText("Unsaved changes");

  const target = path.join(folder, "Recovered.layoutry");
  await scriptFileDialogs(layoutry.app, { save: [target] });
  await layoutry.page.keyboard.press("Control+s");
  await expect(status(layoutry.page)).toHaveText("Saved");
  expect(await readdir(folder)).toEqual(["Recovered.layoutry"]);
  await expect.poll(recoveryFiles).toEqual([]);
});

test("after the whole app is killed, the work is offered at the next start", async () => {
  layoutry = await launchLayoutry({ userDataDir: profile });
  await dragInsertContainer(layoutry.page);
  await waitForProtection(layoutry.page);
  await killApp(layoutry.app);
  layoutry = undefined;

  layoutry = await launchLayoutry({ userDataDir: profile });
  await expect(recoveryDialog(layoutry.page)).toBeVisible();
  // Keep for Later: nothing is deleted, and it is offered again next time.
  await recoveryDialog(layoutry.page)
    .getByRole("button", { name: "Keep for Later" })
    .click();
  expect(await recoveryFiles()).toHaveLength(1);
  await layoutry.page.getByRole("menuitem", { name: "File" }).click();
  await layoutry.page
    .getByRole("menuitem", { name: "Recover Unsaved Work…" })
    .click();
  await expect(recoveryDialog(layoutry.page)).toBeVisible();
});

test("restored work never overwrites its file after someone else changed it", async () => {
  const target = path.join(folder, "Shared.layoutry");
  await writeFile(target, projectFile("Shared", "Original heading"));
  layoutry = await launchLayoutry({
    userDataDir: profile,
    extraArgs: [target],
  });
  await expect(layoutry.page.locator("[data-document-surface] h1")).toHaveText(
    "Original heading",
  );
  await dragInsertContainer(layoutry.page);
  await waitForProtection(layoutry.page);
  expect(await recordHeader((await recoveryFiles())[0])).toMatchObject({
    source: { kind: "file", fileName: "Shared.layoutry" },
  });
  await killApp(layoutry.app);
  layoutry = undefined;

  // A colleague edits the file while Layoutry is down.
  const external = projectFile("Shared", "Colleague's heading");
  await writeFile(target, external);

  layoutry = await launchLayoutry({ userDataDir: profile });
  const dialog = recoveryDialog(layoutry.page);
  await expect(dialog).toContainText("From the file Shared.layoutry");
  await expect(dialog).toContainText("The saved copy has changed since then");
  // No path is ever shown.
  await expect(dialog).not.toContainText(folder);
  await dialog.getByRole("button", { name: "Restore" }).click();
  await expect(dialog).toBeHidden();
  await expect(layoutry.page.locator("[data-project-source]")).toHaveText(
    /Shared\.layoutry/,
  );

  await layoutry.page.keyboard.press("Control+s");
  const conflict = layoutry.page.getByRole("dialog", {
    name: "File Changed Outside Layoutry",
  });
  await expect(conflict).toBeVisible();
  await conflict.getByRole("button", { name: "Cancel" }).click();
  expect(await readFile(target, "utf8")).toBe(external);
  await expect(status(layoutry.page)).toHaveText("Unsaved changes");
});

test("an interrupted write is cleaned up and a truncated record is offered only for discarding", async () => {
  const session = "f".repeat(32);
  const header = {
    format: "layoutry-recovery",
    recoveryVersion: 1,
    recordId: `${session}-1`,
    sessionId: session,
    generation: 1,
    projectId: "torn-1",
    projectName: "Torn",
    savedAt: "2026-10-28T09:00:00.000Z",
    source: { kind: "unsaved" },
    textBytes: 5000,
    sha256: "0".repeat(64),
    association: null,
  };
  const { mkdir } = await import("node:fs/promises");
  await mkdir(recoveryFolder(), { recursive: true });
  await writeFile(
    path.join(recoveryFolder(), `${session}-1.layoutry-recovery`),
    `${JSON.stringify(header)}\n{"format":"layoutry-project"`,
  );
  const temp = `.${session}-2.0123456789abcdef01234567.recovery-tmp`;
  await writeFile(path.join(recoveryFolder(), temp), "half");

  layoutry = await launchLayoutry({ userDataDir: profile });
  const dialog = recoveryDialog(layoutry.page);
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("damaged and can't be restored");
  await expect(dialog.getByRole("button", { name: "Restore" })).toBeDisabled();
  expect(await recoveryFiles()).toEqual([`${session}-1.layoutry-recovery`]);

  await dialog.getByRole("button", { name: "Discard…" }).click();
  await dialog.getByRole("button", { name: "Discard Permanently" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(recoveryFiles).toEqual([]);
});

test("a clean close, or an explicit Don't Save, leaves nothing to recover", async () => {
  layoutry = await launchLayoutry({ userDataDir: profile });
  await dragInsertContainer(layoutry.page);
  await waitForProtection(layoutry.page);
  const child = layoutry.app.process();
  await requestWindowClose(layoutry.app);
  const prompt = layoutry.page.getByRole("dialog", { name: "Unsaved Changes" });
  await prompt.getByRole("button", { name: "Don't Save" }).click();
  expect(await waitForExit(child, 15_000)).toBe(0);
  layoutry = undefined;
  expect(await recoveryFiles()).toEqual([]);

  layoutry = await launchLayoutry({ userDataDir: profile });
  await expect(status(layoutry.page)).toHaveText("Not saved");
  await layoutry.page.waitForTimeout(1000);
  await expect(recoveryDialog(layoutry.page)).toBeHidden();
});

test("the recovery bridge only accepts its own validated calls", async () => {
  layoutry = await launchLayoutry({ userDataDir: profile });
  const result = await layoutry.page.evaluate(async () => {
    const api: unknown = Reflect.get(window, "layoutryDesktop");
    if (typeof api !== "object" || api === null) return null;
    const call = async (name: string, ...args: unknown[]) => {
      try {
        const fn: unknown = Reflect.get(api, name);
        if (typeof fn !== "function") return "missing";
        await fn(...args);
        return "accepted";
      } catch {
        return "rejected";
      }
    };
    return {
      keys: Object.keys(api).sort(),
      require: typeof Reflect.get(window, "require"),
      process: typeof Reflect.get(window, "process"),
      readPath: await call("readRecovery", "..\\..\\Windows\\win.ini", true),
      discardPath: await call("discardRecovery", ["C:\\Windows\\win.ini"]),
      writeJunk: await call("writeRecoverySnapshot", {
        generation: 1,
        source: { kind: "unsaved" },
        sha256: "0".repeat(64),
        text: "not a project",
      }),
      writePathSource: await call("writeRecoverySnapshot", {
        generation: 1,
        source: { kind: "file", token: "../../x", fileName: "x.layoutry" },
        sha256: "0".repeat(64),
        text: "{}",
      }),
    };
  });
  expect(result).toMatchObject({
    require: "undefined",
    process: "undefined",
    readPath: "rejected",
    discardPath: "rejected",
    writeJunk: "rejected",
    writePathSource: "rejected",
  });
  expect(result?.keys).toEqual(
    [
      "apiVersion",
      "beginRecoverySession",
      "chooseSaveLocation",
      "discardRecovery",
      "listRecovery",
      "onCloseRequested",
      "onPendingProjectFile",
      "openProjectFile",
      "readRecovery",
      "releaseProjectFile",
      "respondToCloseRequest",
      "setUnsavedChanges",
      "takePendingProjectFile",
      "writeProjectFile",
      "writeRecoverySnapshot",
    ].sort(),
  );
});

test("snapshot latency and main-thread blocking for representative project sizes", async () => {
  test.setTimeout(240_000);
  const sizes = [
    { label: "500 elements", elements: 500, textLength: 20 },
    { label: "5,000 elements", elements: 5_000, textLength: 20 },
    { label: "5,000 elements, long texts", elements: 5_000, textLength: 2_000 },
  ];
  layoutry = await launchLayoutry({ userDataDir: profile });
  const { app, page } = layoutry;
  for (const [index, size] of sizes.entries()) {
    const file = path.join(
      folder,
      `perf-${size.elements}-${size.textLength}.layoutry`,
    );
    const children = Array.from({ length: size.elements }, (_, index) => ({
      id: `p-${index.toString(16).padStart(8, "0")}`,
      tag: "p",
      text: `${index} `.padEnd(size.textLength, "x"),
    }));
    const text = `${JSON.stringify({
      format: "layoutry-project",
      formatVersion: 1,
      project: {
        id: `perf-${size.elements}-${size.textLength}`,
        name: "Perf",
        createdAt: "2026-10-28T08:00:00.000Z",
        updatedAt: "2026-10-28T08:00:00.000Z",
      },
      document: { id: "page-root", tag: "page", children },
    })}\n`;
    await writeFile(file, text);
    await scriptFileDialogs(app, { open: [file] });
    await page.keyboard.press("Control+o");
    if (index > 0)
      await page
        .getByRole("dialog", { name: "Unsaved Changes" })
        .getByRole("button", { name: "Don't Save" })
        .click();
    await expect(page.locator("[data-project-source]")).toContainText(
      path.basename(file),
    );
    await expect(status(page)).toHaveText("Saved");

    // A deterministic unsaved change (rename), then measure one snapshot,
    // triggered immediately by the window losing focus.
    await page.getByRole("button", { name: /Rename project/ }).click();
    await page
      .getByRole("textbox", { name: "Project name" })
      .fill(`Perf ${size.label}`);
    await page.keyboard.press("Enter");
    await expect(status(page)).toHaveText("Unsaved changes");
    // Not captured yet (the 2 s debounce hasn't run): the measurement is valid.
    await expect(page.locator("[data-recovery-status]")).toHaveCount(0);
    const measured = await page.evaluate(async () => {
      const longTasks: number[] = [];
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) longTasks.push(entry.duration);
      });
      observer.observe({ type: "longtask" });
      const start = performance.now();
      window.dispatchEvent(new Event("blur"));
      await new Promise<void>((resolve) => {
        const check = () =>
          document.querySelector('[data-recovery-status="protected"]')
            ? resolve()
            : requestAnimationFrame(check);
        check();
      });
      const elapsed = performance.now() - start;
      await new Promise((resolve) => setTimeout(resolve, 100));
      observer.disconnect();
      return {
        elapsedMs: Math.round(elapsed),
        longestTaskMs: Math.round(Math.max(0, ...longTasks)),
      };
    });
    const [record] = (await recoveryFiles()).slice(-1);
    const bytes = (await readFile(path.join(recoveryFolder(), record))).length;
    console.log(
      `[recovery perf] ${size.label}: ${(text.length / 1024 / 1024).toFixed(2)} MB project → snapshot protected in ${measured.elapsedMs} ms, longest main-thread task ${measured.longestTaskMs} ms, record ${(bytes / 1024 / 1024).toFixed(2)} MB`,
    );
    expect(measured.elapsedMs).toBeLessThan(10_000);
    // PROJECT-1.5: the snapshot was prepared by the real worker, not by
    // the on-page fallback.
    expect(page.workers().length).toBeGreaterThanOrEqual(1);
  }
});
