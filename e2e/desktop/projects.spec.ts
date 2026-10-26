import { expect, test, type Page } from "@playwright/test";
import {
  documentNodeCount,
  dragInsertContainer,
  launchLayoutry,
  makeTempDir,
  removeDir,
  requestWindowClose,
  scriptCloseDialog,
  waitForExit,
  type LaunchedLayoutry,
} from "./support/layoutryApp";

/**
 * PROJECT-1.2 in the real desktop shell: the browser project library runs
 * unchanged on the app://layoutry origin (IndexedDB in the user's Electron
 * profile), and the native close confirmation still closes a window whose
 * page reports unsaved changes.
 */

let layoutry: LaunchedLayoutry | undefined;
let profile: string | undefined;

test.afterEach(async () => {
  await layoutry?.dispose();
  layoutry = undefined;
  if (profile) await removeDir(profile);
  profile = undefined;
});

async function saveNewProject(page: Page, name: string) {
  await page.keyboard.press("Control+s");
  const dialog = page.getByRole("dialog", { name: "Save Project" });
  await dialog.getByRole("textbox", { name: "Project name" }).fill(name);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.locator("[data-project-status]")).toHaveAttribute(
    "data-project-status",
    "saved",
  );
}

/** Closes through the real close path (native confirmation → Discard and Close). */
async function closeGracefully(launched: LaunchedLayoutry) {
  await scriptCloseDialog(launched.app, "discard");
  const child = launched.app.process();
  await requestWindowClose(launched.app).catch(() => {
    // the main process may already be exiting
  });
  return waitForExit(child, 15_000);
}

test("a project saved in the desktop app is still there after a restart", async () => {
  profile = await makeTempDir("layoutry-desktop-projects-");
  layoutry = await launchLayoutry({ userDataDir: profile });
  const before = await documentNodeCount(layoutry.page);
  await dragInsertContainer(layoutry.page);
  await expect.poll(() => documentNodeCount(layoutry!.page)).toBe(before + 1);
  await saveNewProject(layoutry.page, "Desktop project");

  expect(await closeGracefully(layoutry)).toBe(0);
  layoutry = undefined;

  layoutry = await launchLayoutry({ userDataDir: profile });
  const { page } = layoutry;
  expect(await documentNodeCount(page)).toBe(before);

  await page.keyboard.press("Control+o");
  await page
    .getByRole("dialog", { name: "Open Project" })
    .getByRole("button", { name: "Open Desktop project" })
    .click();

  await expect(
    page.getByRole("button", {
      name: "Project: Desktop project. Rename project",
    }),
  ).toBeVisible();
  await expect.poll(() => documentNodeCount(page)).toBe(before + 1);
});

test("a window with unsaved changes closes once the native warning is confirmed", async () => {
  layoutry = await launchLayoutry();
  const before = await documentNodeCount(layoutry.page);
  await dragInsertContainer(layoutry.page);
  await expect.poll(() => documentNodeCount(layoutry!.page)).toBe(before + 1);
  await expect(layoutry.page.locator("[data-project-status]")).toHaveText(
    "Unsaved changes",
  );

  // Left unanswered on purpose: Playwright would otherwise answer the
  // page's beforeunload itself. The main process must let the page unload
  // after its own native confirmation, or the window silently stays open.
  const pageDialogs: string[] = [];
  layoutry.page.on("dialog", (dialog) => pageDialogs.push(dialog.type()));

  expect(await closeGracefully(layoutry)).toBe(0);
});

test("Ctrl+N starts a new project in the desktop app after confirming", async () => {
  layoutry = await launchLayoutry();
  const { page } = layoutry;
  await dragInsertContainer(page);

  await page.keyboard.press("Control+n");
  await page
    .getByRole("dialog", { name: "Unsaved Changes" })
    .getByRole("button", { name: "Don't Save" })
    .click();

  await expect(page.locator("[data-project-status]")).toHaveText("Not saved");
  // A new project is an empty page: the starter content is gone.
  await expect(page.locator("[data-document-surface] h1")).toHaveCount(0);
});
