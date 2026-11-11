import { chromium, expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fileDialogCalls, launchLayoutry, makeTempDir, removeDir, REPO_ROOT, scriptFileDialogs, type LaunchedLayoutry } from "./support/layoutryApp";
import { canvasImage, dataUrlOf, imageFixture, imageFixtureBytes, insertImage, inspectorPanel, uploadInput } from "../support/imageUploads";

/**
 * BC-07.3 in the real Electron app, on real folders: Separate files writes
 * index.html, styles.css and an assets folder with the uploaded images'
 * exact bytes; the folder opens offline in a browser; an existing export is
 * only replaced after confirmation; a cancelled dialog and a blocked assets
 * folder write nothing and say so; a format 1 project exports its upload
 * while BC-05's upgrade protection stays in charge of saving.
 */

const PNG = dataUrlOf("upload-40x30.png", "image/png");
const JPEG = dataUrlOf("upload-32x24.jpg", "image/jpeg");

let layoutry: LaunchedLayoutry | undefined;
let folder: string;

test.beforeEach(async () => {
  folder = await makeTempDir("layoutry-export-assets-");
});
test.afterEach(async () => {
  await layoutry?.dispose();
  layoutry = undefined;
  await removeDir(folder);
});

const exportDialog = (page: Page) => page.getByRole("dialog", { name: "Export Code" });
const transferStatus = (page: Page) => exportDialog(page).getByTestId("export-transfer-status");
const status = (page: Page) => page.locator("[data-project-status]");

async function openSeparateExport(page: Page) {
  await page.getByRole("menuitem", { name: "File" }).click();
  await page.getByRole("menuitem", { name: "Export Code…" }).click();
  const dialog = exportDialog(page);
  await expect(dialog.getByTestId("export-code")).toBeVisible();
  await dialog.getByLabel("Separate files").check();
  await expect(dialog.getByTestId("export-image-files")).toBeVisible();
  return dialog;
}

async function tree(root: string, prefix = ""): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => (entry.isDirectory() ? tree(path.join(root, entry.name), `${prefix}${entry.name}/`) : [`${prefix}${entry.name}`])));
  return nested.flat().sort();
}

test("Save to Folder writes the assets folder with exact bytes; the site opens offline; re-export asks before replacing", async () => {
  const site = path.join(folder, "Site");
  await mkdir(site);
  await writeFile(path.join(site, "notes.txt"), "keep me");
  layoutry = await launchLayoutry();
  const { app, page } = layoutry;
  const first = await insertImage(page);
  await uploadInput(page).setInputFiles(imageFixture("upload-40x30.png"));
  await expect.poll(() => canvasImage(page, first).getAttribute("src")).toBe(PNG);
  await inspectorPanel(page).getByRole("textbox", { name: "Alt text" }).fill("Swatch");
  await inspectorPanel(page).getByRole("textbox", { name: "Alt text" }).press("Enter");
  const second = await insertImage(page);
  await uploadInput(page).setInputFiles(imageFixture("upload-32x24.jpg"));
  await expect.poll(() => canvasImage(page, second).getAttribute("src")).toBe(JPEG);
  const statusBefore = await status(page).getAttribute("data-project-status");

  await scriptFileDialogs(app, { open: [null, site, site, site] });
  const dialog = await openSeparateExport(page);

  // A cancelled folder dialog writes nothing and says so.
  await dialog.getByRole("button", { name: "Save to Folder…" }).click();
  await expect(transferStatus(page)).toHaveText("Save cancelled. Nothing was saved.");
  expect(await tree(site)).toEqual(["notes.txt"]);

  await dialog.getByRole("button", { name: "Save to Folder…" }).click();
  // The main process reports files in the order it writes them (index.html last), as before BC-07.3.
  await expect(transferStatus(page)).toHaveText(`Saved styles.css, index.html and 2 image files in assets to “Site”.`);
  expect(await tree(site)).toEqual(["assets/image-001.png", "assets/image-002.jpg", "index.html", "notes.txt", "styles.css"]);
  expect((await readFile(path.join(site, "assets", "image-001.png"))).equals(imageFixtureBytes("upload-40x30.png"))).toBe(true);
  expect((await readFile(path.join(site, "assets", "image-002.jpg"))).equals(imageFixtureBytes("upload-32x24.jpg"))).toBe(true);
  const html = await readFile(path.join(site, "index.html"), "utf8");
  expect(html).toContain(`src="assets/image-001.png" alt="Swatch"`);
  expect(html).toContain(`src="assets/image-002.jpg"`);
  expect(await readFile(path.join(site, "notes.txt"), "utf8")).toBe("keep me");
  // Exporting is not saving.
  await expect(status(page)).toHaveAttribute("data-project-status", statusBefore ?? "");
  expect(await canvasImage(page, first).getAttribute("src")).toBe(PNG);

  // Exporting again into the same folder: every existing file is named, and nothing changes until Replace.
  await dialog.getByRole("button", { name: "Save to Folder…" }).click();
  const prompt = dialog.getByRole("alertdialog");
  await expect(prompt).toContainText("assets/image-001.png, assets/image-002.jpg, styles.css, index.html already exist in “Site”.");
  await prompt.getByRole("button", { name: "Keep existing files" }).click();
  await expect(transferStatus(page)).toHaveText("Nothing was saved. The existing files were left unchanged.");
  await dialog.getByRole("button", { name: "Save to Folder…" }).click();
  await dialog.getByRole("alertdialog").getByRole("button", { name: "Replace" }).click();
  await expect(transferStatus(page)).toContainText("2 image files in assets");
  expect((await fileDialogCalls(app)).map((call) => call.kind)).toEqual(["open", "open", "open", "open"]);
  await page.keyboard.press("Escape");

  // The exported folder works on its own, offline, in an ordinary browser.
  const browser = await chromium.launch();
  try {
    const viewer = await browser.newPage();
    await viewer.route(/^https?:/, (route) => route.abort());
    await viewer.goto(pathToFileURL(path.join(site, "index.html")).href);
    const sizes = await viewer.locator("img").evaluateAll((images) =>
      Promise.all(
        (images as HTMLImageElement[]).map(async (image) => {
          await image.decode();
          return [image.getAttribute("src"), image.naturalWidth, image.naturalHeight, image.alt];
        }),
      ),
    );
    expect(sizes).toEqual(expect.arrayContaining([["assets/image-001.png", 40, 30, "Swatch"], ["assets/image-002.jpg", 32, 24, ""]]));
  } finally {
    await browser.close();
  }
});

