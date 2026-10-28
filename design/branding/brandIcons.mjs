// Layoutry's icon pipeline (BRAND-1.1). Every icon derives from the
// approved artwork, layoutry-icon-source.png, which is never modified.
// Sizes of 24 px and below use the simplified variants drawn from that
// artwork (layoutry-icon-small-*.svg): the full illustration turns to
// noise at those sizes. Build-time only; nothing here ships in the app.
// Location-independent on purpose (no import.meta), like releaseInfo.mjs:
// the Playwright suite transpiles it to CommonJS.
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/** Where the brand sources and their committed derivatives live. */
export function brandPaths(repoRoot) {
  const brandingDir = path.join(repoRoot, "design", "branding");
  return {
    brandingDir,
    sourcePath: path.join(brandingDir, "layoutry-icon-source.png"),
    windowsIconPath: path.join(brandingDir, "layoutry.ico"),
    // Next.js metadata file conventions: each file becomes a <link>.
    appDir: path.join(repoRoot, "src", "app"),
  };
}

/** Every size Windows asks for at 100–250 % scaling. */
export const WINDOWS_ICON_SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256];
export const FAVICON_SIZES = [16, 24, 32, 48];

/** Largest size that uses a simplified variant instead of the artwork. */
const SIMPLIFIED_MAX_SIZE = 24;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

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
 * Reads an .ico back into its entries. Throws on anything that is not a
 * well-formed icon of PNG-compressed images.
 * @param {Buffer} ico
 * @returns {{ size: number, png: Buffer }[]}
 */
export function readIco(ico) {
  if (ico.length < 6 || ico.readUInt16LE(0) !== 0 || ico.readUInt16LE(2) !== 1)
    throw new Error("not an .ico file");
  const count = ico.readUInt16LE(4);
  return Array.from({ length: count }, (_, index) => {
    const entry = 6 + index * 16;
    const length = ico.readUInt32LE(entry + 8);
    const offset = ico.readUInt32LE(entry + 12);
    if (offset + length > ico.length)
      throw new Error(`entry ${index} runs past the end of the file`);
    const png = ico.subarray(offset, offset + length);
    if (!png.subarray(0, 4).equals(PNG_SIGNATURE))
      throw new Error(`entry ${index} is not a PNG image`);
    return { size: ico.readUInt8(entry) || 256, png };
  });
}

/**
 * The approved artwork with its white backdrop and drop shadow removed,
 * cropped square around the rounded tile. The source is opaque RGB, so the
 * backdrop is flood-filled inward from the image border; light areas
 * inside the tile (the page, the glove) are never reached.
 * @param {string} sourcePath brandPaths().sourcePath
 * @returns {Promise<Buffer>} RGBA PNG
 */
export async function extractIconMaster(sourcePath) {
  const { data, info } = await sharp(sourcePath)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const isBackdrop = (p) =>
    data[p * 3] > 150 && data[p * 3 + 1] > 150 && data[p * 3 + 2] > 150;

  const backdrop = new Uint8Array(width * height);
  const stack = [];
  for (let x = 0; x < width; x++) stack.push(x, (height - 1) * width + x);
  for (let y = 0; y < height; y++) stack.push(y * width, y * width + width - 1);
  while (stack.length > 0) {
    const p = stack.pop();
    if (backdrop[p] || !isBackdrop(p)) continue;
    backdrop[p] = 1;
    const x = p % width;
    if (x > 0) stack.push(p - 1);
    if (x < width - 1) stack.push(p + 1);
    if (p >= width) stack.push(p - width);
    if (p < (height - 1) * width) stack.push(p + width);
  }

  const rgba = Buffer.alloc(width * height * 4);
  let [minX, minY, maxX, maxY] = [width, height, 0, 0];
  for (let p = 0; p < width * height; p++) {
    const x = p % width;
    const y = (p - x) / width;
    const touchesBackdrop =
      (x > 0 && backdrop[p - 1]) ||
      (x < width - 1 && backdrop[p + 1]) ||
      (y > 0 && backdrop[p - width]) ||
      (y < height - 1 && backdrop[p + width]);
    rgba.set(data.subarray(p * 3, p * 3 + 3), p * 4);
    // The tile's outermost pixel row is blended with the white backdrop;
    // keeping it half-transparent avoids a light fringe on dark taskbars.
    rgba[p * 4 + 3] = backdrop[p] ? 0 : touchesBackdrop ? 110 : 255;
    if (!backdrop[p]) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  const side = Math.max(maxX - minX, maxY - minY) + 1;
  const left = Math.round((minX + maxX + 1 - side) / 2);
  const top = Math.round((minY + maxY + 1 - side) / 2);
  // Padded first (sharp runs extract before extend within one pipeline),
  // so a crop square reaching past the source edge stays valid.
  const padded = await sharp(rgba, { raw: { width, height, channels: 4 } })
    .extend({
      top: side,
      bottom: side,
      left: side,
      right: side,
      background: "#0000",
    })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return sharp(padded.data, { raw: padded.info })
    .extract({ left: left + side, top: top + side, width: side, height: side })
    .png()
    .toBuffer();
}

async function renderSimplified(brandingDir, size) {
  const grid = size <= 16 ? 16 : 24;
  const svg = await readFile(
    path.join(brandingDir, `layoutry-icon-small-${grid}.svg`),
  );
  return sharp(svg, { density: (72 * size) / grid })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * Renders the icon at one pixel size: the simplified variant up to 24 px,
 * the approved artwork above that.
 * @param {{ master: Buffer, brandingDir: string }} icon
 * @param {number} size
 * @returns {Promise<Buffer>} PNG
 */
export function renderIconPng({ master, brandingDir }, size) {
  if (size <= SIMPLIFIED_MAX_SIZE) return renderSimplified(brandingDir, size);
  return sharp(master)
    .resize(size, size, { kernel: "lanczos3" })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * An opaque square version for platforms that apply their own mask and
 * fill transparency with black (the Apple touch icon): the tile's corners
 * are filled with its own deep-blue edge color.
 */
export function renderOpaqueIconPng(master, size) {
  return sharp(master)
    .resize(size, size, { kernel: "lanczos3" })
    .flatten({ background: "#0a1d89" })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * Palette-quantizes a PNG for web delivery (~80 % smaller, visually
 * identical at icon sizes). Not used for .ico entries.
 */
export function optimizeForWeb(png) {
  return sharp(png)
    .png({
      palette: true,
      quality: 95,
      effort: 10,
      dither: 1,
      compressionLevel: 9,
    })
    .toBuffer();
}

/** Builds a multi-resolution .ico from the approved identity. */
export async function buildBrandIco(icon, sizes) {
  const images = [];
  for (const size of sizes)
    images.push({ size, png: await renderIconPng(icon, size) });
  return buildIco(images);
}
