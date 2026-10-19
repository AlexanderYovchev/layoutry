import path from "node:path";
import { APP_HOST, APP_SCHEME } from "./appOrigin";

export type AppAssetResolution =
  | { kind: "file"; filePath: string }
  | {
      kind: "rejected";
      reason: "malformed" | "scheme" | "host" | "unsafe-path";
    };

const INDEX_FILE = "index.html";

/**
 * Characters that are never legitimate inside one decoded path segment of
 * the static export: separators (an encoded `%2F`/`%5C` must not smuggle
 * in extra segments), `:` (drive letters, NTFS alternate data streams),
 * and NUL.
 */
const FORBIDDEN_SEGMENT_CHARACTERS = /[/\\:\0]/;

/**
 * Maps an `app://layoutry/...` request URL to a file inside `exportRoot`,
 * or rejects it. Only the URL path selects a file — query strings and
 * fragments are ignored. A path ending in `/` selects that directory's
 * `index.html`. The result is always contained in `exportRoot`; whether
 * the file actually exists is the caller's concern.
 */
export function resolveAppAssetPath(
  requestUrl: string,
  exportRoot: string,
): AppAssetResolution {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return { kind: "rejected", reason: "malformed" };
  }

  if (url.protocol !== `${APP_SCHEME}:`) {
    return { kind: "rejected", reason: "scheme" };
  }
  if (
    url.hostname !== APP_HOST ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== ""
  ) {
    return { kind: "rejected", reason: "host" };
  }

  const rawSegments = url.pathname.split("/").slice(1);
  if (rawSegments.length === 0 || rawSegments[rawSegments.length - 1] === "") {
    rawSegments.splice(-1, 1, INDEX_FILE);
  }

  const segments: string[] = [];
  for (const rawSegment of rawSegments) {
    let segment: string;
    try {
      segment = decodeURIComponent(rawSegment);
    } catch {
      return { kind: "rejected", reason: "malformed" };
    }
    if (
      segment === "" ||
      segment === "." ||
      segment === ".." ||
      FORBIDDEN_SEGMENT_CHARACTERS.test(segment)
    ) {
      return { kind: "rejected", reason: "unsafe-path" };
    }
    segments.push(segment);
  }

  const root = path.resolve(exportRoot);
  const filePath = path.resolve(root, ...segments);
  const relative = path.relative(root, filePath);
  if (
    relative === "" ||
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    return { kind: "rejected", reason: "unsafe-path" };
  }

  return { kind: "file", filePath };
}
