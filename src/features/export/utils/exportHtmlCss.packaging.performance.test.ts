import { crc32, deflateSync } from "node:zlib";
import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import type { EditorElementNode } from "@/features/editor/types/document";
import { documentFitsProjectFile } from "@/features/project/rules/projectSaveLimit";
import { exportHtmlCss } from "./exportHtmlCss";
import { zipExportPackage } from "./zipExportPackage";

/** A valid uncompressed RGBA PNG of about width × height × 4 bytes (incompressible-ish noise). */
function largePng(width: number, height: number, seed: number): Buffer {
  const u32 = (value: number) => {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt32BE(value >>> 0);
    return buffer;
  };
  const chunk = (type: string, data: Buffer) => Buffer.concat([u32(data.length), Buffer.from(type), data, u32(crc32(Buffer.concat([Buffer.from(type), data])))]);
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let i = 0; i < rows.length; i += 1) rows[i] = (i * 7 + seed * 31) & 0xff;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", header), chunk("IDAT", deflateSync(rows, { level: 0 })), chunk("IEND", Buffer.alloc(0))]);
}

describe("packaging cost near the project limit (BC-07.3 measurement)", () => {
  it("two ~4.8 MB uploads plus 20 duplicate references: two files, bounded time, bytes intact", () => {
    const first = largePng(1100, 1100, 1);
    const second = largePng(1100, 1100, 2);
    const firstUrl = `data:image/png;base64,${first.toString("base64")}`;
    const secondUrl = `data:image/png;base64,${second.toString("base64")}`;
    // Duplicates share the same string in memory (as duplicate/paste do), so the in-memory document stays realistic.
    const children: EditorElementNode[] = [
      { id: "img-a", tag: "img", src: firstUrl, displayName: "A" },
      { id: "img-b", tag: "img", src: secondUrl, displayName: "B" },
      ...Array.from({ length: 20 }, (_, index): EditorElementNode => ({ id: `img-copy-${index}`, tag: "img", src: index % 2 ? firstUrl : secondUrl })),
    ];
    const document: EditorElementNode = { id: "page-root", tag: "page", children };
    // A save-limit-sized project of two images (the duplicates alone would not save; packaging still copes).
    expect(documentFitsProjectFile({ id: "page-root", tag: "page", children: children.slice(0, 2) })).toBe(true);

    const exportStart = performance.now();
    const result = exportHtmlCss(document, { mode: "separate", title: "Big" });
    const exportMs = performance.now() - exportStart;
    const zipStart = performance.now();
    const zip = zipExportPackage(result.files, result.assetFiles);
    const zipMs = performance.now() - zipStart;
    const again = exportHtmlCss(document, { mode: "separate", title: "Big" });

    expect(result.assetFiles.map((file) => [file.path, file.references])).toEqual([
      ["assets/image-001.png", 11],
      ["assets/image-002.png", 11],
    ]);
    const entries = unzipSync(zip);
    expect(Buffer.from(entries["assets/image-001.png"]).equals(first)).toBe(true);
    expect(Buffer.from(entries["assets/image-002.png"]).equals(second)).toBe(true);
    expect(again.files).toEqual(result.files);
    const embeddedBytes = children.reduce((sum, child) => sum + (child.src?.length ?? 0), 0);
    const htmlBytes = result.files.reduce((sum, file) => sum + file.content.length, 0);
    process.stdout.write(
      `\n[BC-07.3 perf] export ${exportMs.toFixed(0)} ms, zip ${zipMs.toFixed(0)} ms; ` +
        `images ${(first.length / 1048576).toFixed(2)} + ${(second.length / 1048576).toFixed(2)} MB; ` +
        `package ${(zip.length / 1048576).toFixed(2)} MB; text files ${(htmlBytes / 1024).toFixed(1)} KB; ` +
        `inline base64 for all 22 references would be ${(embeddedBytes / 1048576).toFixed(1)} MB\n`,
    );
    // Generous bounds: this is a measurement, not a benchmark gate.
    expect(exportMs).toBeLessThan(10_000);
    expect(zipMs).toBeLessThan(10_000);
    expect(zip.length).toBeLessThan(first.length + second.length + 64 * 1024);
  }, 60_000);
});