test("an assets entry that is a file blocks the export with a clear error and nothing is written", async () => {
  await writeFile(path.join(folder, "assets"), "not a folder");
  layoutry = await launchLayoutry();
  const { app, page } = layoutry;
  const id = await insertImage(page);
  await uploadInput(page).setInputFiles(imageFixture("upload-40x30.png"));
  await expect.poll(() => canvasImage(page, id).getAttribute("src")).toBe(PNG);
  await scriptFileDialogs(app, { open: [folder] });
  const dialog = await openSeparateExport(page);
  await dialog.getByRole("button", { name: "Save to Folder…" }).click();
  await expect(dialog.getByRole("alert")).toContainText("“assets” in “");
  await expect(dialog.getByRole("alert")).toContainText("is a file");
  expect(await tree(folder)).toEqual(["assets"]);
  expect(await readFile(path.join(folder, "assets"), "utf8")).toBe("not a folder");
});

test("a format 1 project exports its uploaded image while the original file stays protected", async () => {
  const original = path.join(folder, "Legacy.layoutry");
  const site = path.join(folder, "Exported");
  await mkdir(site);
  await copyFile(path.join(REPO_ROOT, "test", "fixtures", "persistence", "project-1.1-every-element.layoutry"), original);
  const sha = async () => createHash("sha256").update(await readFile(original)).digest("hex");
  const originalHash = await sha();
  layoutry = await launchLayoutry({ extraArgs: [original] });
  const { app, page } = layoutry;
  await expect(page.locator("[data-project-source]")).toHaveText(/Legacy\.layoutry/);
  await canvasImage(page, "img-3c639ec3").click();
  await uploadInput(page).setInputFiles(imageFixture("upload-32x24.jpg"));
  await expect.poll(() => canvasImage(page, "img-3c639ec3").getAttribute("src")).toBe(JPEG);

  await scriptFileDialogs(app, { open: [site] });
  const dialog = await openSeparateExport(page);
  await dialog.getByRole("button", { name: "Save to Folder…" }).click();
  await expect(transferStatus(page)).toContainText("1 image file in assets");
  expect((await tree(site)).filter((name) => name.startsWith("assets/"))).toEqual(["assets/image-001.jpg"]);
  const html = await readFile(path.join(site, "index.html"), "utf8");
  // Remote, relative and SVG-placeholder sources are exported exactly as before.
  expect(html).toContain('src="https://example.com/photo.png"');
  expect(html).toContain('poster="poster.jpg"');
  expect(html).toContain("data:image/svg+xml;utf8,");
  await page.keyboard.press("Escape");

  expect(await sha()).toBe(originalHash);
  // Saving still goes through BC-05's upgrade prompt (File › Save: this file has an authored open Dialog, PRJ-K1).
  await page.getByRole("menuitem", { name: "File" }).click();
  await page.getByRole("menuitem", { name: "Save", exact: true }).click();
  const prompt = page.getByRole("dialog", { name: "Upgrade Project File?" });
  await expect(prompt).toBeVisible();
  await prompt.getByRole("button", { name: "Cancel" }).click();
  expect(await sha()).toBe(originalHash);
});
