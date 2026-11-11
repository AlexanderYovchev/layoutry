import { expect, test, type Download, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { EditorElementNode } from "../src/features/editor/types/document";
import { gotoApp } from "./support/gotoApp";
import { canvasImage, dataUrlOf, imageFixture, imageFixtureBytes, imageState, insertImage, uploadInput } from "./support/imageUploads";
import { importDocument } from "./support/parityFixtures";

/**
 * BC-07.3 — the portable website package in a real browser: upload, export
 * as Separate files, download the ZIP, extract it with the operating
 * system's own unzip (an independent implementation), open the extracted
 * site from disk with the network blocked, and check images, alt text,
 * styles, interactions, mixed sources, deduplication, repeat exports and
 * that the project itself never changes.
 */

const PNG = dataUrlOf("upload-40x30.png", "image/png");
const JPEG = dataUrlOf("upload-32x24.jpg", "image/jpeg");
const GIF = dataUrlOf("upload-20x10-animated.gif", "image/gif");
const WEBP = dataUrlOf("upload-24x16.webp", "image/webp");

const exportDialog = (page: Page) => page.getByRole("dialog", { name: "Export Code" });
const status = (page: Page) => page.locator("[data-project-status]");

let workDir: string;
test.beforeEach(async ({ page }) => {
  workDir = mkdtempSync(path.join(os.tmpdir(), "layoutry-bc073-"));
  await gotoApp(page);
});
test.afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

/** Extracts with the OS tool: Windows' bsdtar (libarchive), or unzip elsewhere. */
function extract(zipPath: string, into: string): void {
  const windowsTar = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe");
  if (process.platform === "win32" && existsSync(windowsTar)) execFileSync(windowsTar, ["-xf", zipPath, "-C", into]);
  else execFileSync("unzip", ["-q", zipPath, "-d", into]);
}

function listTree(folder: string, prefix = ""): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? listTree(path.join(folder, entry.name), `${prefix}${entry.name}/`) : [`${prefix}${entry.name}`],
  );
}

/** Opens Export, chooses Separate files and downloads the website ZIP; returns the extracted folder and the ZIP bytes. */
async function downloadWebsite(page: Page, name: string): Promise<{ folder: string; zip: Buffer }> {
  await page.getByRole("button", { name: "Export Code" }).click();
  const dialog = exportDialog(page);
  await expect(dialog.getByTestId("export-code")).toBeVisible();
  await dialog.getByLabel("Separate files").check();
  const button = dialog.getByRole("button", { name: "Download website (.zip)" });
  await expect(button).toBeEnabled();
  const downloaded: Promise<Download> = page.waitForEvent("download");
  await button.click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toMatch(/\.zip$/);
  const zipPath = path.join(workDir, `${name}.zip`);
  await download.saveAs(zipPath);
  await expect(dialog.getByTestId("export-transfer-status")).toContainText("Unzip it and open index.html");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  const folder = path.join(workDir, name);
  execFileSync(process.platform === "win32" ? "cmd" : "mkdir", process.platform === "win32" ? ["/c", "mkdir", folder] : ["-p", folder]);
  extract(zipPath, folder);
  return { folder, zip: readFileSync(zipPath) };
}

/** Opens the extracted index.html from disk; every http(s) request is blocked (offline). */
async function openExported(page: Page, folder: string): Promise<Page> {
  const site = await page.context().newPage();
  await site.route(/^https?:/, (route) => route.abort());
  await site.goto(pathToFileURL(path.join(folder, "index.html")).href);
  return site;
}

function exportedImage(site: Page, alt: string) {
  return site.locator(`img[alt="${alt}"]`).evaluate(async (image: HTMLImageElement) => {
    if (!image.complete) await image.decode().catch(() => undefined);
    const style = getComputedStyle(image);
    return { src: image.getAttribute("src"), width: image.naturalWidth, height: image.naturalHeight, objectFit: style.objectFit, opacity: getComputedStyle(image.parentElement!).opacity };
  });
}

