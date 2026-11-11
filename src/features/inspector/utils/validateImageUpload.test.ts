import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  bytesToBase64,
  IMAGE_UPLOAD_MESSAGES,
  MAX_IMAGE_UPLOAD_BYTES,
  validateImageUpload,
  type DecodeImage,
  type ImageUploadFile,
} from "./validateImageUpload";

const fixtureBytes = (name: string) => new Uint8Array(readFileSync(path.join(process.cwd(), "test", "fixtures", "images", name)));

function fileOf(bytes: Uint8Array, name: string, type = ""): ImageUploadFile & { arrayBuffer: ReturnType<typeof vi.fn> } {
  return {
    name,
    type,
    size: bytes.length,
    arrayBuffer: vi.fn(async () => bytes.slice().buffer),
  };
}

/** Decodes to the header's size, like a real decoder would for these fixtures. */
const decodeAsHeader = (width: number, height: number): DecodeImage => vi.fn(async () => ({ width, height }));

describe("validateImageUpload (BC-07.2)", () => {
  it.each([
    ["upload-40x30.png", "image/png", "image/png", 40, 30],
    ["upload-32x24.jpg", "image/jpeg", "image/jpeg", 32, 24],
    ["upload-20x10-animated.gif", "image/gif", "image/gif", 20, 10],
    ["upload-24x16.webp", "image/webp", "image/webp", 24, 16],
  ])("accepts %s and embeds its exact bytes as a %s data URL", async (name, reported, mediaType, width, height) => {
    const bytes = fixtureBytes(name);
    const result = await validateImageUpload(fileOf(bytes, name, reported), decodeAsHeader(width, height));
    expect(result).toEqual({
      ok: true,
      image: {
        dataUrl: `data:${mediaType};base64,${Buffer.from(bytes).toString("base64")}`,
        format: mediaType.slice(6),
        mediaType,
        fileName: name,
        byteLength: bytes.length,
        width,
        height,
      },
    });
  });

  it("the data URL's type comes from the bytes: a JPEG named .png with type image/png becomes image/jpeg", async () => {
    const result = await validateImageUpload(fileOf(fixtureBytes("upload-32x24.jpg"), "photo.png", "image/png"), decodeAsHeader(32, 24));
    expect(result.ok && result.image.dataUrl.startsWith("data:image/jpeg;base64,")).toBe(true);
  });

  it("files with no name extension or no reported type are judged by their bytes", async () => {
    expect((await validateImageUpload(fileOf(fixtureBytes("upload-40x30.png"), "image", ""), decodeAsHeader(40, 30))).ok).toBe(true);
  });

  describe("spoofing: a raster name or type never lets other content through", () => {
    it.each([
      ["html-renamed.png", "image/png", IMAGE_UPLOAD_MESSAGES.svg],
      ["svg-renamed.png", "image/png", IMAGE_UPLOAD_MESSAGES.svg],
      ["text-renamed.jpg", "image/jpeg", IMAGE_UPLOAD_MESSAGES.unsupported],
    ])("%s (reported %s) is refused and never decoded", async (name, type, message) => {
      const decode = decodeAsHeader(1, 1);
      expect(await validateImageUpload(fileOf(fixtureBytes(name), name, type), decode)).toEqual({ ok: false, message });
      expect(decode).not.toHaveBeenCalled();
    });

    it("an SVG is refused by extension or by type, before it is read", async () => {
      const svg = fixtureBytes("svg-image.svg");
      for (const file of [fileOf(svg, "logo.svg", ""), fileOf(svg, "logo", "image/svg+xml"), fileOf(svg, "logo.SVGZ", "")]) {
        expect(await validateImageUpload(file, decodeAsHeader(1, 1))).toEqual({ ok: false, message: IMAGE_UPLOAD_MESSAGES.svg });
        expect(file.arrayBuffer).not.toHaveBeenCalled();
      }
    });

    it("a name or reported type outside the raster allow-list is refused even when the bytes are a PNG", async () => {
      const png = fixtureBytes("upload-40x30.png");
      for (const file of [fileOf(png, "page.html", ""), fileOf(png, "image.bmp", "image/bmp"), fileOf(png, "image.png", "text/html")])
        expect(await validateImageUpload(file, decodeAsHeader(40, 30))).toEqual({ ok: false, message: IMAGE_UPLOAD_MESSAGES.unsupported });
    });
  });

  describe("size limit: 5 MB = 5 × 1024 × 1024 bytes", () => {
    /** The 40x30 fixture grown to exactly `length` bytes by a private ancillary chunk before IEND. */
    function pngOfLength(length: number): Uint8Array {
      const png = fixtureBytes("upload-40x30.png");
      const bytes = new Uint8Array(length);
      const beforeEnd = png.length - 12;
      bytes.set(png.subarray(0, beforeEnd));
      const dataLength = length - png.length - 12;
      new DataView(bytes.buffer).setUint32(beforeEnd, dataLength);
      bytes.set([0x70, 0x72, 0x56, 0x74], beforeEnd + 4); // "prVt"
      bytes.set(png.subarray(beforeEnd), length - 12);
      return bytes;
    }

    it("exactly 5 MB passes the size check", async () => {
      expect(MAX_IMAGE_UPLOAD_BYTES).toBe(5_242_880);
      expect((await validateImageUpload(fileOf(pngOfLength(MAX_IMAGE_UPLOAD_BYTES), "big.png", "image/png"), decodeAsHeader(40, 30))).ok).toBe(true);
    });

    it("one byte more is refused before the file is read or decoded", async () => {
      const file = fileOf(pngOfLength(MAX_IMAGE_UPLOAD_BYTES + 1), "big.png", "image/png");
      const decode = decodeAsHeader(40, 30);
      expect(await validateImageUpload(file, decode)).toEqual({ ok: false, message: "Image is too large. Maximum file size is 5 MB." });
      expect(file.arrayBuffer).not.toHaveBeenCalled();
      expect(decode).not.toHaveBeenCalled();
    });

    it("a file that reads larger than it reported is still refused", async () => {
      const file = { ...fileOf(pngOfLength(MAX_IMAGE_UPLOAD_BYTES + 1), "big.png"), size: 100 };
      expect(await validateImageUpload(file, decodeAsHeader(40, 30))).toEqual({ ok: false, message: IMAGE_UPLOAD_MESSAGES.tooLarge });
    });

    it("an empty file is refused", async () => {
      expect(await validateImageUpload(fileOf(new Uint8Array(), "empty.png"), decodeAsHeader(1, 1))).toEqual({ ok: false, message: IMAGE_UPLOAD_MESSAGES.empty });
    });
  });

  describe("dimension limit: 8192 pixels per side", () => {
    it("8192 × 1 is accepted", async () => {
      expect((await validateImageUpload(fileOf(fixtureBytes("upload-8192x1.png"), "wide.png", "image/png"), decodeAsHeader(8192, 1))).ok).toBe(true);
    });

    it("8193 × 1 is refused from the header, before any decode", async () => {
      const decode = decodeAsHeader(8193, 1);
      expect(await validateImageUpload(fileOf(fixtureBytes("upload-8193x1.png"), "wide.png", "image/png"), decode)).toEqual({
        ok: false,
        message: "This image is 8193 × 1 pixels. The maximum is 8192 pixels on each side.",
      });
      expect(decode).not.toHaveBeenCalled();
    });

    it("a decoded size over the limit is refused too (EXIF-rotated or a lying header)", async () => {
      expect(await validateImageUpload(fileOf(fixtureBytes("upload-40x30.png"), "a.png"), decodeAsHeader(9000, 30))).toEqual({
        ok: false,
        message: IMAGE_UPLOAD_MESSAGES.dimensions(9000, 30),
      });
    });

    it("a zero side in the header or the decode is a damaged image", async () => {
      const zeroWidth = fixtureBytes("upload-40x30.png").slice();
      zeroWidth.set([0, 0, 0, 0], 16);
      expect(await validateImageUpload(fileOf(zeroWidth, "a.png"), decodeAsHeader(40, 30))).toEqual({ ok: false, message: IMAGE_UPLOAD_MESSAGES.damaged });
      expect(await validateImageUpload(fileOf(fixtureBytes("upload-40x30.png"), "a.png"), decodeAsHeader(0, 30))).toEqual({ ok: false, message: IMAGE_UPLOAD_MESSAGES.damaged });
    });
  });

  it("a correct structure is not enough: a decode failure is a damaged image", async () => {
    const decode: DecodeImage = vi.fn(async () => {
      throw new DOMException("The source image could not be decoded.", "InvalidStateError");
    });
    expect(await validateImageUpload(fileOf(fixtureBytes("upload-40x30.png"), "a.png", "image/png"), decode)).toEqual({ ok: false, message: IMAGE_UPLOAD_MESSAGES.damaged });
    expect(decode).toHaveBeenCalledOnce();
  });

  it("a cut-off file is damaged without decoding (Firefox and WebKit would decode it partly blank)", async () => {
    const decode = decodeAsHeader(40, 30);
    expect(await validateImageUpload(fileOf(fixtureBytes("upload-truncated.png"), "cut.png", "image/png"), decode)).toEqual({ ok: false, message: IMAGE_UPLOAD_MESSAGES.damaged });
    expect(decode).not.toHaveBeenCalled();
  });

  it("a broken header structure is damaged without decoding", async () => {
    const decode = decodeAsHeader(1, 1);
    const brokenJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x40, 0x00]);
    expect(await validateImageUpload(fileOf(brokenJpeg, "a.jpg", "image/jpeg"), decode)).toEqual({ ok: false, message: IMAGE_UPLOAD_MESSAGES.damaged });
    expect(decode).not.toHaveBeenCalled();
  });

  it("a read failure is reported, not thrown", async () => {
    const file = { name: "a.png", type: "image/png", size: 10, arrayBuffer: async () => Promise.reject(new DOMException("gone", "NotReadableError")) };
    expect(await validateImageUpload(file, decodeAsHeader(1, 1))).toEqual({ ok: false, message: IMAGE_UPLOAD_MESSAGES.unreadable });
  });

  it("bytesToBase64 matches Node's encoder across chunk boundaries", () => {
    const bytes = new Uint8Array(0x8000 * 3 + 7).map((_, index) => (index * 31) % 256);
    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
    expect(bytesToBase64(new Uint8Array())).toBe("");
  });
});
