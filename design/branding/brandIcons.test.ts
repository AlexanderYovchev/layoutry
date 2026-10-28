// @vitest-environment node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  brandPaths,
  buildIco,
  extractIconMaster,
  FAVICON_SIZES,
  readIco,
  WINDOWS_ICON_SIZES,
} from "./brandIcons.mjs";

const { appDir, sourcePath, windowsIconPath } = brandPaths(
  fileURLToPath(new URL("../..", import.meta.url)),
);

function fakePng(bytes: number): Buffer {
  return Buffer.alloc(bytes, 0xab);
}

describe("buildIco", () => {
  it("writes a valid ICO header and one directory entry per image", () => {
    const images = [
      { size: 16, png: fakePng(10) },
      { size: 32, png: fakePng(20) },
      { size: 256, png: fakePng(30) },
    ];
    const ico = buildIco(images);

    expect(ico.readUInt16LE(0)).toBe(0); // reserved
    expect(ico.readUInt16LE(2)).toBe(1); // type: icon
    expect(ico.readUInt16LE(4)).toBe(3); // image count
    expect(ico.length).toBe(6 + 16 * 3 + 10 + 20 + 30);

    const entry = (index: number) => 6 + index * 16;
    expect(ico.readUInt8(entry(0))).toBe(16);
    expect(ico.readUInt8(entry(1))).toBe(32);
    // 256 px is stored as 0 by the ICO format.
    expect(ico.readUInt8(entry(2))).toBe(0);
    expect(ico.readUInt8(entry(2) + 1)).toBe(0);
  });

  it("points every entry at its own PNG bytes", () => {
    const images = [
      { size: 16, png: Buffer.from("first") },
      { size: 48, png: Buffer.from("second!") },
    ];
    const ico = buildIco(images);
    images.forEach(({ png }, index) => {
      const entry = 6 + index * 16;
      expect(ico.readUInt16LE(entry + 4)).toBe(1); // planes
      expect(ico.readUInt16LE(entry + 6)).toBe(32); // bits per pixel
      const size = ico.readUInt32LE(entry + 8);
      const offset = ico.readUInt32LE(entry + 12);
      expect(size).toBe(png.length);
      expect(ico.subarray(offset, offset + size).equals(png)).toBe(true);
    });
  });
});

describe("readIco", () => {
  it("round-trips what buildIco writes", () => {
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      Buffer.from("rest"),
    ]);
    const entries = readIco(
      buildIco([
        { size: 16, png },
        { size: 256, png },
      ]),
    );
    expect(entries.map((entry) => entry.size)).toEqual([16, 256]);
    expect(entries[1].png.equals(png)).toBe(true);
  });

  it("rejects a PNG renamed to .ico", async () => {
    const png = await readFile(sourcePath);
    expect(() => readIco(png)).toThrow("not an .ico file");
  });
});

async function expectIcoSizes(file: string, sizes: number[]) {
  const entries = readIco(await readFile(file));
  expect(entries.map((entry) => entry.size)).toEqual(sizes);
  for (const { size, png } of entries) {
    const meta = await sharp(png).metadata();
    expect([meta.width, meta.height, meta.hasAlpha]).toEqual([
      size,
      size,
      true,
    ]);
  }
}

describe("committed brand assets", () => {
  it("the Windows icon holds every size from 16 to 256 px", async () => {
    await expectIcoSizes(windowsIconPath, WINDOWS_ICON_SIZES);
    expect(WINDOWS_ICON_SIZES).toEqual(
      expect.arrayContaining([16, 24, 32, 48, 64, 128, 256]),
    );
  });

  it("the favicon holds the browser tab sizes", async () => {
    await expectIcoSizes(path.join(appDir, "favicon.ico"), FAVICON_SIZES);
  });

  it("the web icons are real PNGs at their declared sizes", async () => {
    for (const [name, size, hasAlpha] of [
      ["icon.png", 192, true],
      // Opaque: iOS fills transparency with black.
      ["apple-icon.png", 180, false],
    ] as const) {
      const meta = await sharp(path.join(appDir, name)).metadata();
      expect([meta.format, meta.width, meta.height, meta.hasAlpha]).toEqual([
        "png",
        size,
        size,
        hasAlpha,
      ]);
    }
  });
});

describe("extractIconMaster", () => {
  it("removes the artwork's white backdrop but keeps the tile and its light content", async () => {
    const master = await extractIconMaster(sourcePath);
    const { data, info } = await sharp(master)
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(info.width).toBe(info.height);
    const alphaAt = (fx: number, fy: number) =>
      data[
        (Math.floor(fy * (info.height - 1)) * info.width +
          Math.floor(fx * (info.width - 1))) *
          4 +
          3
      ];
    // Outside the rounded corners: transparent.
    expect(alphaAt(0, 0)).toBe(0);
    expect(alphaAt(1, 1)).toBe(0);
    // Tile edge, the white page and the white glove: opaque.
    expect(alphaAt(0.5, 0.02)).toBe(255);
    expect(alphaAt(0.3, 0.6)).toBe(255);
    expect(alphaAt(0.78, 0.72)).toBe(255);
  });
});
