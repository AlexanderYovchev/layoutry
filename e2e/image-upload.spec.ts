import { expect, test, type Page } from "@playwright/test";
import { gotoApp } from "./support/gotoApp";
import {
  canvasImage,
  dataUrlOf,
  imageFixture,
  imageFixtureBytes,
  imageState,
  insertImage,
  inspectorPanel,
  largePng,
  oversizedPngLikeFile,
  uploadInput,
} from "./support/imageUploads";

/**
 * BC-07.2 — local image upload in the browser editor: the real file picker
 * (Playwright's file-chooser interception), Canvas, Preview, Export, Undo/
 * Redo, Alt text, the browser library across a reload, every rejection,
 * keyboard use, duplicates and the project-size preflight.
 */

const PNG = dataUrlOf("upload-40x30.png", "image/png");
const JPEG = dataUrlOf("upload-32x24.jpg", "image/jpeg");

const uploadButton = (page: Page) => inspectorPanel(page).getByRole("button", { name: /^(Upload|Replace) image…$/ });
const alert = (page: Page) => inspectorPanel(page).getByRole("alert");

/** Clicks Upload/Replace and answers the native picker with `files`. */
async function pickThroughChooser(page: Page, files: Parameters<import("@playwright/test").FileChooser["setFiles"]>[0], open: () => Promise<void> = () => uploadButton(page).click()) {
  const chooser = page.waitForEvent("filechooser");
  await open();
  const fileChooser = await chooser;
  expect(fileChooser.isMultiple()).toBe(false);
  await fileChooser.setFiles(files);
}

async function srcOf(page: Page, nodeId: string): Promise<string | null> {
  return canvasImage(page, nodeId).getAttribute("src");
}

async function exportedHtml(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Export Code" }).click();
  const dialog = page.getByRole("dialog", { name: "Export Code" });
  const code = dialog.getByTestId("export-code");
  await expect(code).toBeVisible();
  const text = (await code.textContent()) ?? "";
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  return text;
}

test.beforeEach(async ({ page }) => {
  // Turn on Playwright's file-chooser interception before any test acts.
  // Enabling it is asynchronous; registered only by waitForEvent right
  // before a key press, the press could win under load and the chooser
  // request was then never reported (seen once per full-suite run).
  page.on("filechooser", () => undefined);
  await gotoApp(page);
});

test("upload, Preview, Export, replace, Undo/Redo, Alt text, then save and reopen after a reload", async ({ page, browserName }) => {
  const id = await insertImage(page);
  await expect(uploadButton(page)).toHaveText("Upload image…");

  await pickThroughChooser(page, imageFixture("upload-40x30.png"));
  await expect.poll(() => srcOf(page, id)).toBe(PNG);
  expect(await imageState(page, id)).toMatchObject({ width: 40, height: 30, alt: "" });
  await expect(inspectorPanel(page).getByText("upload-40x30.png")).toBeVisible();
  await expect(inspectorPanel(page).getByText("PNG · 40 × 30 · 117 B")).toBeVisible();
  await expect(uploadButton(page)).toHaveText("Replace image…");

  // Preview shows the very same embedded image.
  await page.getByRole("button", { name: "Enter Preview" }).click();
  await expect(page.getByRole("button", { name: "Exit Preview" })).toBeVisible();
  expect(await srcOf(page, id)).toBe(PNG);
  expect(await imageState(page, id)).toMatchObject({ width: 40, height: 30 });
  await page.getByRole("button", { name: "Exit Preview" }).click();

  // Export keeps it embedded, and the exported page shows it with no access to the original file.
  const html = await exportedHtml(page);
  expect(html).toContain(`src="${PNG}"`);
  const exported = await page.context().newPage();
  await exported.route("**/*", (route) => route.abort());
  await exported.setContent(html);
  expect(await exported.locator("img").first().evaluate((image: HTMLImageElement) => image.decode().then(() => [image.naturalWidth, image.naturalHeight]))).toEqual([40, 30]);
  await exported.close();

  // Replace (no Remove first), Undo, Redo.
  await canvasImage(page, id).click();
  await pickThroughChooser(page, { name: "card.jpg", mimeType: "image/jpeg", buffer: imageFixtureBytes("upload-32x24.jpg") });
  await expect.poll(() => srcOf(page, id)).toBe(JPEG);
  expect(await imageState(page, id)).toMatchObject({ width: 32, height: 24 });
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(() => srcOf(page, id)).toBe(PNG);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect.poll(() => srcOf(page, id)).toBe(JPEG);

  // Alt text: one commit, rendered on the Canvas and in Export.
  await canvasImage(page, id).click();
  const altField = inspectorPanel(page).getByRole("textbox", { name: "Alt text" });
  await expect(altField).toHaveAccessibleDescription("Describe the image for people using screen readers. Leave empty for decorative images.");
  await altField.fill(`Purple & yellow "card"`);
  await altField.press("Enter");
  await expect(canvasImage(page, id)).toHaveAttribute("alt", `Purple & yellow "card"`);
  expect(await exportedHtml(page)).toContain(`src="${JPEG}" alt="Purple &amp; yellow &quot;card&quot;"`);

  // Save to the browser library, reload, reopen.
  await page.keyboard.press("Control+s");
  const saveDialog = page.getByRole("dialog", { name: "Save Project" });
  await saveDialog.getByRole("textbox", { name: "Project name" }).fill(`Upload ${browserName}`);
  await saveDialog.getByRole("button", { name: "Save" }).click();
  await expect(page.locator("[data-project-status]")).toHaveAttribute("data-project-status", "saved");
  await page.reload();
  await gotoApp(page);
  await page.keyboard.press("Control+o");
  const library = page.getByRole("dialog", { name: "Open Project" });
  await library.getByRole("button", { name: `Open Upload ${browserName}` }).click();
  await expect(library).toBeHidden();
  await expect.poll(() => srcOf(page, id)).toBe(JPEG);
  expect(await imageState(page, id)).toMatchObject({ width: 32, height: 24, alt: `Purple & yellow "card"` });
  await canvasImage(page, id).click();
  // The file name was session-only; the data URL still says what it is.
  await expect(inspectorPanel(page).getByText("Uploaded JPEG image")).toBeVisible();
});