test("an uploaded image becomes assets/image-001.png in a ZIP that works offline from disk; the project is untouched", async ({ page }) => {
  const id = await insertImage(page);
  await uploadInput(page).setInputFiles(imageFixture("upload-40x30.png"));
  await expect.poll(() => canvasImage(page, id).getAttribute("src")).toBe(PNG);
  const alt = page.getByRole("complementary", { name: "Inspector panel" }).getByRole("textbox", { name: "Alt text" });
  await alt.fill("Blue & orange swatch");
  await alt.press("Enter");
  const statusBefore = await status(page).getAttribute("data-project-status");
  const undoBefore = await page.getByRole("button", { name: "Undo", exact: true }).isEnabled();
  const canvas = await imageState(page, id);

  const { folder } = await downloadWebsite(page, "single");
  expect(listTree(folder).sort()).toEqual(["assets/image-001.png", "index.html", "styles.css"]);
  expect(readFileSync(path.join(folder, "assets", "image-001.png")).equals(imageFixtureBytes("upload-40x30.png"))).toBe(true);
  const html = readFileSync(path.join(folder, "index.html"), "utf8");
  expect(html).toContain(`src="assets/image-001.png" alt="Blue &amp; orange swatch"`);
  expect(html).not.toContain("data:image/png");

  const site = await openExported(page, folder);
  const exported = await exportedImage(site, "Blue & orange swatch");
  expect(exported).toMatchObject({ src: "assets/image-001.png", width: canvas.width, height: canvas.height });
  await site.close();

  // Exporting changed nothing: same source, same unsaved state, same history.
  expect(await canvasImage(page, id).getAttribute("src")).toBe(PNG);
  await expect(status(page)).toHaveAttribute("data-project-status", statusBefore ?? "");
  expect(await page.getByRole("button", { name: "Undo", exact: true }).isEnabled()).toBe(undoBefore);
});

test("mixed sources, duplicates, styles and an interaction: one file per distinct image, everything else as authored", async ({ page }) => {
  const document: EditorElementNode = {
    id: "page-root",
    tag: "page",
    children: [
      { id: "img-png", tag: "img", src: PNG, displayName: "Swatch", mediaFit: { objectFit: "contain" }, filters: { opacity: 60 } },
      { id: "img-png-copy", tag: "img", src: PNG, displayName: "Swatch copy", mediaFit: { objectFit: "cover" } },
      { id: "img-jpeg", tag: "img", src: JPEG, displayName: "Card" },
      { id: "img-gif", tag: "img", src: GIF, displayName: "Animation" },
      { id: "img-webp", tag: "img", src: WEBP, displayName: "Lossy" },
      { id: "img-remote", tag: "img", src: "https://example.com/remote.png", displayName: "Remote" },
      { id: "img-relative", tag: "img", src: "images/local.png", displayName: "Relative" },
      { id: "banner", tag: "div", background: { image: JPEG }, children: [{ id: "banner-text", tag: "p", text: "Banner" }] },
      { id: "toggle", tag: "button", text: "Toggle card", interactions: [{ id: "i-1", trigger: "click", action: "toggle", targetId: "img-jpeg" }] },
    ],
  };
  await importDocument(page, document, "img-png");

  const first = await downloadWebsite(page, "mixed");
  expect(listTree(first.folder).sort()).toEqual(["assets/image-001.png", "assets/image-002.jpg", "assets/image-003.gif", "assets/image-004.webp", "index.html", "script.js", "styles.css"]);
  for (const [file, fixture] of [["image-001.png", "upload-40x30.png"], ["image-002.jpg", "upload-32x24.jpg"], ["image-003.gif", "upload-20x10-animated.gif"], ["image-004.webp", "upload-24x16.webp"]])
    expect(readFileSync(path.join(first.folder, "assets", file)).equals(imageFixtureBytes(fixture)), file).toBe(true);
  const html = readFileSync(path.join(first.folder, "index.html"), "utf8");
  expect(html.match(/src="assets\/image-001\.png"/g)).toHaveLength(2);
  expect(html).toContain(`src="https://example.com/remote.png" alt="Remote"`);
  expect(html).toContain(`src="images/local.png" alt="Relative"`);
  expect(readFileSync(path.join(first.folder, "styles.css"), "utf8")).toContain(`url("assets/image-002.jpg")`);

  const site = await openExported(page, first.folder);
  expect(await exportedImage(site, "Swatch")).toMatchObject({ width: 40, height: 30, objectFit: "contain", opacity: "0.6" });
  expect(await exportedImage(site, "Swatch copy")).toMatchObject({ width: 40, height: 30, objectFit: "cover" });
  expect(await exportedImage(site, "Card")).toMatchObject({ width: 32, height: 24 });
  expect(await exportedImage(site, "Animation")).toMatchObject({ width: 20, height: 10 });
  expect(await exportedImage(site, "Lossy")).toMatchObject({ width: 24, height: 16 });
  // The background image loads from the package too.
  const background = await site.locator("p", { hasText: "Banner" }).evaluate(async (paragraph) => {
    const url = /url\("?(.*?)"?\)/.exec(getComputedStyle(paragraph.parentElement!).backgroundImage)?.[1] ?? "";
    const probe = new Image();
    probe.src = url;
    await probe.decode();
    return { url: url.slice(url.lastIndexOf("/") - 6), width: probe.naturalWidth };
  });
  expect(background).toEqual({ url: "assets/image-002.jpg", width: 32 });
  // The interaction still works on the exported page.
  await expect(site.locator('img[alt="Card"]')).toBeVisible();
  await site.getByRole("button", { name: "Toggle card" }).click();
  await expect(site.locator('img[alt="Card"]')).toBeHidden();
  await site.close();

  // Canvas parity for the same image: natural size and fit.
  expect(await imageState(page, "img-png")).toMatchObject({ width: 40, height: 30, alt: "Swatch" });

  // A repeated export is byte-identical.
  const second = await downloadWebsite(page, "mixed-again");
  expect(second.zip.equals(first.zip)).toBe(true);
});

