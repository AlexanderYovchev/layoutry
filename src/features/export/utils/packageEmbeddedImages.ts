import type { ExportAssetFile } from "@/features/export/types/exportIr";
import { RASTER_MEDIA_TYPES, sniffRasterImage, type RasterImageFormat } from "@/lib/sniffRasterImage";

/** The folder a "separate" export puts packaged images in (BC-07.3). */
export const EXPORT_ASSET_FOLDER = "assets";

const EXTENSIONS: Record<RasterImageFormat, string> = { png: "png", jpeg: "jpg", gif: "gif", webp: "webp" };

/** Declared types an upload produces (and their common aliases): these are the data URLs packaging handles. */
const PACKAGEABLE_DECLARED_TYPES: ReadonlySet<string> = new Set(["image/png", "image/apng", "image/jpeg", "image/jpg", "image/pjpeg", "image/gif", "image/webp"]);

/**
 * The most decoded bytes one embedded image may have. A project file holds
 * at most 16 Mi characters, so a real data URL decodes to under 12 MiB;
 * anything claiming more is refused before it is decoded.
 */
export const MAX_PACKAGED_IMAGE_BYTES = 16 * 1024 * 1024;
const MAX_BASE64_LENGTH = Math.ceil(MAX_PACKAGED_IMAGE_BYTES / 3) * 4;
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

export type PackagedImageResult =
  /** Written as a file; reference it by `path`. */
  | { kind: "packaged"; path: string; mismatch?: { declared: string; actual: string } }
  /** Not an uploaded-style raster data URL (SVG, AVIF, BMP, a non-base64 URL…): exported as before, embedded. */
  | { kind: "not-packageable" }
  /** Looked like an embedded raster image but isn't a valid one: stays embedded, with a warning. */
  | { kind: "rejected"; reason: string };

/** Splits a `data:` URL into its declared media type and base64 payload, or says why it can't be packaged. */
function parseRasterDataUrl(url: string): { declared: string; payload: string } | { reason: string } | null {
  const comma = url.indexOf(",");
  if (comma < 0 || !/^data:/i.test(url)) return null;
  const header = url.slice(5, comma).toLowerCase().split(";").map((part) => part.trim());
  const declared = header[0];
  if (!PACKAGEABLE_DECLARED_TYPES.has(declared)) return null;
  if (!header.slice(1).includes("base64")) return null;
  const payload = url.slice(comma + 1);
  if (payload.length > MAX_BASE64_LENGTH) return { reason: "it is larger than an image a project can hold" };
  if (payload.length % 4 !== 0 || !BASE64.test(payload)) return { reason: "its base64 data is malformed" };
  return { declared, payload };
}

function binaryToBytes(binary: string): Uint8Array {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Turns embedded images into export files (BC-07.3), for one export run.
 * Export-only: the authored document is never changed.
 *
 * For each `data:image/(png|jpeg|gif|webp);base64,…` source it is given:
 * 1. strict parsing: base64 alphabet and padding only, size bounded before
 *    decoding;
 * 2. decoding, once per distinct URL;
 * 3. the bytes' own signature and structure (sniffRasterImage, the same
 *    check uploads pass), which decide the format and the extension,
 *    whatever the URL declares;
 * 4. deduplication by the exact decoded bytes, so identical images become
 *    one file wherever and however often they appear;
 * 5. a name chosen here, never from user data: assets/image-001.png,
 *    image-002.jpg… numbered in the order the export meets each distinct
 *    image, so the same document always gives the same names.
 *
 * A source that declares a supported raster type but fails 1–3 is not
 * packaged ("rejected"): the caller keeps it embedded, exactly as the
 * Canvas shows it, and reports a warning. Nothing is ever silently dropped.
 */
export function createEmbeddedImagePackager() {
  const byUrl = new Map<string, PackagedImageResult>();
  const byBytes = new Map<string, ExportAssetFile>();
  const files: ExportAssetFile[] = [];

  function packageUrl(url: string): PackagedImageResult {
    const cached = byUrl.get(url);
    if (cached) {
      if (cached.kind === "packaged") {
        const file = files.find((candidate) => candidate.path === cached.path);
        if (file) file.references += 1;
      }
      return cached;
    }
    const result = packageNew(url);
    byUrl.set(url, result);
    return result;
  }

  function packageNew(url: string): PackagedImageResult {
    const parsed = parseRasterDataUrl(url);
    if (parsed === null) return { kind: "not-packageable" };
    if ("reason" in parsed) return { kind: "rejected", reason: parsed.reason };
    let binary: string;
    try {
      binary = atob(parsed.payload);
    } catch {
      return { kind: "rejected", reason: "its base64 data is malformed" };
    }
    const existing = byBytes.get(binary);
    if (existing) {
      existing.references += 1;
      return withMismatch(existing.path, parsed.declared, existing.mediaType);
    }
    const bytes = binaryToBytes(binary);
    const sniffed = sniffRasterImage(bytes);
    if (!sniffed.ok) return { kind: "rejected", reason: sniffed.reason === "malformed" ? "its image data is damaged or incomplete" : "its data is not a PNG, JPEG, GIF or WebP image" };
    const mediaType = RASTER_MEDIA_TYPES[sniffed.format];
    const path = `${EXPORT_ASSET_FOLDER}/image-${String(files.length + 1).padStart(3, "0")}.${EXTENSIONS[sniffed.format]}`;
    const file: ExportAssetFile = { path, bytes, mediaType, references: 1 };
    files.push(file);
    byBytes.set(binary, file);
    return withMismatch(path, parsed.declared, mediaType);
  }

  return { packageUrl, files };
}

const DECLARED_ALIASES: Record<string, string> = { "image/jpg": "image/jpeg", "image/pjpeg": "image/jpeg", "image/apng": "image/png" };

function withMismatch(path: string, declared: string, actual: string): PackagedImageResult {
  const normalized = DECLARED_ALIASES[declared] ?? declared;
  return normalized === actual ? { kind: "packaged", path } : { kind: "packaged", path, mismatch: { declared, actual } };
}

export type EmbeddedImagePackager = ReturnType<typeof createEmbeddedImagePackager>;
