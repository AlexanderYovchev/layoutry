import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rename } from "node:fs/promises";
import path from "node:path";
import { launchLayoutry, makeTempDir, removeDir, REPO_ROOT, scriptFileDialogs, type LaunchedLayoutry } from "./support/layoutryApp";
import { canvasImage, dataUrlOf, imageFixture, imageFixtureBytes, imageState, insertImage, inspectorPanel, uploadInput } from "../support/imageUploads";

/**
 * BC-07.2 in the real Electron window: upload through the renderer's file
 * picker (Chromium's own chooser, intercepted by Playwright — no desktop
 * IPC is involved), Save to a real .layoutry file, Save As, export, move
 * the file to another folder and reopen it there, a rejected upload that
 * leaves the saved project untouched, and BC-05's legacy-file protection.
 */

interface SavedNode {
  id: string;
  tag: string;
  src?: string;
  displayName?: string;
  children?: SavedNode[];
}

const PNG = dataUrlOf("upload-40x30.png", "image/png");
const JPEG = dataUrlOf("upload-32x24.jpg", "image/jpeg");

let layoutry: LaunchedLayoutry | undefined;
let folder: string;

test.beforeEach(async () => {
  folder = await makeTempDir("layoutry-image-upload-");
});

test.afterEach(async () => {
  await layoutry?.dispose();
  layoutry = undefined;
  await removeDir(folder);
});

const status = (page: Page) => page.locator("[data-project-status]");
const sha = async (file: string) => createHash("sha256").update(await readFile(file)).digest("hex");

function findById(root: SavedNode, id: string): SavedNode | undefined {
  if (root.id === id) return root;
  for (const child of root.children ?? []) {
    const found = findById(child, id);
    if (found) return found;
  }
  return undefined;
}

async function savedImage(file: string, id: string): Promise<{ formatVersion: number; image: SavedNode | undefined }> {
  const saved = JSON.parse(await readFile(file, "utf8")) as { formatVersion: number; document: SavedNode };
  return { formatVersion: saved.formatVersion, image: findById(saved.document, id) };
}

test("upload in the desktop app, Save, reject a bad file, Save As, export, then move the file and reopen it", async () => {
  const first = path.join(folder, "Images.layoutry");
  const copy = path.join(folder, "Images copy.layoutry");
  const exported = path.join(folder, "Images.html");
  layoutry = await launchLayoutry();
  const { app, page } = layoutry;
  await scriptFileDialogs(app, { save: [first, copy, exported] });

  const id = await insertImage(page);
  const chooser = page.waitForEvent("filechooser");
  await inspectorPanel(page).getByRole("button", { name: "Upload image…" }).click();
  await (await chooser).setFiles(imageFixture("upload-40x30.png"));
  await expect.poll(() => canvasImage(page, id).getAttribute("src")).toBe(PNG);
  expect(await imageState(page, id)).toMatchObject({ width: 40, height: 30 });
  const alt = inspectorPanel(page).getByRole("textbox", { name: "Alt text" });
  await alt.fill("Blue and orange swatch");
  await alt.press("Enter");

  await page.keyboard.press("Control+s");
  await expect(status(page)).toHaveAttribute("data-project-status", "saved");
  const saved = await savedImage(first, id);
  expect(saved.formatVersion).toBe(2);
  expect(saved.image).toMatchObject({ src: PNG, displayName: "Blue and orange swatch" });
  expect(Buffer.from(saved.image!.src!.split(",")[1], "base64").equals(imageFixtureBytes("upload-40x30.png"))).toBe(true);
  const savedText = await readFile(first, "utf8");

  // A rejected upload changes nothing: still saved, same image.
  await uploadInput(page).setInputFiles(imageFixture("svg-image.svg"));
  await expect(inspectorPanel(page).getByRole("alert")).toHaveText(/SVG images can't be uploaded/);
  await expect(status(page)).toHaveAttribute("data-project-status", "saved");
  expect(await canvasImage(page, id).getAttribute("src")).toBe(PNG);

  await page.keyboard.press("Control+Shift+s");
  await expect(page.locator("[data-project-source]")).toHaveText(/Images copy\.layoutry/);
  expect(await readFile(first, "utf8")).toBe(savedText);
  expect((await savedImage(copy, id)).image).toMatchObject({ src: PNG, displayName: "Blue and orange swatch" });

  await page.getByRole("menuitem", { name: "File" }).click();
  await page.getByRole("menuitem", { name: "Export Code…" }).click();
  const dialog = page.getByRole("dialog", { name: "Export Code" });
  await dialog.getByRole("button", { name: "Save HTML File…" }).click();
  await expect(dialog.getByTestId("export-transfer-status")).toHaveText(/Saved Images\.html/);
  expect(await readFile(exported, "utf8")).toContain(`src="${PNG}" alt="Blue and orange swatch"`);
  await page.keyboard.press("Escape");

  // Move the project to another folder (another computer, as far as the file knows) and reopen it.
  await layoutry.dispose();
  const elsewhere = path.join(folder, "moved", "deeper");
  await mkdir(elsewhere, { recursive: true });
  const moved = path.join(elsewhere, "Moved.layoutry");
  await rename(copy, moved);
  layoutry = await launchLayoutry({ extraArgs: [moved] });
  await expect(layoutry.page.locator("[data-project-source]")).toHaveText(/Moved\.layoutry/);
  await expect.poll(() => canvasImage(layoutry!.page, id).getAttribute("src")).toBe(PNG);
  expect(await imageState(layoutry.page, id)).toMatchObject({ width: 40, height: 30, alt: "Blue and orange swatch" });
});

test("a format 1 file takes an uploaded image, and BC-05's upgrade prompt still protects the original", async () => {
  const original = path.join(folder, "Legacy.layoutry");
  const upgraded = path.join(folder, "Legacy (v2).layoutry");
  await copyFile(path.join(REPO_ROOT, "test", "fixtures", "persistence", "project-1.1-every-element.layoutry"), original);
  const originalHash = await sha(original);
  layoutry = await launchLayoutry({ extraArgs: [original] });
  const { app, page } = layoutry;
  await expect(page.locator("[data-project-source]")).toHaveText(/Legacy\.layoutry/);

  const id = "img-3c639ec3";
  await canvasImage(page, id).click();
  await uploadInput(page).setInputFiles(imageFixture("upload-32x24.jpg"));
  await expect.poll(() => canvasImage(page, id).getAttribute("src")).toBe(JPEG);

  await scriptFileDialogs(app, { save: [upgraded] });
  // File > Save, not Ctrl+S: this file contains an authored open Dialog (PRJ-K1, BC-06.3).
  await page.getByRole("menuitem", { name: "File" }).click();
  await page.getByRole("menuitem", { name: "Save", exact: true }).click();
  const prompt = page.getByRole("dialog", { name: "Upgrade Project File?" });
  await expect(prompt).toBeVisible();
  await prompt.getByRole("button", { name: "Save As… (Recommended)" }).click();
  await expect(status(page)).toHaveAttribute("data-project-status", "saved");
  expect(await sha(original)).toBe(originalHash);
  const saved = await savedImage(upgraded, id);
  expect(saved.formatVersion).toBe(2);
  expect(saved.image?.src).toBe(JPEG);
});
