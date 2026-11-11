import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sniffRasterImage } from "./sniffRasterImage";

const fixture = (name: string) => new Uint8Array(readFileSync(path.join(process.cwd(), "test", "fixtures", "images", name)));
const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((part) => (typeof part === "string" ? Array.from(part, (char) => char.charCodeAt(0)) : part)));
const le32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
const pad = (length: number) => new Array<number>(length).fill(0);

/** A RIFF/WEBP container around one chunk body, with a correct RIFF size. */
function webp(fourCc: string, body: number[]): Uint8Array {
  const chunk = [...bytes(fourCc), ...le32(body.length), ...body];
  return bytes("RIFF", le32(4 + chunk.length), "WEBP", chunk);
}

describe("sniffRasterImage (BC-07.2): the bytes decide the format and the header size", () => {
  it.each([
    ["upload-40x30.png", "png", "image/png", 40, 30],
    ["upload-32x24.jpg", "jpeg", "image/jpeg", 32, 24],
    ["upload-20x10-animated.gif", "gif", "image/gif", 20, 10],
    ["upload-24x16.webp", "webp", "image/webp", 24, 16],
    ["upload-8192x1.png", "png", "image/png", 8192, 1],
    ["upload-8193x1.png", "png", "image/png", 8193, 1],
  ])("reads %s as %s %dx%d", (name, format, mediaType, width, height) => {
    expect(sniffRasterImage(fixture(name))).toEqual({ ok: true, format, mediaType, width, height });
  });

  it("recognizes SVG, XML and HTML markup whatever the file is called", () => {
    for (const name of ["svg-image.svg", "svg-renamed.png", "html-renamed.png"]) expect(sniffRasterImage(fixture(name))).toEqual({ ok: false, reason: "svg" });
    expect(sniffRasterImage(bytes([0xef, 0xbb, 0xbf], "  \n<svg/>"))).toEqual({ ok: false, reason: "svg" });
  });

  it("refuses text and unknown signatures (BMP, empty)", () => {
    expect(sniffRasterImage(fixture("text-renamed.jpg"))).toEqual({ ok: false, reason: "unsupported" });
    expect(sniffRasterImage(bytes("BM", pad(60)))).toEqual({ ok: false, reason: "unsupported" });
    expect(sniffRasterImage(new Uint8Array())).toEqual({ ok: false, reason: "unsupported" });
  });

  it("PNG: a signature without a 13-byte IHDR first chunk is malformed", () => {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    expect(sniffRasterImage(bytes(signature))).toEqual({ ok: false, reason: "malformed" });
    expect(sniffRasterImage(bytes(signature, [0, 0, 0, 13], "IDAT", pad(17)))).toEqual({ ok: false, reason: "malformed" });
    expect(sniffRasterImage(bytes(signature, [0, 0, 0, 12], "IHDR", pad(17)))).toEqual({ ok: false, reason: "malformed" });
  });

  describe("PNG completeness: every chunk fits, image data comes before IEND", () => {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    const ihdr = [0, 0, 0, 13, ...bytes("IHDR"), 0, 0, 0, 4, 0, 0, 0, 3, 8, 6, 0, 0, 0, ...pad(4)];
    const idat = [0, 0, 0, 2, ...bytes("IDAT"), 1, 2, ...pad(4)];
    const iend = [0, 0, 0, 0, ...bytes("IEND"), ...pad(4)];

    it("a complete chunk sequence is a PNG", () => {
      expect(sniffRasterImage(bytes(signature, ihdr, idat, iend))).toMatchObject({ ok: true, format: "png", width: 4, height: 3 });
    });

    it("cut off (no IEND), no image data, or a chunk longer than the file is malformed", () => {
      expect(sniffRasterImage(bytes(signature, ihdr, idat))).toEqual({ ok: false, reason: "malformed" });
      expect(sniffRasterImage(bytes(signature, ihdr, iend))).toEqual({ ok: false, reason: "malformed" });
      expect(sniffRasterImage(bytes(signature, ihdr, [0, 0, 0x10, 0, ...bytes("IDAT"), 1, 2], iend))).toEqual({ ok: false, reason: "malformed" });
      expect(sniffRasterImage(fixture("upload-truncated.png"))).toEqual({ ok: false, reason: "malformed" });
    });
  });

  it("GIF: both versions, and a header cut short is malformed", () => {
    expect(sniffRasterImage(bytes("GIF87a", [5, 0, 7, 0, 0, 0, 0, 0x3b]))).toMatchObject({ ok: true, format: "gif", width: 5, height: 7 });
    expect(sniffRasterImage(bytes("GIF89a", [5, 0]))).toEqual({ ok: false, reason: "malformed" });
  });

  it("GIF: a file without its trailer (cut off) is malformed; zero padding after the trailer is fine", () => {
    const gif = fixture("upload-20x10-animated.gif");
    expect(sniffRasterImage(gif.subarray(0, gif.length - 1))).toEqual({ ok: false, reason: "malformed" });
    expect(sniffRasterImage(gif.subarray(0, 120))).toEqual({ ok: false, reason: "malformed" });
    expect(sniffRasterImage(bytes(Array.from(gif), [0, 0, 0]))).toMatchObject({ ok: true, width: 20, height: 10 });
  });

  it("WebP: lossy VP8, lossless VP8L and extended VP8X headers", () => {
    // VP8: frame tag (3), start code 9d 01 2a, 14-bit width/height.
    expect(sniffRasterImage(webp("VP8 ", [0, 0, 0, 0x9d, 0x01, 0x2a, 300 & 0xff, 300 >> 8, 200 & 0xff, 200 >> 8]))).toMatchObject({ ok: true, width: 300, height: 200 });
    // VP8L: signature 0x2f, then (width-1) in 14 bits and (height-1) in the next 14.
    const bits = (640 - 1) | ((480 - 1) << 14);
    expect(sniffRasterImage(webp("VP8L", [0x2f, ...le32(bits), ...pad(5)]))).toMatchObject({ ok: true, width: 640, height: 480 });
    // VP8X: flags (4), then 24-bit (width-1) and (height-1).
    expect(sniffRasterImage(webp("VP8X", [0, 0, 0, 0, 0xff, 0x1f, 0, 0xff, 0x1f, 0]))).toMatchObject({ ok: true, width: 8192, height: 8192 });
  });

  it("WebP: a broken VP8/VP8L signature, an unknown chunk, or a RIFF size longer than the file is malformed", () => {
    expect(sniffRasterImage(webp("VP8 ", [0, 0, 0, 0x9d, 0x01, 0x2b, 1, 0, 1, 0]))).toEqual({ ok: false, reason: "malformed" });
    expect(sniffRasterImage(webp("VP8L", [0x2e, ...pad(10)]))).toEqual({ ok: false, reason: "malformed" });
    expect(sniffRasterImage(webp("ABCD", pad(10)))).toEqual({ ok: false, reason: "malformed" });
    const truncated = webp("VP8X", pad(10));
    truncated[4] = 0xff;
    expect(sniffRasterImage(truncated)).toEqual({ ok: false, reason: "malformed" });
  });

  describe("JPEG: walks variable-length segments through the frame header to the scan", () => {
    const soi = [0xff, 0xd8];
    const app0 = [0xff, 0xe0, 0x00, 0x10, ...bytes("JFIF"), ...pad(10)];
    const sof = (marker: number, width: number, height: number) => [0xff, marker, 0x00, 0x0b, 8, height >> 8, height & 0xff, width >> 8, width & 0xff, 1, 1, 0x11, 0];
    /** Start of scan, entropy-coded data (with a stuffed FF 00 and a restart marker), end of image. */
    const scanToEnd = [0xff, 0xda, 0x00, 0x08, 1, 1, 0, 0, 0x3f, 0, 0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56, 0xff, 0xd9];

    it("finds baseline and progressive frames after APP and DHT segments, with fill bytes", () => {
      const dht = [0xff, 0xc4, 0x00, 0x04, 0, 0];
      expect(sniffRasterImage(bytes(soi, app0, dht, sof(0xc0, 1920, 1080), scanToEnd))).toMatchObject({ ok: true, format: "jpeg", width: 1920, height: 1080 });
      expect(sniffRasterImage(bytes(soi, app0, [0xff, 0xff], sof(0xc2, 8193, 10), scanToEnd))).toMatchObject({ ok: true, width: 8193, height: 10 });
    });

    it("a file cut off in its scan data (no end-of-image marker) is malformed", () => {
      expect(sniffRasterImage(bytes(soi, app0, sof(0xc0, 10, 10), scanToEnd.slice(0, -2)))).toEqual({ ok: false, reason: "malformed" });
      const real = fixture("upload-32x24.jpg");
      expect(sniffRasterImage(real.subarray(0, real.length - 2))).toEqual({ ok: false, reason: "malformed" });
    });

    it("an EXIF thumbnail's end marker before the scan doesn't make a cut-off file complete", () => {
      const app1WithThumbnail = [0xff, 0xe1, 0x00, 0x08, 0xff, 0xd8, 0x00, 0x00, 0xff, 0xd9];
      expect(sniffRasterImage(bytes(soi, app1WithThumbnail, sof(0xc0, 10, 10), scanToEnd.slice(0, -2)))).toEqual({ ok: false, reason: "malformed" });
    });

    it("scan data or end-of-image before any frame header is malformed", () => {
      expect(sniffRasterImage(bytes(soi, app0, [0xff, 0xda, 0x00, 0x02]))).toEqual({ ok: false, reason: "malformed" });
      expect(sniffRasterImage(bytes(soi, app0, [0xff, 0xd9]))).toEqual({ ok: false, reason: "malformed" });
      expect(sniffRasterImage(bytes(soi, app0))).toEqual({ ok: false, reason: "malformed" });
    });

    it("a segment longer than the file, a length under 2 or a missing marker prefix is malformed", () => {
      expect(sniffRasterImage(bytes(soi, [0xff, 0xe1, 0x40, 0x00, 1, 2, 3]))).toEqual({ ok: false, reason: "malformed" });
      expect(sniffRasterImage(bytes(soi, [0xff, 0xe1, 0x00, 0x01]))).toEqual({ ok: false, reason: "malformed" });
      expect(sniffRasterImage(bytes(soi, app0, [0x12, 0x34]))).toEqual({ ok: false, reason: "malformed" });
      expect(sniffRasterImage(bytes(soi, [0xff, 0xc0, 0x00, 0x05, 8, 0, 1]))).toEqual({ ok: false, reason: "malformed" });
    });
  });
});
