// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildIco } from "./generateIcon.mjs";

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
