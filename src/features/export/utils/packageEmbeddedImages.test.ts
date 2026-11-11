import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createEmbeddedImagePackager, MAX_PACKAGED_IMAGE_BYTES } from "./packageEmbeddedImages";

const fixture = (name: string) => readFileSync(path.join(process.cwd(), "test", "fixtures", "images", name));
const dataUrl = (type: string, bytes: Buffer | Uint8Array) => `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
const PNG = fixture("upload-40x30.png");
const JPEG = fixture("upload-32x24.jpg");
const GIF = fixture("upload-20x10-animated.gif");
const WEBP = fixture("upload-24x16.webp");

describe("createEmbeddedImagePackager (BC-07.3)", () => {
  it.each([
    ["image/png", PNG, "assets/image-001.png", "image/png"],
    ["image/jpeg", JPEG, "assets/image-001.jpg", "image/jpeg"],
    ["image/gif", GIF, "assets/image-001.gif", "image/gif"],
    ["image/webp", WEBP, "assets/image-001.webp", "image/webp"],
  ])("packages a %s data URL as its exact bytes", (type, bytes, expectedPath, mediaType) => {
    const packager = createEmbeddedImagePackager();
    expect(packager.packageUrl(dataUrl(type, bytes))).toEqual({ kind: "packaged", path: expectedPath });
    expect(packager.files).toHaveLength(1);
    expect(packager.files[0]).toMatchObject({ path: expectedPath, mediaType, references: 1 });
    expect(Buffer.from(packager.files[0].bytes).equals(bytes)).toBe(true);
  });

  it("numbers distinct images in the order it meets them, the same way every run", () => {
    const run = () => {
      const packager = createEmbeddedImagePackager();
      const paths = [dataUrl("image/webp", WEBP), dataUrl("image/png", PNG), dataUrl("image/jpeg", JPEG), dataUrl("image/gif", GIF)].map((url) => packager.packageUrl(url));
      return { paths, files: packager.files.map((file) => file.path) };
    };
    const first = run();
    expect(first.files).toEqual(["assets/image-001.webp", "assets/image-002.png", "assets/image-003.jpg", "assets/image-004.gif"]);
    expect(run()).toEqual(first);
  });

  it("identical bytes become one file however they are written; different bytes never share one", () => {
    const packager = createEmbeddedImagePackager();
    const a = packager.packageUrl(dataUrl("image/png", PNG));
    const sameUrlAgain = packager.packageUrl(dataUrl("image/png", PNG));
    // Same bytes, other declared spellings and parameters.
    const alias = packager.packageUrl(`data:IMAGE/PNG;charset=binary;BASE64,${PNG.toString("base64")}`);
    const otherBytes = Buffer.from(PNG);
    otherBytes[otherBytes.length - 1] ^= 0xff; // a different IEND CRC: other bytes, still a complete PNG
    const different = packager.packageUrl(dataUrl("image/png", otherBytes));
    expect([a, sameUrlAgain, alias]).toEqual([
      { kind: "packaged", path: "assets/image-001.png" },
      { kind: "packaged", path: "assets/image-001.png" },
      { kind: "packaged", path: "assets/image-001.png" },
    ]);
    expect(different).toEqual({ kind: "packaged", path: "assets/image-002.png" });
    expect(packager.files.map((file) => [file.path, file.references])).toEqual([
      ["assets/image-001.png", 3],
      ["assets/image-002.png", 1],
    ]);
  });

  it("the bytes decide the format: a JPEG declared as PNG is packaged as .jpg and reported", () => {
    const packager = createEmbeddedImagePackager();
    expect(packager.packageUrl(dataUrl("image/png", JPEG))).toEqual({
      kind: "packaged",
      path: "assets/image-001.jpg",
      mismatch: { declared: "image/png", actual: "image/jpeg" },
    });
    expect(packager.files[0].mediaType).toBe("image/jpeg");
  });

  it("common aliases (image/jpg) are not a mismatch", () => {
    expect(createEmbeddedImagePackager().packageUrl(dataUrl("image/jpg", JPEG))).toEqual({ kind: "packaged", path: "assets/image-001.jpg" });
  });

  describe("untrusted data that can't become a file", () => {
    it.each([
      ["HTML declared as PNG", dataUrl("image/png", Buffer.from("<!doctype html><script>alert(1)</script>")), "its data is not a PNG, JPEG, GIF or WebP image"],
      ["text declared as JPEG", dataUrl("image/jpeg", Buffer.from("plain text")), "its data is not a PNG, JPEG, GIF or WebP image"],
      ["SVG declared as PNG", dataUrl("image/png", fixture("svg-image.svg")), "its data is not a PNG, JPEG, GIF or WebP image"],
      ["a cut-off PNG", dataUrl("image/png", fixture("upload-truncated.png")), "its image data is damaged or incomplete"],
      ["a cut-off GIF", dataUrl("image/gif", GIF.subarray(0, 120)), "its image data is damaged or incomplete"],
      ["invalid base64 characters", "data:image/png;base64,iVBOR*w0KGgo=", "its base64 data is malformed"],
      ["base64 with bad length", "data:image/png;base64,iVBORw0KGgoAA", "its base64 data is malformed"],
      ["whitespace inside base64", "data:image/png;base64,iVBO Rw0K", "its base64 data is malformed"],
    ])("%s is rejected (kept embedded by the caller) and never becomes a file", (_name, url, reason) => {
      const packager = createEmbeddedImagePackager();
      expect(packager.packageUrl(url)).toEqual({ kind: "rejected", reason });
      expect(packager.files).toEqual([]);
    });

    it("a payload claiming more than a project could hold is refused before decoding", () => {
      const huge = "data:image/png;base64," + "A".repeat(Math.ceil(MAX_PACKAGED_IMAGE_BYTES / 3) * 4 + 4);
      expect(createEmbeddedImagePackager().packageUrl(huge)).toEqual({ kind: "rejected", reason: "it is larger than an image a project can hold" });
    });
  });

  it.each([
    ["an SVG data URL (the default placeholder)", "data:image/svg+xml;utf8,%3Csvg%2F%3E"],
    ["a base64 SVG", `data:image/svg+xml;base64,${fixture("svg-image.svg").toString("base64")}`],
    ["an AVIF/BMP data URL", "data:image/bmp;base64,Qk0="],
    ["a non-base64 PNG data URL", "data:image/png,%89PNG"],
    ["not a data URL", "https://example.com/a.png"],
  ])("%s is not packageable: it is exported as before", (_name, url) => {
    const packager = createEmbeddedImagePackager();
    expect(packager.packageUrl(url)).toEqual({ kind: "not-packageable" });
    expect(packager.files).toEqual([]);
  });
});
