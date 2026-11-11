import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { EditorElementNode } from "../src/features/editor/types/document";
import { exportHtmlCss } from "../src/features/export/utils/exportHtmlCss";
import { gotoApp } from "./support/gotoApp";
import { dataUrlOf } from "./support/imageUploads";
import { importDocument } from "./support/parityFixtures";

/**
 * BC-07.4 — uploaded images on every surface, at 320/375/768/1024/1440 px:
 * Design (Canvas) and Preview with the page sheet pinned to the width, the
 * Single HTML file (data URLs) and the portable Separate files folder
 * (assets/ files, opened from disk). Source strings differ by design
 * (data URL vs. relative file); what must match is the rendering: natural
 * and rendered size, position, object-fit, border, radius, opacity,
 * visibility, display and alt.
 */

const WIDTHS = [320, 375, 768, 1024, 1440] as const;
const side = { width: { value: 3, unit: "px" as const }, style: "solid" as const, color: "#1f2937" };
const corner = { value: 12, unit: "px" as const };

const document: EditorElementNode = {
  id: "page-root",
  tag: "page",
  children: [
    {
      id: "img-a",
      tag: "img",
      src: dataUrlOf("upload-40x30.png", "image/png"),
      displayName: "Transparent PNG",
      mediaFit: { objectFit: "cover" },
      border: { top: side, right: side, bottom: side, left: side },
      borderRadius: { topLeft: corner, topRight: corner, bottomRight: corner, bottomLeft: corner },
      filters: { opacity: 70 },
    },
    { id: "img-b", tag: "img", src: dataUrlOf("upload-32x24.jpg", "image/jpeg"), displayName: "JPEG contain", mediaFit: { objectFit: "contain" } },
    { id: "img-c", tag: "img", src: dataUrlOf("upload-20x10-animated.gif", "image/gif"), displayName: "Animated GIF" },
    { id: "img-d", tag: "img", src: dataUrlOf("upload-24x16.webp", "image/webp"), displayName: "Hidden WebP", display: { visibility: "hidden" } },
    { id: "img-e", tag: "img", src: dataUrlOf("upload-40x30.png", "image/png"), displayName: "Not displayed", display: { display: "none" } },
    { id: "img-f", tag: "img", src: dataUrlOf("upload-8192x1.png", "image/png"), displayName: "Very wide" },
  ],
};
const ALTS = document.children!.map((child) => child.displayName!);

interface ImageMeasure {
  alt: string;
  natural: [number, number];
  frame: { x: number; y: number; width: number; height: number };
  image: { width: number; height: number };
  objectFit: string;
  border: string;
  radius: string;
  opacity: string;
  visibility: string;
  display: string;
}

/** Measures every image under `root`, positions relative to the first image's frame. */
function measureAll(root: Locator): Promise<ImageMeasure[]> {
  return root.evaluate(async (element, alts) => {
    const images = alts.map((alt) => element.querySelector<HTMLImageElement>(`img[alt="${CSS.escape(alt)}"]`)).filter((image): image is HTMLImageElement => image !== null);
    await Promise.all(images.map((image) => (image.complete ? undefined : image.decode().catch(() => undefined))));
    const origin = images[0].parentElement!.getBoundingClientRect();
    return images.map((image) => {
      const frame = image.parentElement!;
      const frameBox = frame.getBoundingClientRect();
      const imageBox = image.getBoundingClientRect();
      const frameStyle = getComputedStyle(frame);
      const imageStyle = getComputedStyle(image);
      return {
        alt: image.alt,
        natural: [image.naturalWidth, image.naturalHeight] as [number, number],
        frame: { x: frameBox.left - origin.left, y: frameBox.top - origin.top, width: frameBox.width, height: frameBox.height },
        image: { width: imageBox.width, height: imageBox.height },
        objectFit: imageStyle.objectFit,
        border: `${frameStyle.borderTopWidth} ${frameStyle.borderTopStyle} | ${imageStyle.borderTopWidth} ${imageStyle.borderTopStyle}`,
        radius: `${frameStyle.borderTopLeftRadius} | ${imageStyle.borderTopLeftRadius}`,
        opacity: `${frameStyle.opacity} | ${imageStyle.opacity}`,
        visibility: imageStyle.visibility,
        display: frameStyle.display,
      };
    });
  }, ALTS);
}

function expectSame(reference: ImageMeasure[], other: ImageMeasure[], label: string) {
  expect(other.map((entry) => entry.alt), `${label}: images`).toEqual(reference.map((entry) => entry.alt));
  reference.forEach((expected, index) => {
    const actual = other[index];
    const at = `${label}: ${expected.alt}`;
    expect(actual.natural, `${at} natural size`).toEqual(expected.natural);
    // A display:none box has no geometry (an empty rect at the viewport origin): only its display value is compared.
    if (expected.display === "none") {
      expect(actual.display, `${at} display`).toBe("none");
      return;
    }
    for (const key of ["x", "y", "width", "height"] as const) expect(Math.abs(actual.frame[key] - expected.frame[key]), `${at} frame ${key}`).toBeLessThanOrEqual(1);
    for (const key of ["width", "height"] as const) expect(Math.abs(actual.image[key] - expected.image[key]), `${at} image ${key}`).toBeLessThanOrEqual(1);
    for (const key of ["objectFit", "border", "radius", "opacity", "visibility", "display"] as const) expect(actual[key], `${at} ${key}`).toBe(expected[key]);
  });
}

