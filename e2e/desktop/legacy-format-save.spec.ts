import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { copyFile, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  dragInsertContainer,
  fileDialogCalls,
  launchLayoutry,
  makeTempDir,
  REPO_ROOT,
  removeDir,
  requestWindowClose,
  scriptFileDialogs,
  type LaunchedLayoutry,
} from "./support/layoutryApp";

/**
 * BC-05.4 — the first save of a format 1 project in the real Electron app,
 * on real files: Save offers Save As (recommended) / Overwrite Original /
 * Cancel, nothing is written before the choice, the original stays
 * byte-identical on Cancel and Save As, Overwrite upgrades it only on that
 * explicit choice, and no prompt repeats after a successful format 2 save.
 * The original is a copy of bytes a PROJECT-1.3 build wrote.
 */

const FIXTURE = path.join(
  REPO_ROOT,
  "test",
  "fixtures",
  "persistence",
  "native-site-original-1.3.layoutry",
);

let layoutry: LaunchedLayoutry | undefined;
let folder: string;
let original: string;
let originalHash: string;

const sha256 = async (file: string) =>
  createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
const formatOf = async (file: string) =>
  (JSON.parse(await readFile(file, "utf8")) as { formatVersion: number })
    .formatVersion;
const status = (page: Page) => page.locator("[data-project-status]");
const upgradeDialog = (page: Page) =>
  page.getByRole("dialog", { name: "Upgrade Project File?" });

test.beforeEach(async () => {
  folder = await makeTempDir("layoutry-legacy-save-");
  original = path.join(folder, "Legacy Site.layoutry");
  await copyFile(FIXTURE, original);
  originalHash = await sha256(original);
  expect(await formatOf(original)).toBe(1);
});

test.afterEach(async () => {
  await layoutry?.dispose();
  layoutry = undefined;
  await removeDir(folder);
});

async function openEdited(): Promise<LaunchedLayoutry> {
  const launched = await launchLayoutry({ extraArgs: [original] });
  await expect(launched.page.locator("[data-project-source]")).toHaveText(
    /Legacy Site\.layoutry/,
  );
  await dragInsertContainer(launched.page);
  await expect(status(launched.page)).toHaveText("Unsaved changes");
  return launched;
}

test("Cancel (and Escape) write nothing; Save As keeps the original byte-identical; later saves don't ask", async () => {
  layoutry = await openEdited();
  const { app, page } = layoutry;
  const copy = path.join(folder, "Legacy Site (v2).layoutry");
  await scriptFileDialogs(app, { save: [copy] });

  await page.keyboard.press("Control+s");
  const dialog = upgradeDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(
    "may not open in older versions of Layoutry",
  );
  // Save As is the recommended, focused choice.
  await expect(
    dialog.getByRole("button", { name: "Save As… (Recommended)" }),
  ).toBeFocused();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  expect(await sha256(original)).toBe(originalHash);
  await expect(status(page)).toHaveText("Unsaved changes");

  await page.keyboard.press("Control+s");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  expect(await sha256(original)).toBe(originalHash);
  expect(await fileDialogCalls(app)).toEqual([]);

  await page.keyboard.press("Control+s");
  await dialog.getByRole("button", { name: "Save As… (Recommended)" }).click();
  await expect(page.locator("[data-project-source]")).toHaveText(
    /Legacy Site \(v2\)\.layoutry/,
  );
  await expect(status(page)).toHaveText("Saved");
  expect(await sha256(original)).toBe(originalHash);
  expect(await formatOf(copy)).toBe(2);

  // The project now lives in a format 2 file: Save writes straight to it.
  await dragInsertContainer(page);
  await page.keyboard.press("Control+s");
  await expect(status(page)).toHaveText("Saved");
  await expect(dialog).toBeHidden();
  expect((await fileDialogCalls(app)).map((call) => call.kind)).toEqual([
    "save",
  ]);
  expect(await sha256(original)).toBe(originalHash);
});

test("a cancelled Save As dialog writes nothing", async () => {
  layoutry = await openEdited();
  const { app, page } = layoutry;
  await scriptFileDialogs(app, { save: [null] });
  await page.keyboard.press("Control+s");
  await upgradeDialog(page)
    .getByRole("button", { name: "Save As… (Recommended)" })
    .click();
  await expect.poll(async () => (await fileDialogCalls(app)).length).toBe(1);
  await expect(status(page)).toHaveText("Unsaved changes");
  expect(await readdir(folder)).toEqual(["Legacy Site.layoutry"]);
  expect(await sha256(original)).toBe(originalHash);
});

test("Overwrite Original upgrades the file only on that choice, and never asks again", async () => {
  layoutry = await openEdited();
  const { page } = layoutry;
  await page.keyboard.press("Control+s");
  await upgradeDialog(page)
    .getByRole("button", { name: "Overwrite Original" })
    .click();
  await expect(status(page)).toHaveText("Saved");
  expect(await formatOf(original)).toBe(2);
  expect(await readdir(folder)).toEqual(["Legacy Site.layoutry"]);

  await dragInsertContainer(page);
  await page.keyboard.press("Control+s");
  await expect(status(page)).toHaveText("Saved");
  await expect(upgradeDialog(page)).toBeHidden();
});

test("closing with unsaved work: Save asks about the format first and the window stays open", async () => {
  layoutry = await openEdited();
  const { app, page } = layoutry;
  await requestWindowClose(app);
  await page
    .getByRole("dialog", { name: "Unsaved Changes" })
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(upgradeDialog(page)).toBeVisible();
  expect(
    await app.evaluate(
      ({ BrowserWindow }) => BrowserWindow.getAllWindows().length,
    ),
  ).toBe(1);
  expect(await sha256(original)).toBe(originalHash);
  await upgradeDialog(page).getByRole("button", { name: "Cancel" }).click();
  await expect(status(page)).toHaveText("Unsaved changes");
  expect(await sha256(original)).toBe(originalHash);
});
