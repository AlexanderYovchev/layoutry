import { readFileSync } from "node:fs";
import path from "node:path";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import type { ExportAssetFile } from "@/features/export/types/exportIr";
import type { ExportFile } from "@/features/export/types/exportResult";
import { exportPackageFileName, ExportPackageError, zipExportPackage } from "./zipExportPackage";

const png = new Uint8Array(readFileSync(path.join(process.cwd(), "test", "fixtures", "images", "upload-40x30.png")));
const text = (filePath: string, content: string): ExportFile => ({ path: filePath, content, mediaType: "text/plain" });
const asset = (filePath: string, bytes = png): ExportAssetFile => ({ path: filePath, bytes, mediaType: "image/png", references: 1 });
const files = [text("index.html", "<!DOCTYPE html><p>Ünïcödé</p>"), text("styles.css", "p{}"), text("script.js", "1;")];

describe("zipExportPackage (BC-07.3)", () => {
  it("holds the text files at the root and the images in assets/, byte for byte", () => {
    const zip = zipExportPackage(files, [asset("assets/image-001.png")]);
    const entries = unzipSync(zip);
    expect(Object.keys(entries).sort()).toEqual(["assets/image-001.png", "index.html", "script.js", "styles.css"]);
    expect(strFromU8(entries["index.html"])).toBe("<!DOCTYPE html><p>Ünïcödé</p>");
    expect(Buffer.from(entries["assets/image-001.png"]).equals(Buffer.from(png))).toBe(true);
  });

  it("the same files always zip to the same bytes", () => {
    expect(zipExportPackage(files, [asset("assets/image-001.png")])).toEqual(zipExportPackage(files, [asset("assets/image-001.png")]));
  });

  it.each([
    ["../evil.html"],
    ["assets/../index.html"],
    ["assets/image-001.exe"],
    ["assets/photo.png"],
    ["/etc/passwd"],
    ["C:\\Windows\\x.png"],
    ["assets\\image-001.png"],
  ])("refuses any path the engine wouldn't produce: %s", (badPath) => {
    expect(() => zipExportPackage([text("index.html", "x")], [asset(badPath)])).toThrow(ExportPackageError);
  });

  it("refuses duplicates and a package without index.html", () => {
    expect(() => zipExportPackage([text("index.html", "x")], [asset("assets/image-001.png"), asset("assets/image-001.png")])).toThrow(/twice/);
    expect(() => zipExportPackage([text("styles.css", "x")], [])).toThrow(/needs index\.html/);
  });

  it("names the download after the project, with only file-name-safe characters", () => {
    expect(exportPackageFileName("My Site")).toBe("My Site.zip");
    expect(exportPackageFileName('a/b\\c:d*e?"f<g>h|')).toBe("a-b-c-d-e--f-g-h-.zip");
    expect(exportPackageFileName("  ..  ")).toBe("website.zip");
    expect(exportPackageFileName("")).toBe("website.zip");
    expect(exportPackageFileName("x".repeat(300))).toBe(`${"x".repeat(100)}.zip`);
  });
});
