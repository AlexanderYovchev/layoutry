import { expect, test, type Page } from "@playwright/test";
import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  documentNodeCount,
  dragInsertContainer,
  killProcessTree,
  makeTempDir,
  removeDir,
  waitForExit,
} from "../desktop/support/layoutryApp";
import { answerFileDialog } from "./support/fileDialogs";
import {
  extractedAppDir,
  extractedExe,
  launchPackaged,
  type PackagedLayoutry,
} from "./support/packagedApp";
import { nativeDialog, requestMainWindowClose } from "./support/windows";

/**
 * PROJECT-1.4 in the real packaged Layoutry.exe, outside the repository:
 * recovery files live in the (isolated test) profile, never in the
 * extracted app folder; real hard failures (a killed process tree, a
 * crashed renderer answered through the genuine native fallback dialog);
 * the genuine Windows Save dialog. A seed file from a temp folder makes
 * that folder the dialogs' default, so nothing can land in Documents.
 */

let layoutry: PackagedLayoutry | undefined;
let profile: string;
let folder: string;

test.beforeEach(async () => {
  profile = await makeTempDir("layoutry-packaged-recovery-profile-");
  folder = await makeTempDir("layoutry-packaged-recovery-files-");
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

function recoveryDialog(page: Page) {
  return page.getByRole("dialog", { name: "Recover Unsaved Work" });
}

async function recoveryFiles(): Promise<string[]> {
  return (await readdir(path.join(profile, "Recovery")).catch(() => [])).sort();
}

async function appFolderFiles(): Promise<string[]> {
  return (await readdir(extractedAppDir(), { recursive: true }))
    .map(String)
    .sort();
}

async function seedFile(): Promise<string> {
  const seed = path.join(folder, "Seed.layoutry");
  await writeFile(
    seed,
    JSON.stringify({
      format: "layoutry-project",
      formatVersion: 1,
      project: {
        id: "packaged-seed-1",
        name: "Seed",
        createdAt: "2026-10-28T08:00:00.000Z",
        updatedAt: "2026-10-28T08:00:00.000Z",
      },
      document: {
        id: "page-root",
        tag: "page",
        children: [{ id: "heading-s", tag: "h1", text: "Seed project" }],
      },
    }),
  );
  return seed;
}

/** Starts a new project with one unsaved change, protected by a snapshot. */
async function unsavedProtectedWork(page: Page): Promise<number> {
  await expect(page.locator("[data-document-surface] h1")).toHaveText(
    "Seed project",
  );
  await page.keyboard.press("Control+n");
  await expect(page.locator("[data-document-surface] h1")).toHaveCount(0);
  await dragInsertContainer(page);
  await expect(page.locator("[data-recovery-status]")).toHaveAttribute(
    "data-recovery-status",
    "protected",
  );
  return documentNodeCount(page);
}

test("after the app is killed, its work comes back from the profile — never the app folder — and a real Save cleans up", async () => {
  test.setTimeout(120_000);
  const appBefore = await appFolderFiles();
  const seed = await seedFile();
  layoutry = await launchPackaged(extractedExe(), {
    userDataDir: profile,
    args: [seed],
  });
  const nodes = await unsavedProtectedWork(layoutry.page);
  expect(await recoveryFiles()).toHaveLength(1);

  // Hard failure: the whole process tree dies at once.
  killProcessTree(layoutry.pid);
  await waitForExit(layoutry.child, 15_000);
  await layoutry.browser.close().catch(() => undefined);
  layoutry = undefined;

  // Restarted with a file on its command line: recovery is offered first.
  layoutry = await launchPackaged(extractedExe(), {
    userDataDir: profile,
    args: [seed],
  });
  const { page, pid } = layoutry;
  const dialog = recoveryDialog(page);
  await expect(dialog).toBeVisible();
  await expect(page.locator("[data-document-surface] h1")).toHaveCount(1);
  await dialog.getByRole("button", { name: "Restore" }).click();
  await expect(dialog).toBeHidden();
  // The deferred file now asks before replacing the restored work: keep it.
  const prompt = page.getByRole("dialog", { name: "Unsaved Changes" });
  await prompt.getByRole("button", { name: "Cancel" }).click();
  await expect.poll(() => documentNodeCount(page)).toBe(nodes);
  await expect(status(page)).toHaveText("Unsaved changes");

  const target = path.join(folder, "Recovered.layoutry");
  await page.keyboard.press("Control+s");
  expect(answerFileDialog(pid, target)).toMatchObject({
    found: true,
    title: "Save Project",
  });
  await expect(status(page)).toHaveText("Saved");
  expect((await readdir(folder)).sort()).toEqual([
    "Recovered.layoutry",
    "Seed.layoutry",
  ]);
  await expect.poll(recoveryFiles).toEqual([]);
  expect(await appFolderFiles()).toEqual(appBefore);
});

test("after a real renderer crash and the native fallback, the next start offers the work; Discard removes it", async () => {
  test.setTimeout(120_000);
  const seed = await seedFile();
  layoutry = await launchPackaged(extractedExe(), {
    userDataDir: profile,
    args: [seed],
  });
  await unsavedProtectedWork(layoutry.page);
  const { page, pid, child } = layoutry;

  const cdp = await page.context().newCDPSession(page);
  const crashed = page.waitForEvent("crash", { timeout: 15_000 });
  // The reply never arrives: the target dies. Wait for the crash itself.
  void cdp.send("Page.crash").catch(() => undefined);
  await crashed;
  requestMainWindowClose(pid);
  const fallback = nativeDialog(pid, "Discard and Close", 15);
  expect(fallback.found).toBe(true);
  expect(fallback.text).toContain("recovery");
  expect(await waitForExit(child, 15_000)).toBe(0);
  await layoutry.browser.close().catch(() => undefined);
  layoutry = undefined;
  expect(await recoveryFiles()).toHaveLength(1);

  layoutry = await launchPackaged(extractedExe(), { userDataDir: profile });
  const dialog = recoveryDialog(layoutry.page);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Discard…" }).click();
  await dialog.getByRole("button", { name: "Discard Permanently" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(recoveryFiles).toEqual([]);
});

test("Don't Save on close leaves nothing to recover, and the page still has no Node.js", async () => {
  const seed = await seedFile();
  layoutry = await launchPackaged(extractedExe(), {
    userDataDir: profile,
    args: [seed],
  });
  await unsavedProtectedWork(layoutry.page);
  const { page, pid, child } = layoutry;
  expect(
    await page.evaluate(() => [
      typeof Reflect.get(window, "require"),
      typeof Reflect.get(window, "process"),
    ]),
  ).toEqual(["undefined", "undefined"]);

  requestMainWindowClose(pid);
  await page
    .getByRole("dialog", { name: "Unsaved Changes" })
    .getByRole("button", { name: "Don't Save" })
    .click();
  expect(await waitForExit(child, 15_000)).toBe(0);
  await layoutry.browser.close().catch(() => undefined);
  layoutry = undefined;
  expect(await recoveryFiles()).toEqual([]);

  layoutry = await launchPackaged(extractedExe(), { userDataDir: profile });
  await layoutry.page.waitForTimeout(1500);
  await expect(recoveryDialog(layoutry.page)).toBeHidden();
});
