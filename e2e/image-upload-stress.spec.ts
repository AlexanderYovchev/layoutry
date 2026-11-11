import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { gotoApp } from "./support/gotoApp";
import { canvasImage, dataUrlOf, imageFixture, inspectorPanel, insertImage, uploadInput } from "./support/imageUploads";

/**
 * BC-07.4 — stress and resource lifecycle (Chromium: heap figures need the
 * DevTools protocol). Counts every object URL the page creates and
 * revokes, and every window listener added and removed, across:
 * 30 upload → replace → remove cycles, 20 Preview round trips and
 * 10 website ZIP exports (each byte-identical). Heap is measured after a
 * forced garbage collection. Figures are printed; the assertions are on
 * leaks (URLs, listeners) and output consistency, not on machine speed.
 */

test.skip(({ browserName }) => browserName !== "chromium", "heap figures and forced GC need Chromium's DevTools protocol");

const PNG = dataUrlOf("upload-40x30.png", "image/png");
const JPEG = dataUrlOf("upload-32x24.jpg", "image/jpeg");

async function counters(page: Page) {
  return page.evaluate(() => ({ ...(Reflect.get(window, "__bc074") as Record<string, number>) }));
}

async function heapMb(page: Page): Promise<number> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("HeapProfiler.collectGarbage");
  const { usedSize } = (await cdp.send("Runtime.getHeapUsage")) as { usedSize: number };
  await cdp.detach();
  return usedSize / (1024 * 1024);
}

test("upload/replace/remove, Preview and ZIP cycles leak no object URLs or listeners and give identical output", async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(() => {
    const counts = { created: 0, revoked: 0, listenersAdded: 0, listenersRemoved: 0 };
    Reflect.set(window, "__bc074", counts);
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (object: Blob | MediaSource) => {
      counts.created += 1;
      return create(object);
    };
    URL.revokeObjectURL = (url: string) => {
      counts.revoked += 1;
      revoke(url);
    };
    const add = window.addEventListener.bind(window);
    const remove = window.removeEventListener.bind(window);
    window.addEventListener = ((...args: Parameters<typeof add>) => {
      counts.listenersAdded += 1;
      add(...args);
    }) as typeof window.addEventListener;
    window.removeEventListener = ((...args: Parameters<typeof remove>) => {
      counts.listenersRemoved += 1;
      remove(...args);
    }) as typeof window.removeEventListener;
  });
  await gotoApp(page);
  const id = await insertImage(page);
  const heapStart = await heapMb(page);
  const start = await counters(page);
  const remove = inspectorPanel(page).getByRole("button", { name: "Remove uploaded image" });

  const uploadStarted = Date.now();
  for (let cycle = 0; cycle < 30; cycle += 1) {
    await uploadInput(page).setInputFiles(imageFixture("upload-40x30.png"));
    await expect.poll(() => canvasImage(page, id).getAttribute("src")).toBe(PNG);
    await uploadInput(page).setInputFiles(imageFixture("upload-32x24.jpg"));
    await expect.poll(() => canvasImage(page, id).getAttribute("src")).toBe(JPEG);
    await remove.click();
    await expect(canvasImage(page, id)).toHaveCount(0);
  }
  const uploadMs = Date.now() - uploadStarted;
  const afterUploads = await counters(page);
  // Each upload decodes through one object URL (the <img> check), always revoked.
  expect(afterUploads.created - start.created).toBe(60);
  expect(afterUploads.revoked - start.revoked).toBe(60);
  const heapAfterUploads = await heapMb(page);

  await uploadInput(page).setInputFiles(imageFixture("upload-40x30.png"));
  await expect.poll(() => canvasImage(page, id).getAttribute("src")).toBe(PNG);
  const listenersBeforePreview = await counters(page);
  const previewStarted = Date.now();
  for (let cycle = 0; cycle < 20; cycle += 1) {
    await page.getByRole("button", { name: "Enter Preview" }).click();
    await expect(page.getByRole("button", { name: "Exit Preview" })).toBeVisible();
    expect(await canvasImage(page, id).getAttribute("src")).toBe(PNG);
    await page.getByRole("button", { name: "Exit Preview" }).click();
    await expect(page.getByRole("button", { name: "Enter Preview" })).toBeVisible();
  }
  const previewMs = Date.now() - previewStarted;
  const afterPreview = await counters(page);
  const netListeners = (afterPreview.listenersAdded - afterPreview.listenersRemoved) - (listenersBeforePreview.listenersAdded - listenersBeforePreview.listenersRemoved);
  expect(Math.abs(netListeners), "window listeners added and not removed across 20 Preview round trips").toBeLessThanOrEqual(2);

  await page.getByRole("button", { name: "Export Code" }).click();
  const dialog = page.getByRole("dialog", { name: "Export Code" });
  await expect(dialog.getByTestId("export-code")).toBeVisible();
  await dialog.getByLabel("Separate files").check();
  const zips: Buffer[] = [];
  const zipStarted = Date.now();
  for (let cycle = 0; cycle < 10; cycle += 1) {
    const downloaded = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "Download website (.zip)" }).click();
    zips.push(readFileSync((await (await downloaded).path())!));
  }
  const zipMs = Date.now() - zipStarted;
  expect(new Set(zips.map((zip) => zip.toString("base64"))).size).toBe(1);
  // Download URLs are revoked 10 s after each click.
  await page.waitForTimeout(10_500);
  const end = await counters(page);
  expect(end.created - end.revoked).toBe(start.created - start.revoked);
  const heapEnd = await heapMb(page);

  process.stdout.write(
    `\n[BC-07.4 stress] 30 upload/replace/remove cycles (90 operations) ${uploadMs} ms; 20 Preview round trips ${previewMs} ms; ` +
      `10 ZIP exports ${zipMs} ms (all ${zips[0].length} bytes, identical); object URLs created ${end.created - start.created}, revoked ${end.revoked - start.revoked}; ` +
      `net window listeners over Preview ${netListeners}; heap ${heapStart.toFixed(1)} → ${heapAfterUploads.toFixed(1)} (after uploads) → ${heapEnd.toFixed(1)} MB (after GC)\n`,
  );
});
