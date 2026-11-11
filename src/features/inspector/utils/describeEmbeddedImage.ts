import type { RasterImageFormat } from "@/features/inspector/utils/sniffRasterImage";

const EMBEDDED_RASTER = /^data:image\/(png|jpeg|gif|webp);base64,/;
const FORMAT_LABELS: Record<RasterImageFormat, string> = { png: "PNG", jpeg: "JPEG", gif: "GIF", webp: "WebP" };
const RASTER_FORMATS: readonly RasterImageFormat[] = ["png", "jpeg", "gif", "webp"];

export interface EmbeddedImageInfo {
  format: RasterImageFormat;
  label: string;
  /** Size of the decoded bytes, from the base64 length. */
  byteLength: number;
}

/**
 * Recognizes an image embedded the way an upload stores it (BC-07.2): a
 * base64 PNG/JPEG/GIF/WebP data URL in `src`. Only the prefix and the
 * length are read, so this is cheap even for a multi-megabyte source.
 * Anything else, including the default SVG placeholder, is a URL.
 */
export function describeEmbeddedImage(src: string | undefined): EmbeddedImageInfo | undefined {
  if (!src) return undefined;
  const match = EMBEDDED_RASTER.exec(src.slice(0, 32));
  if (!match) return undefined;
  const format = RASTER_FORMATS.find((candidate) => candidate === match[1]);
  if (!format) return undefined;
  const base64Length = src.length - match[0].length;
  const padding = src.endsWith("==") ? 2 : src.endsWith("=") ? 1 : 0;
  return { format, label: FORMAT_LABELS[format], byteLength: Math.max(0, Math.floor((base64Length * 3) / 4) - padding) };
}

/** "184 KB", "4.8 MB" — 1024-based, like the upload limit. */
export function formatImageByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
