import { readFileSync } from "node:fs";
import path from "node:path";
import { crc32, deflateSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import { IMAGE_UPLOAD_MESSAGES, validateImageUpload } from "./validateImageUpload";
import { verifyPngImageData } from "./verifyPngImageData";

const fixture = (name: string) => new Uint8Array(readFileSync(path.join(process.cwd(), "test", "fixtures", "images", name)));
const u32 = (value: number) => {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0);
  return buffer;
};
const chunk = (type: string, data: Buffer) => Buffer.concat([u32(data.length), Buffer.from(type), data, u32(crc32(Buffer.concat([Buffer.from(type), data])))]);

/** A structurally perfect PNG (valid chunks and CRCs) around any IDAT payload. */
function png(width: number, height: number, idat: Buffer, options: { colorType?: number; interlace?: number } = {}): Uint8Array {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = options.colorType ?? 6;
  header[12] = options.interlace ?? 0;
  return new Uint8Array(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", header), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]));
}

describe("verifyPngImageData (BC-07.4)", () => {
  it("real PNGs inflate to the size their header needs", async () => {
    expect(await verifyPngImageData(fixture("upload-40x30.png"))).toBe(true);
    expect(await verifyPngImageData(fixture("upload-8192x1.png"))).toBe(true);
    // RGB, 10×4: 4 rows of (1 filter byte + 30 pixel bytes).
    expect(await verifyPngImageData(png(10, 4, deflateSync(Buffer.alloc(4 * 31)), { colorType: 2 }))).toBe(true);
  });

  it("Adam7-interlaced PNGs are sized per pass", async () => {
    // 8×8 RGBA, the seven passes: 1×1, 1×1, 2×1, 2×2, 4×2, 4×4, 8×4 pixels (+1 filter byte per row).
    const rows = [[1, 1], [1, 1], [2, 1], [2, 2], [4, 2], [4, 4], [8, 4]].reduce((sum, [w, h]) => sum + h * (1 + w * 4), 0);
    expect(await verifyPngImageData(png(8, 8, deflateSync(Buffer.alloc(rows)), { interlace: 1 }))).toBe(true);
    expect(await verifyPngImageData(png(8, 8, deflateSync(Buffer.alloc(rows - 1)), { interlace: 1 }))).toBe(false);
  });

  it("garbage IDAT bytes behind a perfect structure are damaged (Firefox and WebKit would still 'decode' them)", async () => {
    const garbage = Buffer.from(Array.from({ length: 400 }, (_, index) => (index * 37 + 11) & 0xff));
    expect(await verifyPngImageData(png(40, 30, garbage))).toBe(false);
  });

  it("a stream cut short, or one that inflates to too few bytes, is damaged", async () => {
    const full = deflateSync(Buffer.alloc(30 * (1 + 40 * 4)));
    expect(await verifyPngImageData(png(40, 30, full.subarray(0, full.length - 6)))).toBe(false);
    expect(await verifyPngImageData(png(40, 30, deflateSync(Buffer.alloc(100))))).toBe(false);
  });

  it("an invalid header (no IDAT, unknown colour type) is damaged", async () => {
    expect(await verifyPngImageData(png(40, 30, Buffer.alloc(0)))).toBe(false);
    expect(await verifyPngImageData(png(40, 30, deflateSync(Buffer.alloc(10)), { colorType: 5 }))).toBe(false);
  });

  it("validateImageUpload refuses such a PNG as damaged before the browser decoder ever sees it", async () => {
    const garbage = png(40, 30, Buffer.from(Array.from({ length: 400 }, (_, index) => (index * 37 + 11) & 0xff)));
    const decode = vi.fn(async () => ({ width: 40, height: 30 }));
    const file = { name: "photo.png", type: "image/png", size: garbage.length, arrayBuffer: async () => garbage.slice().buffer };
    expect(await validateImageUpload(file, decode)).toEqual({ ok: false, message: IMAGE_UPLOAD_MESSAGES.damaged });
    expect(decode).not.toHaveBeenCalled();
  });
});
