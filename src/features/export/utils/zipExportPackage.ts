import { zipSync, type Zippable } from "fflate";
import type { ExportAssetFile } from "@/features/export/types/exportIr";
import type { ExportFile } from "@/features/export/types/exportResult";

/** Every path a package may contain: the engine's fixed names and its numbered assets. */
const PACKAGE_PATH = /^(?:index\.html|styles\.css|script\.js|assets\/image-\d{3,6}\.(?:png|jpg|gif|webp))$/;

/** A fixed timestamp, so the same files always zip to the same bytes. ZIP times are local and start in 1980. */
const ZIP_TIME = new Date(2000, 0, 1, 0, 0, 0);

export class ExportPackageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExportPackageError";
  }
}

/**
 * The website package a browser downloads (BC-07.3): one ZIP holding the
 * "separate" export's text files at its root and the image files in
 * assets/, ready to unzip and open. Built with fflate (an established,
 * dependency-free ZIP library) from the exact files on screen.
 *
 * Text is deflated; images are stored as they are (already compressed),
 * so their bytes are copied once and never recompressed. Paths come from
 * the export engine, never the user, and are checked against the engine's
 * own naming anyway: nothing absolute, no "..", no duplicates.
 */
export function zipExportPackage(files: readonly ExportFile[], assetFiles: readonly ExportAssetFile[]): Uint8Array {
  const entries: Zippable = {};
  const encoder = new TextEncoder();
  const add = (path: string, bytes: Uint8Array, level: 0 | 6) => {
    if (!PACKAGE_PATH.test(path)) throw new ExportPackageError(`"${path}" is not a file a website package can contain.`);
    if (Object.hasOwn(entries, path)) throw new ExportPackageError(`"${path}" appears twice in the package.`);
    entries[path] = [bytes, { level, mtime: ZIP_TIME }];
  };
  for (const file of files) add(file.path, encoder.encode(file.content), 6);
  for (const asset of assetFiles) add(asset.path, asset.bytes, 0);
  if (!Object.hasOwn(entries, "index.html")) throw new ExportPackageError("A website package needs index.html.");
  return zipSync(entries);
}

/** "My Site" → "My Site.zip": a file name only, without characters Windows, macOS or Linux reject. */
export function exportPackageFileName(title: string): string {
  const base = title
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, "-")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .slice(0, 100)
    .trim();
  return `${base || "website"}.zip`;
}
