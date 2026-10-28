import { expect, test, type Page } from "@playwright/test";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { makeTempDir, removeDir } from "../desktop/support/layoutryApp";
import { answerFileDialog, answerFolderDialog, answerReplaceConfirmation } from "./support/fileDialogs";
import { extractedExe, launchPackaged, type PackagedLayoutry } from "./support/packagedApp";

/**
 * EXPORT-1.4 in the real packaged Layoutry.exe: code export through the
 * genuine Windows Save dialog and folder picker (driven through Win32, not
 * mocked) onto a real disk, with Windows' own replace confirmation.
 */

let layoutry: PackagedLayoutry | undefined;
let folder: string;

test.beforeEach(async () => {
  folder = await makeTempDir("layoutry-packaged-export-");
});

test.afterEach(async () => {
  await layoutry?.dispose();
  layoutry = undefined;
  await removeDir(folder);
});

/**
 * Opens a seed project from the test folder. Export dialogs start in the
 * last export folder or Documents; the dialog helpers only confirm once the
 * exact temporary path is entered, so nothing can land in the user's folders.
 */
async function launchWithSeed() {
  const seed = path.join(folder, "Seed.layoutry");
  await writeFile(
    seed,
    JSON.stringify({
      format: "layoutry-project",
      formatVersion: 1,
      project: { id: "packaged-export-1", name: "Seed", createdAt: "2026-10-28T08:00:00.000Z", updatedAt: "2026-10-28T08:00:00.000Z" },
      document: {
        id: "page-root",
        tag: "page",
        children: [
          { id: "heading-p", tag: "h1", text: "Packaged export" },
          { id: "toggle-p", tag: "button", text: "Toggle", interactions: [{ id: "i-1", trigger: "click", action: "toggle", targetId: "panel-p" }] },
          { id: "panel-p", tag: "div", children: [{ id: "text-p", tag: "p", text: "Panel" }] },
        ],
      },
    }),
  );
  layoutry = await launchPackaged(extractedExe(), { args: [seed] });
  await expect(layoutry.page.locator("[data-document-surface] h1")).toHaveText("Packaged export");
  return layoutry;
}

function exportDialog(page: Page) {
  return page.getByRole("dialog", { name: "Export Code" });
}

async function previewOf(page: Page, file: string) {
  const dialog = exportDialog(page);
  await dialog.getByRole("tab", { name: new RegExp(`^${file.replace(".", "\\.")}`) }).click();
  return (await dialog.getByTestId("export-code").textContent()) ?? "";
}

test("saves one HTML file through the real Save dialog, with Windows' own replace confirmation", async () => {
  const { page, pid } = await launchWithSeed();
  const target = path.join(folder, "Exported page.html");
  await page.getByRole("button", { name: "Export Code" }).click();
  const dialog = exportDialog(page);
  await expect(dialog.getByTestId("export-code")).toBeVisible();
  const html = await previewOf(page, "index.html");

  // Cancel first: nothing is written.
  await dialog.getByRole("button", { name: "Save HTML File…" }).click();
  expect(answerFileDialog(pid, null)).toMatchObject({ found: true, title: "Export HTML File" });
  await expect(dialog.getByTestId("export-transfer-status")).toHaveText("Save cancelled. Nothing was saved.");
  expect(await readdir(folder)).toEqual(["Seed.layoutry"]);

  await dialog.getByRole("button", { name: "Save HTML File…" }).click();
  expect(answerFileDialog(pid, target).found).toBe(true);
  await expect(dialog.getByTestId("export-transfer-status")).toHaveText(`Saved Exported page.html to “${path.basename(folder)}”.`);
  expect(await readFile(target, "utf8")).toBe(html);

  // Same file again: Windows asks; declining writes nothing.
  await writeFile(target, "edited by hand");
  await dialog.getByRole("button", { name: "Save HTML File…" }).click();
  expect(answerFileDialog(pid, target).found).toBe(true);
  const declined = answerReplaceConfirmation(pid, false);
  expect(declined.found).toBe(true);
  expect(declined.text).toContain("Exported page.html");
  // Declining Windows' confirmation leaves the Save dialog open: cancel it.
  expect(answerFileDialog(pid, null).found).toBe(true);
  await expect(dialog.getByTestId("export-transfer-status")).toHaveText("Save cancelled. Nothing was saved.");
  expect(await readFile(target, "utf8")).toBe("edited by hand");

  await dialog.getByRole("button", { name: "Save HTML File…" }).click();
  expect(answerFileDialog(pid, target).found).toBe(true);
  expect(answerReplaceConfirmation(pid, true).found).toBe(true);
  await expect(dialog.getByTestId("export-transfer-status")).toHaveText(`Saved Exported page.html to “${path.basename(folder)}”.`);
  expect(await readFile(target, "utf8")).toBe(html);
  expect((await readdir(folder)).sort()).toEqual(["Exported page.html", "Seed.layoutry"]);
});

test("saves separate files into a folder chosen in the real folder picker", async () => {
  const { page, pid } = await launchWithSeed();
  await page.getByRole("button", { name: "Export Code" }).click();
  const dialog = exportDialog(page);
  await expect(dialog.getByTestId("export-code")).toBeVisible();
  await dialog.getByLabel("Separate files").check();
  await expect(dialog.getByRole("tab")).toHaveCount(3);
  const expected = new Map<string, string>();
  for (const file of ["index.html", "styles.css", "script.js"]) expected.set(file, await previewOf(page, file));

  await dialog.getByRole("button", { name: "Save to Folder…" }).click();
  expect(answerFolderDialog(pid, folder)).toMatchObject({ found: true, title: "Choose Export Folder" });
  await expect(dialog.getByTestId("export-transfer-status")).toHaveText(`Saved styles.css, script.js and index.html to “${path.basename(folder)}”.`);
  expect((await readdir(folder)).sort()).toEqual(["Seed.layoutry", "index.html", "script.js", "styles.css"]);
  for (const [file, content] of expected) expect(await readFile(path.join(folder, file), "utf8")).toBe(content);

  // A second export into the same folder asks inside Layoutry before replacing.
  await dialog.getByRole("button", { name: "Save to Folder…" }).click();
  expect(answerFolderDialog(pid, folder).found).toBe(true);
  await expect(dialog.getByRole("alertdialog")).toContainText(`styles.css, script.js, index.html already exist in “${path.basename(folder)}”. Replace them?`);
  await dialog.getByRole("alertdialog").getByRole("button", { name: "Keep existing files" }).click();
  await expect(dialog.getByTestId("export-transfer-status")).toHaveText("Nothing was saved. The existing files were left unchanged.");
});
