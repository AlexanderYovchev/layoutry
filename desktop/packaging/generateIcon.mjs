// Builds the Windows .ico from Layoutry's existing logo mark — the real
// LayoutryLogoMark component as rendered by the built app, with its theme
// gradient resolved to concrete colors. No artwork is redrawn here and the
// source component is untouched. Rendering uses the Playwright Chromium
// already installed for the test suites (a build-time-only tool).
import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ICON_SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256];
const PAGE_ORIGIN = "http://layoutry.icon/";

const CONTENT_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".woff2": "font/woff2",
};

/** Packs PNG images into a multi-resolution .ico (PNG-compressed entries). */
export function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  const directory = Buffer.alloc(16 * images.length);
  let offset = header.length + directory.length;
  images.forEach(({ size, png }, index) => {
    const entry = index * 16;
    directory.writeUInt8(size >= 256 ? 0 : size, entry); // width (0 = 256)
    directory.writeUInt8(size >= 256 ? 0 : size, entry + 1); // height
    directory.writeUInt8(0, entry + 2); // palette colors
    directory.writeUInt8(0, entry + 3); // reserved
    directory.writeUInt16LE(1, entry + 4); // color planes
    directory.writeUInt16LE(32, entry + 6); // bits per pixel
    directory.writeUInt32LE(png.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, directory, ...images.map(({ png }) => png)]);
}

/**
 * @param {{ exportRoot: string, outFile: string, repoRoot: string }} options
 * @returns {Promise<{ sizes: number[], bytes: number }>}
 */
export async function generateIcon({ exportRoot, outFile, repoRoot }) {
  const require = createRequire(path.join(repoRoot, "package.json"));
  const { chromium } = require("@playwright/test");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    // Serve the static export offline from disk.
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin + "/" !== PAGE_ORIGIN) return route.abort();
      const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "");
      const file = path.join(exportRoot, relative || "index.html");
      if (!file.startsWith(exportRoot)) return route.abort();
      try {
        await route.fulfill({
          body: await readFile(file),
          contentType:
            CONTENT_TYPES[path.extname(file)] ?? "application/octet-stream",
        });
      } catch {
        await route.fulfill({ status: 404, body: "" });
      }
    });
    await page.goto(PAGE_ORIGIN);
    const mark = page.locator("svg:has(#layoutry-mark-gradient-a)").first();
    await mark.waitFor();

    // Standalone copy of the mark with the theme tokens resolved.
    const svgMarkup = await mark.evaluate((svg) => {
      const clone = svg.cloneNode(true);
      const liveStops = svg.querySelectorAll("stop");
      clone.querySelectorAll("stop").forEach((stop, index) => {
        stop.setAttribute(
          "stop-color",
          getComputedStyle(liveStops[index]).stopColor,
        );
        stop.removeAttribute("style");
      });
      clone.removeAttribute("class");
      clone.removeAttribute("aria-hidden");
      clone.removeAttribute("focusable");
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      return clone.outerHTML;
    });

    const images = [];
    for (const size of ICON_SIZES) {
      await page.setViewportSize({ width: size, height: size });
      await page.setContent(
        `<!doctype html><html><body style="margin:0;background:transparent">` +
          svgMarkup.replace(
            "<svg",
            `<svg width="${size}" height="${size}" style="display:block"`,
          ) +
          `</body></html>`,
      );
      const png = await page.screenshot({
        omitBackground: true,
        clip: { x: 0, y: 0, width: size, height: size },
      });
      images.push({ size, png });
    }

    const ico = buildIco(images);
    await writeFile(outFile, ico);
    await writeFile(outFile.replace(/\.ico$/, ".svg"), svgMarkup);
    return { sizes: ICON_SIZES, bytes: ico.length };
  } finally {
    await browser.close();
  }
}
