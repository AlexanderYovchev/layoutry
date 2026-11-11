import { readFileSync } from "node:fs";
import path from "node:path";
import { crc32, deflateSync } from "node:zlib";
import { expect, type Page } from "@playwright/test";

/** BC-07.2 upload fixtures (test/fixtures/images) and helpers shared by the browser and desktop specs. */
export const IMAGE_FIXTURES = path.join(process.cwd(), "test", "fixtures", "images");
export const imageFixture = (name: string) => path.join(IMAGE_FIXTURES, name);
export const imageFixtureBytes = (name: string) => readFileSync(imageFixture(name));
export const dataUrlOf = (name: string, mediaType: string) => `data:${mediaType};base64,${imageFixtureBytes(name).toString("base64")}`;

const u32 = (value: number) => {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0);
  return buffer;
};
function pngChunk(type: string, data: Buffer): Buffer {
  const name = Buffer.from(type, "ascii");
  return Buffer.concat([u32(data.length), name, data, u32(crc32(Buffer.concat([name, data])))]);
}

/**
 * A valid, deterministic, uncompressed (deflate level 0) RGBA PNG of
 * roughly width × height × 4 bytes: big real images for the project-size
 * preflight, without committing megabytes of fixtures.
 */
export function largePng(width: number, height: number, seed: number): Buffer {
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const offset = y * (width * 4 + 1);
    for (let x = 0; x < width * 4; x += 1) rows[offset + 1 + x] = (x * 7 + y * 13 + seed * 31) & 0xff;
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(rows, { level: 0 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/** A file one byte over the 5 MB limit that starts like a PNG. */
export function oversizedPngLikeFile(): Buffer {
  const bytes = Buffer.alloc(5 * 1024 * 1024 + 1);
  imageFixtureBytes("upload-40x30.png").copy(bytes, 0, 0, 33);
  return bytes;
}

export const inspectorPanel = (page: Page) => page.getByRole("complementary", { name: "Inspector panel" });
export const uploadInput = (page: Page) => inspectorPanel(page).getByTestId("image-upload-input");

/** The Image's rendered <img> on the Canvas/Preview surface. */
export const canvasImage = (page: Page, nodeId: string) => page.locator(`[data-document-surface] [data-node-id="${nodeId}"] img`).first();

/** What the <img> shows, without shipping megabytes of src back to the test. */
export function imageState(page: Page, nodeId: string) {
  return canvasImage(page, nodeId).evaluate(async (image: HTMLImageElement) => {
    if (!image.complete) await image.decode().catch(() => undefined);
    return { width: image.naturalWidth, height: image.naturalHeight, alt: image.getAttribute("alt"), head: image.src.slice(0, 30), length: image.src.length };
  });
}

/** Opens the Elements panel and inserts an Image, returning its node id. */
export async function insertImage(page: Page): Promise<string> {
  const panel = page.locator('aside[aria-label="Resource panel"]');
  const before = await page.locator('[data-document-surface] [data-node-type="img"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-node-id")));
  await panel.getByRole("tab", { name: "Elements" }).click();
  await panel.getByRole("button", { name: /^Image\b/ }).first().click();
  await expect.poll(() => page.locator('[data-document-surface] [data-node-type="img"]').count()).toBe(before.length + 1);
  const after = await page.locator('[data-document-surface] [data-node-type="img"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-node-id")));
  const id = after.find((candidate) => !before.includes(candidate));
  if (!id) throw new Error("Image not inserted");
  return id;
}

/** BC-07.4: a structurally perfect PNG (valid chunks and CRCs) whose compressed image data is garbage. */
export function garbageBodyPng(): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(40, 0);
  header.writeUInt32BE(30, 4);
  header[8] = 8;
  header[9] = 6;
  const junk = Buffer.from(Array.from({ length: 400 }, (_, index) => (index * 37 + 11) & 0xff));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pngChunk("IHDR", header), pngChunk("IDAT", junk), pngChunk("IEND", Buffer.alloc(0))]);
}

/** BC-07.4: the animated GIF fixture with its LZW image data overwritten (structure and trailer intact). */
export function garbageBodyGif(): Buffer {
  const gif = Buffer.from(imageFixtureBytes("upload-20x10-animated.gif"));
  for (let index = 60; index < gif.length - 20; index += 1) if (gif[index - 1] !== 0x00 && gif[index] !== 0x00) gif[index] = (index * 29) & 0xff;
  return gif;
}
