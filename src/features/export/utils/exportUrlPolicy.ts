import type { ExportAssetKind } from "@/features/export/types/exportIr";

/**
 * Where a URL is used decides what it may do (EXPORT-1.2):
 * - "link": an <a href> the visitor can navigate to.
 * - "image": <img src>, <video poster>, CSS background-image — passive images.
 * - "media": <video>/<audio> src.
 * - "frame": <iframe src> — a document that runs in the visitor's browser.
 */
export type ExportUrlContext = "link" | "image" | "media" | "frame";

export type ExportUrlCheck =
  | { ok: true; url: string; kind: ExportAssetKind | "fragment" }
  | { ok: false; reason: "unsafe" | "non-portable" | "empty"; scheme?: string };

const SAFE_SCHEMES: Record<ExportUrlContext, ReadonlySet<string>> = {
  link: new Set(["http", "https", "mailto", "tel"]),
  image: new Set(["http", "https"]),
  media: new Set(["http", "https"]),
  frame: new Set(["http", "https"]),
};

/** Schemes that are harmless but cannot work outside the editor session that produced them. */
const NON_PORTABLE_SCHEMES: ReadonlySet<string> = new Set(["blob", "file", "filesystem"]);

// Only raster/vector image data may be inlined as an image, and only
// audio/video data as media. data:text/html (and anything else) is refused
// everywhere: as a link or frame it would run a document of its own.
const DATA_IMAGE = /^data:image\/(?:png|jpeg|jpg|gif|webp|avif|bmp|x-icon|svg\+xml)[;,]/i;
const DATA_MEDIA = /^data:(?:video|audio)\/[a-z0-9.+-]+[;,]/i;

/**
 * The URL exactly as a browser's URL parser sees its scheme: ASCII tab and
 * newline are removed anywhere and leading/trailing C0 controls and spaces
 * are trimmed — the classic `java\tscript:` / ` javascript:` bypasses.
 */
function normalizeForSchemeDetection(url: string): string {
  return url.replace(/[\t\n\r]/g, "").replace(/^[\u0000- ]+|[\u0000- ]+$/g, "");
}

/**
 * Decides whether an authored URL may appear in exported markup or CSS.
 * Allowed URLs are returned exactly as authored (the browser normalizes
 * them the same way on the Canvas); printers escape them for their syntax.
 */
export function checkExportUrl(url: string, context: ExportUrlContext): ExportUrlCheck {
  const normalized = normalizeForSchemeDetection(url);
  if (normalized === "") return { ok: false, reason: "empty" };

  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(normalized)?.[1]?.toLowerCase();
  if (scheme === undefined) {
    if (normalized.startsWith("#")) return { ok: true, url, kind: "fragment" };
    if (normalized.startsWith("//")) return { ok: true, url, kind: "remote" };
    return { ok: true, url, kind: "relative" };
  }
  if (scheme === "data") {
    if (context === "image" && DATA_IMAGE.test(normalized)) return { ok: true, url, kind: "data" };
    if (context === "media" && DATA_MEDIA.test(normalized)) return { ok: true, url, kind: "data" };
    return { ok: false, reason: "unsafe", scheme };
  }
  if (SAFE_SCHEMES[context].has(scheme)) return { ok: true, url, kind: "remote" };
  if (NON_PORTABLE_SCHEMES.has(scheme)) return { ok: false, reason: "non-portable", scheme };
  return { ok: false, reason: "unsafe", scheme };
}