test("Single HTML file still embeds uploaded images and stays one complete file", async ({ page }) => {
  await importDocument(page, { id: "page-root", tag: "page", children: [{ id: "img-png", tag: "img", src: PNG, displayName: "Swatch" }] }, "img-png");
  await page.getByRole("button", { name: "Export Code" }).click();
  const dialog = exportDialog(page);
  await expect(dialog.getByTestId("export-code")).toBeVisible();
  await expect(dialog.getByTestId("export-embedded-images")).toContainText("embedded inside index.html");
  const downloaded = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Download index.html" }).click();
  const filePath = path.join(workDir, "index.html");
  await (await downloaded).saveAs(filePath);
  expect(readFileSync(filePath, "utf8")).toContain(`src="${PNG}" alt="Swatch"`);
  const site = await openExported(page, workDir);
  expect(await exportedImage(site, "Swatch")).toMatchObject({ width: 40, height: 30 });
  await site.close();
});

test("an embedded image that isn't valid stays embedded with a warning, and the dialog is keyboard-operable", async ({ page }) => {
  const fake = `data:image/png;base64,${Buffer.from("<script>alert(1)</script>").toString("base64")}`;
  await importDocument(page, { id: "page-root", tag: "page", children: [{ id: "img-png", tag: "img", src: PNG, displayName: "Real" }, { id: "img-fake", tag: "img", src: fake, displayName: "Fake" }] }, "img-png");
  await page.getByRole("button", { name: "Export Code" }).click();
  const dialog = exportDialog(page);
  await expect(dialog.getByTestId("export-code")).toBeVisible();
  // Keyboard: arrow to Separate files, then reach the ZIP button with Tab.
  await dialog.getByLabel("Single HTML file").focus();
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByLabel("Separate files")).toBeChecked();
  await expect(dialog.getByRole("list", { name: /exported as 1 image file/ })).toContainText("assets/image-001.png");
  await expect(dialog.getByRole("list", { name: "Export diagnostics" })).toContainText("left embedded in the page");
  const zipButton = dialog.getByRole("button", { name: "Download website (.zip)" });
  for (let step = 0; step < 30 && !(await zipButton.evaluate((element) => element === document.activeElement)); step += 1) await page.keyboard.press("Tab");
  await expect(zipButton).toBeFocused();
  const downloaded = page.waitForEvent("download");
  await page.keyboard.press("Enter");
  const zipPath = path.join(workDir, "fake.zip");
  await (await downloaded).saveAs(zipPath);
  const folder = path.join(workDir, "fake");
  execFileSync(process.platform === "win32" ? "cmd" : "mkdir", process.platform === "win32" ? ["/c", "mkdir", folder] : ["-p", folder]);
  extract(zipPath, folder);
  expect(listTree(folder).sort()).toEqual(["assets/image-001.png", "index.html", "styles.css"]);
  const html = readFileSync(path.join(folder, "index.html"), "utf8");
  expect(html).toContain(`src="${fake}" alt="Fake"`);
  expect(html).toContain(`src="assets/image-001.png" alt="Real"`);
});