async function pinSheetWidth(page: Page, width: number) {
  await page.evaluate((value) => {
    let style = window.document.getElementById("bc074-sheet-width");
    if (!style) {
      style = window.document.createElement("style");
      style.id = "bc074-sheet-width";
      window.document.head.append(style);
    }
    style.textContent = `[data-document-surface] { width: ${value + 2}px !important; max-width: none !important; }`;
  }, width);
}

let folder: string;
test.beforeAll(() => {
  folder = mkdtempSync(path.join(os.tmpdir(), "layoutry-bc074-parity-"));
});
test.afterAll(() => {
  rmSync(folder, { recursive: true, force: true });
});

test("uploaded images render the same on the Canvas, in Preview, in a Single HTML file and in the portable site, at every width", async ({ page, browser, browserName }) => {
  test.setTimeout(180_000);
  const standalone = exportHtmlCss(document, { mode: "standalone", title: "BC-07.4 parity" });
  const separate = exportHtmlCss(document, { mode: "separate", title: "BC-07.4 parity" });
  expect(standalone.ok && separate.ok).toBe(true);
  // Two identical PNG sources (img-a and img-e) share one file.
  expect(separate.assetFiles.map((file) => file.path)).toEqual(["assets/image-001.png", "assets/image-002.jpg", "assets/image-003.gif", "assets/image-004.webp", "assets/image-005.png"]);
  const site = path.join(folder, browserName);
  mkdirSync(path.join(site, "assets"), { recursive: true });
  for (const file of separate.files) writeFileSync(path.join(site, file.path), file.content);
  for (const asset of separate.assetFiles) writeFileSync(path.join(site, asset.path), asset.bytes);

  await page.setViewportSize({ width: 2600, height: 1200 });
  await gotoApp(page);
  await importDocument(page, document, "img-a");
  const single = await browser.newPage();
  await single.route(/^https?:/, (route) => route.abort());
  await single.setContent(standalone.files[0].content);
  const portable = await browser.newPage();
  await portable.route(/^https?:/, (route) => route.abort());
  await portable.goto(pathToFileURL(path.join(site, "index.html")).href);

  for (const width of WIDTHS) {
    await pinSheetWidth(page, width);
    if (await page.getByRole("button", { name: "Exit Preview" }).isVisible()) await page.getByRole("button", { name: "Exit Preview" }).click();
    const design = await measureAll(page.locator("[data-document-surface]"));
    await page.getByRole("button", { name: "Enter Preview" }).click();
    await expect(page.getByRole("button", { name: "Exit Preview" })).toBeVisible();
    const preview = await measureAll(page.locator("[data-document-surface]"));
    await single.setViewportSize({ width, height: 900 });
    await portable.setViewportSize({ width, height: 900 });
    const singleFile = await measureAll(single.locator("body"));
    const portableSite = await measureAll(portable.locator("body"));
    const label = `${browserName} @ ${width}px`;

    expect(design.map((entry) => entry.natural), `${label}: natural sizes`).toEqual([[40, 30], [32, 24], [20, 10], [24, 16], [40, 30], [8192, 1]]);
    expect(design[0], `${label}: authored styles`).toMatchObject({ objectFit: "cover", opacity: expect.stringMatching(/0\.7/), radius: expect.stringContaining("12px") });
    expect(design[3].visibility).toBe("hidden");
    expect(design[4].display).toBe("none");
    expectSame(design, preview, `${label} Design vs Preview`);
    expectSame(design, singleFile, `${label} Design vs Single HTML file`);
    expectSame(design, portableSite, `${label} Design vs portable site`);
  }

  // GIF animation survives: the packaged file's own bytes still decode to both frames (Chromium's ImageDecoder).
  if (browserName === "chromium") {
    const gif = Array.from(separate.assetFiles[2].bytes);
    const frames = await portable.evaluate(async (bytes) => {
      const Decoder = Reflect.get(window, "ImageDecoder") as (new (init: { data: Uint8Array; type: string }) => { tracks: { ready: Promise<void>; selectedTrack: { frameCount: number } | null } }) | undefined;
      if (!Decoder) return null;
      const decoder = new Decoder({ data: new Uint8Array(bytes), type: "image/gif" });
      await decoder.tracks.ready;
      return decoder.tracks.selectedTrack?.frameCount ?? null;
    }, gif);
    expect(frames).toBe(2);
  }
  await single.close();
  await portable.close();
});