test("GIF and WebP upload too, keeping their exact bytes", async ({ page }) => {
  const id = await insertImage(page);
  await uploadInput(page).setInputFiles(imageFixture("upload-20x10-animated.gif"));
  await expect.poll(() => srcOf(page, id)).toBe(dataUrlOf("upload-20x10-animated.gif", "image/gif"));
  expect(await imageState(page, id)).toMatchObject({ width: 20, height: 10 });
  await uploadInput(page).setInputFiles(imageFixture("upload-24x16.webp"));
  await expect.poll(() => srcOf(page, id)).toBe(dataUrlOf("upload-24x16.webp", "image/webp"));
  expect(await imageState(page, id)).toMatchObject({ width: 24, height: 16 });
});

test("every rejection explains itself and leaves the previous image and history untouched", async ({ page }) => {
  const id = await insertImage(page);
  await uploadInput(page).setInputFiles(imageFixture("upload-40x30.png"));
  await expect.poll(() => srcOf(page, id)).toBe(PNG);

  const rejections: [Parameters<Page["setInputFiles"]>[1], RegExp][] = [
    [imageFixture("text-renamed.jpg"), /isn't a supported image/],
    [{ name: "big.png", mimeType: "image/png", buffer: oversizedPngLikeFile() }, /^Image is too large\. Maximum file size is 5 MB\.$/],
    [imageFixture("upload-8193x1.png"), /^This image is 8193 × 1 pixels\. The maximum is 8192 pixels on each side\.$/],
    [imageFixture("svg-image.svg"), /SVG images can't be uploaded/],
    [imageFixture("svg-renamed.png"), /SVG images can't be uploaded/],
    [imageFixture("html-renamed.png"), /SVG images can't be uploaded/],
    [imageFixture("upload-truncated.png"), /couldn't be opened\. The file may be damaged/],
    // Cut-off JPEG and GIF: Firefox and WebKit decode these partly blank, so structure decides.
    [{ name: "cut.jpg", mimeType: "image/jpeg", buffer: imageFixtureBytes("upload-32x24.jpg").subarray(0, 400) }, /couldn't be opened\. The file may be damaged/],
    [{ name: "cut.gif", mimeType: "image/gif", buffer: imageFixtureBytes("upload-20x10-animated.gif").subarray(0, 120) }, /couldn't be opened\. The file may be damaged/],
  ];
  for (const [file, message] of rejections) {
    await uploadInput(page).setInputFiles(file);
    await expect(alert(page)).toHaveText(message);
    expect(await srcOf(page, id)).toBe(PNG);
    expect(await imageState(page, id)).toMatchObject({ width: 40, height: 30 });
  }

  // None of them added history: one Undo goes straight back to the placeholder.
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await srcOf(page, id))?.startsWith("data:image/svg+xml")).toBe(true);

  // The boundary itself is accepted.
  await canvasImage(page, id).click();
  await uploadInput(page).setInputFiles(imageFixture("upload-8192x1.png"));
  await expect.poll(() => srcOf(page, id)).toBe(dataUrlOf("upload-8192x1.png", "image/png"));
  await expect(alert(page)).toHaveCount(0);
});

test("keyboard only: reach Upload, open the picker with Enter and Space, remove, and keep focus predictable", async ({ page }) => {
  const id = await insertImage(page);
  const sourceUrl = inspectorPanel(page).getByRole("textbox", { name: "Source URL" });
  await sourceUrl.focus();
  // Reading order: Upload, then the Source URL row's Reset (in its label row), then the field.
  await page.keyboard.press("Shift+Tab");
  await expect(inspectorPanel(page).getByRole("button", { name: "Reset source url" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(uploadButton(page)).toBeFocused();

  await pickThroughChooser(page, imageFixture("upload-40x30.png"), () => page.keyboard.press("Enter"));
  await expect.poll(() => srcOf(page, id)).toBe(PNG);
  await expect(uploadButton(page)).toHaveText("Replace image…");
  await expect(uploadButton(page)).toBeFocused();

  await pickThroughChooser(page, imageFixture("upload-32x24.jpg"), () => page.keyboard.press("Space"));
  await expect.poll(() => srcOf(page, id)).toBe(JPEG);

  await page.keyboard.press("Tab");
  const remove = inspectorPanel(page).getByRole("button", { name: "Remove uploaded image" });
  await expect(remove).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(canvasImage(page, id)).toHaveCount(0);
  await expect(uploadButton(page)).toHaveText("Upload image…");
  await expect(uploadButton(page)).toBeFocused();

  // An error is announced and focus stays on the button.
  await pickThroughChooser(page, imageFixture("svg-image.svg"), () => page.keyboard.press("Enter"));
  await expect(alert(page)).toHaveText(/SVG images can't be uploaded/);
  await expect(uploadButton(page)).toBeFocused();
});

test("duplicating an uploaded image gives an independent copy with its own id; Undo removes it", async ({ page }) => {
  const id = await insertImage(page);
  await uploadInput(page).setInputFiles(imageFixture("upload-40x30.png"));
  await expect.poll(() => srcOf(page, id)).toBe(PNG);
  await canvasImage(page, id).click();
  const images = page.locator('[data-document-surface] [data-node-type="img"]');
  const before = await images.count();
  await page.keyboard.press("Control+d");
  await expect(images).toHaveCount(before + 1);
  const ids = await images.evaluateAll((nodes) => nodes.map((node) => [node.getAttribute("data-node-id"), node.querySelector("img")?.getAttribute("src")?.slice(0, 40)]));
  const uploaded = ids.filter(([, head]) => head === PNG.slice(0, 40));
  expect(uploaded).toHaveLength(2);
  expect(new Set(uploaded.map(([nodeId]) => nodeId)).size).toBe(2);
  const copyId = uploaded.find(([nodeId]) => nodeId !== id)![0]!;

  // The copy is independent: replacing it leaves the original alone.
  await uploadInput(page).setInputFiles(imageFixture("upload-32x24.jpg"));
  await expect.poll(() => srcOf(page, copyId)).toBe(JPEG);
  expect(await srcOf(page, id)).toBe(PNG);

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(`[data-document-surface] [data-node-id="${copyId}"]`)).toHaveCount(0);
});

test("the project-size preflight refuses an image that would make the project unsaveable", async ({ page }) => {
  test.slow();
  const ids = [await insertImage(page), await insertImage(page), await insertImage(page)];
  // ~4.8 MB each: two embed (~13 Mi characters), a third would pass 16 Mi.
  for (const [index, id] of ids.entries()) {
    await canvasImage(page, id).click();
    await uploadInput(page).setInputFiles({ name: `big-${index}.png`, mimeType: "image/png", buffer: largePng(1100, 1100, index) });
    if (index < 2) {
      await expect.poll(async () => (await imageState(page, id)).width, { timeout: 30_000 }).toBe(1100);
    } else {
      await expect(alert(page)).toHaveText("This image would make the project too large to save. Choose a smaller image or remove unused content.", { timeout: 30_000 });
      expect(await srcOf(page, id)).toMatch(/^data:image\/svg\+xml/);
    }
  }

  // Duplicating one of the large images is refused the same way, with a notice.
  await canvasImage(page, ids[0]).click();
  const imageCount = await page.locator('[data-document-surface] [data-node-type="img"]').count();
  await page.keyboard.press("Control+d");
  await expect(page.getByText("This copy would make the project too large to save.", { exact: false })).toBeVisible();
  await expect(page.locator('[data-document-surface] [data-node-type="img"]')).toHaveCount(imageCount);

  // And the project still saves.
  await page.keyboard.press("Control+s");
  const saveDialog = page.getByRole("dialog", { name: "Save Project" });
  await saveDialog.getByRole("textbox", { name: "Project name" }).fill("Big images");
  await saveDialog.getByRole("button", { name: "Save" }).click();
  await expect(page.locator("[data-project-status]")).toHaveAttribute("data-project-status", "saved", { timeout: 30_000 });
});
