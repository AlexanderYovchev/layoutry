import { expect, test, type Page } from "@playwright/test";
import { gotoApp } from "./support/gotoApp";
import {
  canvasImage,
  dataUrlOf,
  garbageBodyGif,
  garbageBodyPng,
  imageFixture,
  imageFixtureBytes,
  imageState,
  insertImage,
  inspectorPanel,
  largePng,
  uploadInput,
} from "./support/imageUploads";

/**
 * BC-07.4 — the upload security matrix in every engine. Each refused file
 * must leave the previous image, the history and the project's saved state
 * exactly as they were, show a clear alert, and run nothing. Accepted
 * files are judged by their bytes, whatever they are called.
 */

const PNG = dataUrlOf("upload-40x30.png", "image/png");
const alert = (page: Page) => inspectorPanel(page).getByRole("alert");
const status = (page: Page) => page.locator("[data-project-status]");

const DAMAGED = /couldn't be opened\. The file may be damaged/;
const UNSUPPORTED = /isn't a supported image/;
const SVG = /SVG images can't be uploaded/;

const refused: [string, Parameters<Page["setInputFiles"]>[1], RegExp][] = [
  ["SVG", imageFixture("svg-image.svg"), SVG],
  ["HTML renamed to PNG", imageFixture("html-renamed.png"), SVG],
  ["JavaScript renamed to JPEG", { name: "photo.jpg", mimeType: "image/jpeg", buffer: Buffer.from("window.top.__bc074js = 1; alert(1);\n") }, UNSUPPORTED],
  ["text renamed to WebP", { name: "photo.webp", mimeType: "image/webp", buffer: Buffer.from("just text, not an image") }, UNSUPPORTED],
  ["a PNG reported as text/html", { name: "photo.png", mimeType: "text/html", buffer: imageFixtureBytes("upload-40x30.png") }, UNSUPPORTED],
  ["a PNG named .bmp", { name: "photo.bmp", mimeType: "", buffer: imageFixtureBytes("upload-40x30.png") }, UNSUPPORTED],
  ["an unsupported format (BMP bytes)", { name: "photo.png", mimeType: "image/png", buffer: Buffer.concat([Buffer.from("BM"), Buffer.alloc(60)]) }, UNSUPPORTED],
  ["a valid PNG header with a garbage body", { name: "photo.png", mimeType: "image/png", buffer: garbageBodyPng() }, DAMAGED],
  ["a GIF with garbage image data", { name: "photo.gif", mimeType: "image/gif", buffer: garbageBodyGif() }, DAMAGED],
  ["a truncated PNG", imageFixture("upload-truncated.png"), DAMAGED],
  ["a truncated JPEG", { name: "photo.jpg", mimeType: "image/jpeg", buffer: imageFixtureBytes("upload-32x24.jpg").subarray(0, 400) }, DAMAGED],
  ["a truncated GIF", { name: "photo.gif", mimeType: "image/gif", buffer: imageFixtureBytes("upload-20x10-animated.gif").subarray(0, 120) }, DAMAGED],
  ["a truncated WebP", { name: "photo.webp", mimeType: "image/webp", buffer: imageFixtureBytes("upload-24x16.webp").subarray(0, 200) }, DAMAGED],
  ["an empty file", { name: "photo.png", mimeType: "image/png", buffer: Buffer.alloc(0) }, /This file is empty/],
  ["an image wider than 8192 px", imageFixture("upload-8193x1.png"), /8193 × 1 pixels\. The maximum is 8192/],
];

test.beforeEach(async ({ page }) => {
  await gotoApp(page);
});

test("every unsafe, damaged or unsupported file is refused and changes nothing", async ({ page }) => {
  test.slow();
  const id = await insertImage(page);
  await uploadInput(page).setInputFiles(imageFixture("upload-40x30.png"));
  await expect.poll(() => canvasImage(page, id).getAttribute("src")).toBe(PNG);
  const savedState = await status(page).getAttribute("data-project-status");

  for (const [name, file, message] of refused) {
    await uploadInput(page).setInputFiles(file);
    await expect(alert(page), name).toHaveText(message);
    expect(await canvasImage(page, id).getAttribute("src"), name).toBe(PNG);
    await expect(status(page), name).toHaveAttribute("data-project-status", savedState ?? "");
  }
  expect(await imageState(page, id)).toMatchObject({ width: 40, height: 30 });
  expect(await page.evaluate(() => Reflect.get(window, "__bc074js"))).toBeUndefined();

  // Not one of them added history: a single Undo returns to the placeholder, a second to before the insert.
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await canvasImage(page, id).getAttribute("src"))?.startsWith("data:image/svg+xml")).toBe(true);
});

test("the bytes decide: a JPEG named .gif and reported as WebP is stored as image/jpeg; a PNG+HTML polyglot is just a PNG", async ({ page }) => {
  const id = await insertImage(page);
  await uploadInput(page).setInputFiles({ name: "photo.gif", mimeType: "image/webp", buffer: imageFixtureBytes("upload-32x24.jpg") });
  await expect.poll(() => canvasImage(page, id).getAttribute("src")).toBe(dataUrlOf("upload-32x24.jpg", "image/jpeg"));

  // A complete PNG with HTML appended after IEND: accepted as the PNG it is, shown as an image, never run.
  const polyglot = Buffer.concat([imageFixtureBytes("upload-40x30.png"), Buffer.from("<script>window.top.__bc074poly = 1</script>")]);
  await uploadInput(page).setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: polyglot });
  await expect.poll(async () => (await canvasImage(page, id).getAttribute("src"))?.startsWith("data:image/png;base64,")).toBe(true);
  expect(await imageState(page, id)).toMatchObject({ width: 40, height: 30 });
  await page.getByRole("button", { name: "Enter Preview" }).click();
  await expect(page.getByRole("button", { name: "Exit Preview" })).toBeVisible();
  expect(await page.evaluate(() => Reflect.get(window, "__bc074poly"))).toBeUndefined();
});

test("near-limit sizes: a ~5.0 MB PNG and an 8192 × 1 PNG upload; several shapes keep their aspect ratios", async ({ page }) => {
  test.slow();
  const id = await insertImage(page);
  // 1140 × 1140 RGBA, stored uncompressed: 5,199,xxx bytes, just under 5 × 1024 × 1024.
  const nearLimit = largePng(1140, 1140, 7);
  expect(nearLimit.length).toBeGreaterThan(5_150_000);
  expect(nearLimit.length).toBeLessThanOrEqual(5 * 1024 * 1024);
  await uploadInput(page).setInputFiles({ name: "big.png", mimeType: "image/png", buffer: nearLimit });
  await expect.poll(async () => (await imageState(page, id)).width, { timeout: 30_000 }).toBe(1140);
  expect(await imageState(page, id)).toMatchObject({ width: 1140, height: 1140 });

  for (const [file, width, height] of [["upload-8192x1.png", 8192, 1], ["upload-20x10-animated.gif", 20, 10], ["upload-24x16.webp", 24, 16], ["upload-32x24.jpg", 32, 24]] as const) {
    await uploadInput(page).setInputFiles(imageFixture(file));
    await expect.poll(async () => (await imageState(page, id)).width, { timeout: 15_000 }).toBe(width);
    expect(await imageState(page, id)).toMatchObject({ width, height });
  }
});
