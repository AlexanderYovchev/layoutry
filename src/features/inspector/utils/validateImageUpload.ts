import { verifyPngImageData } from "@/features/inspector/utils/verifyPngImageData";
import { RASTER_MEDIA_TYPES, sniffRasterImage, type RasterImageFormat } from "@/lib/sniffRasterImage";

/**
 * Upload limits (BC-07.2, approved by the product owner). "MB" means
 * 1024 × 1024 bytes everywhere: in this check, in every message and in the
 * size the Inspector shows for an uploaded image.
 */
export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_UPLOAD_SIDE = 8192;

/** The picker's filter. A usability hint only — the bytes decide. */
export const IMAGE_UPLOAD_ACCEPT = ".png,.jpg,.jpeg,.gif,.webp,image/png,image/jpeg,image/gif,image/webp";

const ALLOWED_EXTENSIONS = new Set(["png", "apng", "jpg", "jpeg", "jpe", "jfif", "gif", "webp"]);
const ALLOWED_REPORTED_TYPES = new Set(["image/png", "image/apng", "image/jpeg", "image/pjpeg", "image/jpg", "image/gif", "image/webp"]);

export const IMAGE_UPLOAD_MESSAGES = {
  unsupported: "This file isn't a supported image. Use a PNG, JPEG, GIF or WebP file.",
  svg: "SVG images can't be uploaded. Use a PNG, JPEG, GIF or WebP file.",
  empty: "This file is empty. Choose an image file.",
  tooLarge: "Image is too large. Maximum file size is 5 MB.",
  unreadable: "Layoutry couldn't read this file. Try again, or choose another image.",
  damaged: "This image couldn't be opened. The file may be damaged.",
  dimensions: (width: number, height: number) =>
    `This image is ${width} × ${height} pixels. The maximum is ${MAX_IMAGE_UPLOAD_SIDE} pixels on each side.`,
} as const;

