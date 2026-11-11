/** The raster formats Layoutry accepts as uploads (BC-07.2). */
export type RasterImageFormat = "png" | "jpeg" | "gif" | "webp";

export const RASTER_MEDIA_TYPES: Record<RasterImageFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

export type RasterSniffResult =
  | { ok: true; format: RasterImageFormat; mediaType: string; width: number; height: number }
  /** "svg": SVG or other XML/HTML markup; "unsupported": no known signature; "malformed": a known signature whose header structure is broken. */
  | { ok: false; reason: "svg" | "unsupported" | "malformed" };

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + ((b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]);
const u32le = (b: Uint8Array, i: number) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16)) + ((b[i + 3] << 24) >>> 0);

function ascii(b: Uint8Array, start: number, text: string): boolean {
  if (start + text.length > b.length) return false;
  for (let i = 0; i < text.length; i += 1) if (b[start + i] !== text.charCodeAt(i)) return false;
  return true;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function sniffPng(b: Uint8Array): RasterSniffResult | null {
  if (!PNG_SIGNATURE.every((byte, i) => b[i] === byte)) return null;
  // The first chunk must be a 13-byte IHDR: width and height, then 5 bytes.
  if (b.length < 33 || u32be(b, 8) !== 13 || !ascii(b, 12, "IHDR")) return { ok: false, reason: "malformed" };
  // Every chunk must fit in the file, with image data before the IEND that
  // closes it. A cut-off PNG fails here: Firefox and WebKit "decode" a
  // truncated PNG as a partly blank image instead of rejecting it.
  let offset = 8;
  let sawImageData = false;
  while (offset + 12 <= b.length) {
    const end = offset + 12 + u32be(b, offset);
    if (end > b.length) return { ok: false, reason: "malformed" };
    if (ascii(b, offset + 4, "IDAT")) sawImageData = true;
    if (ascii(b, offset + 4, "IEND")) {
      if (!sawImageData) return { ok: false, reason: "malformed" };
      return { ok: true, format: "png", mediaType: RASTER_MEDIA_TYPES.png, width: u32be(b, 16), height: u32be(b, 20) };
    }
    offset = end;
  }
  return { ok: false, reason: "malformed" };
}

function sniffGif(b: Uint8Array): RasterSniffResult | null {
  if (!ascii(b, 0, "GIF87a") && !ascii(b, 0, "GIF89a")) return null;
  // Header (6) + logical screen descriptor (7) + at least the trailer byte.
  if (b.length < 14) return { ok: false, reason: "malformed" };
  // A complete GIF ends with its trailer (0x3B), possibly followed by zero padding.
  let last = b.length - 1;
  while (last > 13 && b[last] === 0x00) last -= 1;
  if (b[last] !== 0x3b) return { ok: false, reason: "malformed" };
  return { ok: true, format: "gif", mediaType: RASTER_MEDIA_TYPES.gif, width: u16le(b, 6), height: u16le(b, 8) };
}

function sniffWebp(b: Uint8Array): RasterSniffResult | null {
  if (!ascii(b, 0, "RIFF") || !ascii(b, 8, "WEBP")) return null;
  // The RIFF size covers everything after its own 8-byte header; a file
  // shorter than it claims is truncated.
  if (b.length < 30 || u32le(b, 4) + 8 > b.length) return { ok: false, reason: "malformed" };
  const result = (width: number, height: number): RasterSniffResult => ({ ok: true, format: "webp", mediaType: RASTER_MEDIA_TYPES.webp, width, height });
  if (ascii(b, 12, "VP8X")) return result(u24le(b, 24) + 1, u24le(b, 27) + 1);
  if (ascii(b, 12, "VP8L")) {
    if (b[20] !== 0x2f) return { ok: false, reason: "malformed" };
    const bits = u32le(b, 21);
    return result((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
  }
  if (ascii(b, 12, "VP8 ")) {
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return { ok: false, reason: "malformed" };
    return result(u16le(b, 26) & 0x3fff, u16le(b, 28) & 0x3fff);
  }
  return { ok: false, reason: "malformed" };
}

// Start-of-frame markers carry the image size. C4 (DHT), C8 (JPG) and CC
// (DAC) share the range but are not frames.
const JPEG_SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

/**
 * Walks JPEG marker segments from the start of the file through the frame
 * header (the size) to the first scan (SOS). Every segment's length is
 * bounds-checked; a scan or the end of the image before a frame header
 * means the file is malformed, and so does a file with no end-of-image
 * marker after its scan data (cut off). An EXIF thumbnail's own end marker
 * sits in an APP segment before the scan, so it can't satisfy that check.
 * Each step moves forward, so the walk always ends.
 */
function sniffJpeg(b: Uint8Array): RasterSniffResult | null {
  if (b[0] !== 0xff || b[1] !== 0xd8 || b[2] !== 0xff) return null;
  const malformed: RasterSniffResult = { ok: false, reason: "malformed" };
  let frame: RasterSniffResult | undefined;
  let offset = 2;
  while (offset < b.length) {
    if (b[offset] !== 0xff) return malformed;
    while (offset < b.length && b[offset] === 0xff) offset += 1; // fill bytes
    if (offset >= b.length) return malformed;
    const marker = b[offset];
    offset += 1;
    if (marker === 0x00) return malformed;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue; // no length
    if (marker === 0xd9) return malformed; // end of image before any scan
    if (offset + 2 > b.length) return malformed;
    const length = u16be(b, offset);
    if (length < 2 || offset + length > b.length) return malformed;
    if (marker === 0xda) {
      if (!frame) return malformed; // a scan before any frame header
      for (let i = b.length - 2; i >= offset + length; i -= 1) if (b[i] === 0xff && b[i + 1] === 0xd9) return frame;
      return malformed;
    }
    if (JPEG_SOF_MARKERS.has(marker) && !frame) {
      if (length < 7) return malformed;
      frame = { ok: true, format: "jpeg", mediaType: RASTER_MEDIA_TYPES.jpeg, width: u16be(b, offset + 5), height: u16be(b, offset + 3) };
    }
    offset += length;
  }
  return malformed;
}

/** SVG, XML or HTML text: optional UTF-8 BOM and whitespace, then "<". */
function looksLikeMarkup(b: Uint8Array): boolean {
  let i = b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf ? 3 : 0;
  while (i < b.length && i < 1024 && (b[i] === 0x20 || b[i] === 0x09 || b[i] === 0x0a || b[i] === 0x0d)) i += 1;
  return b[i] === 0x3c;
}

/**
 * Identifies an uploaded file by its bytes, never its name or reported type
 * (BC-07.2), and reads the pixel size from the format header so oversized
 * images are refused before anything decodes them. A recognized header is
 * not proof of a valid image: validateImageUpload still decodes it.
 */
export function sniffRasterImage(bytes: Uint8Array): RasterSniffResult {
  const sniffed = sniffPng(bytes) ?? sniffJpeg(bytes) ?? sniffGif(bytes) ?? sniffWebp(bytes);
  if (sniffed) return sniffed;
  return { ok: false, reason: looksLikeMarkup(bytes) ? "svg" : "unsupported" };
}