/** The parts of a File the validator uses — a real File satisfies it. */
export interface ImageUploadFile {
  name: string;
  type: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

export type DecodeImage = (bytes: Uint8Array, mediaType: string) => Promise<{ width: number; height: number }>;

export interface ValidatedImageUpload {
  dataUrl: string;
  format: RasterImageFormat;
  mediaType: string;
  fileName: string;
  byteLength: number;
  width: number;
  height: number;
}

export type ImageUploadValidation = { ok: true; image: ValidatedImageUpload } | { ok: false; message: string };

function extensionOf(name: string): string | undefined {
  const dot = name.lastIndexOf(".");
  return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : undefined;
}

const validSide = (side: number) => Number.isInteger(side) && side > 0;

/**
 * Base64 of the exact bytes, in chunks so no call gets millions of
 * arguments. The original file is kept: nothing is re-encoded, resized or
 * converted, so GIF animation, transparency and colour data survive.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(binary);
}

/**
 * Decodes with the browser's own image decoders, twice (BC-07.4):
 * 1. createImageBitmap, off the DOM; the bitmap is released at once and only
 *    its size is kept;
 * 2. an <img> decode of the same bytes. WebKit's createImageBitmap accepts
 *    some damaged PNG and GIF data that its <img> then can't show, and the
 *    <img> path is exactly what the Canvas, Preview and exported page use.
 * The object URL for step 2 exists only for the decode and is revoked in
 * every case. Either failure rejects the file.
 */
export const decodeImageWithBrowser: DecodeImage = async (bytes, mediaType) => {
  const blob = new Blob([bytes as BlobPart], { type: mediaType });
  const bitmap = await createImageBitmap(blob);
  let size: { width: number; height: number };
  try {
    size = { width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
  if (typeof Image === "function" && typeof URL.createObjectURL === "function") {
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (image.naturalWidth === 0 || image.naturalHeight === 0) throw new Error("image decoded empty");
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return size;
};

/**
 * Checks an uploaded file and, if it is a supported image, returns its
 * persistent data URL (BC-07.2). The cheapest checks run first, so a bad
 * file is refused before any expensive work:
 * 1. name and reported type, when the browser gives them: anything outside
 *    the raster allow-list (an .svg, a .html) is refused, but a matching
 *    name proves nothing;
 * 2. size, before the file is read;
 * 3. the bytes' own signature and header structure (sniffRasterImage), which
 *    decide the format and the data URL's media type;
 * 4. the header's pixel size, before decoding (no oversized decode);
 * 5. for PNG, its compressed image data must really inflate (BC-07.4,
 *    verifyPngImageData); then a real decode by the browser, which rejects
 *    damaged data, and its size;
 * 6. base64 of the original bytes.
 * Never throws; every failure is a user-facing message.
 */
export async function validateImageUpload(file: ImageUploadFile, decode: DecodeImage = decodeImageWithBrowser): Promise<ImageUploadValidation> {
  const extension = extensionOf(file.name);
  const reportedType = file.type.toLowerCase();
  if (extension === "svg" || extension === "svgz" || reportedType === "image/svg+xml") return { ok: false, message: IMAGE_UPLOAD_MESSAGES.svg };
  if ((extension !== undefined && !ALLOWED_EXTENSIONS.has(extension)) || (reportedType !== "" && !ALLOWED_REPORTED_TYPES.has(reportedType)))
    return { ok: false, message: IMAGE_UPLOAD_MESSAGES.unsupported };
  if (file.size === 0) return { ok: false, message: IMAGE_UPLOAD_MESSAGES.empty };
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) return { ok: false, message: IMAGE_UPLOAD_MESSAGES.tooLarge };

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return { ok: false, message: IMAGE_UPLOAD_MESSAGES.unreadable };
  }
  // The size a File reports can differ from what is read (a file changed on disk).
  if (bytes.length === 0) return { ok: false, message: IMAGE_UPLOAD_MESSAGES.empty };
  if (bytes.length > MAX_IMAGE_UPLOAD_BYTES) return { ok: false, message: IMAGE_UPLOAD_MESSAGES.tooLarge };

  const sniffed = sniffRasterImage(bytes);
  if (!sniffed.ok) {
    if (sniffed.reason === "svg") return { ok: false, message: IMAGE_UPLOAD_MESSAGES.svg };
    return { ok: false, message: sniffed.reason === "malformed" ? IMAGE_UPLOAD_MESSAGES.damaged : IMAGE_UPLOAD_MESSAGES.unsupported };
  }
  if (!validSide(sniffed.width) || !validSide(sniffed.height)) return { ok: false, message: IMAGE_UPLOAD_MESSAGES.damaged };
  if (sniffed.width > MAX_IMAGE_UPLOAD_SIDE || sniffed.height > MAX_IMAGE_UPLOAD_SIDE)
    return { ok: false, message: IMAGE_UPLOAD_MESSAGES.dimensions(sniffed.width, sniffed.height) };

  if (sniffed.format === "png" && (await verifyPngImageData(bytes)) === false) return { ok: false, message: IMAGE_UPLOAD_MESSAGES.damaged };

  let decoded: { width: number; height: number };
  try {
    decoded = await decode(bytes, sniffed.mediaType);
  } catch {
    return { ok: false, message: IMAGE_UPLOAD_MESSAGES.damaged };
  }
  // The decoded size can be the header's swapped (JPEG EXIF orientation), so
  // it is checked on its own rather than compared with the header.
  if (!validSide(decoded.width) || !validSide(decoded.height)) return { ok: false, message: IMAGE_UPLOAD_MESSAGES.damaged };
  if (decoded.width > MAX_IMAGE_UPLOAD_SIDE || decoded.height > MAX_IMAGE_UPLOAD_SIDE)
    return { ok: false, message: IMAGE_UPLOAD_MESSAGES.dimensions(decoded.width, decoded.height) };

  return {
    ok: true,
    image: {
      dataUrl: `data:${RASTER_MEDIA_TYPES[sniffed.format]};base64,${bytesToBase64(bytes)}`,
      format: sniffed.format,
      mediaType: sniffed.mediaType,
      fileName: file.name,
      byteLength: bytes.length,
      width: decoded.width,
      height: decoded.height,
    },
  };
}
