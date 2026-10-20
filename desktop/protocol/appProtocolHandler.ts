import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import { CONTENT_SECURITY_POLICY } from "../security/contentSecurityPolicy";
import { resolveAppAssetPath } from "./resolveAppAssetPath";

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
};

export function contentTypeFor(filePath: string): string {
  return (
    CONTENT_TYPES[path.extname(filePath).toLowerCase()] ??
    "application/octet-stream"
  );
}

export interface AppProtocolHandlerOptions {
  /** Absolute path of the Next.js static export (`out/`). */
  exportRoot: string;
  /** Reads one already-validated file inside exportRoot (Electron: net.fetch of its file: URL). */
  fetchFile: (filePath: string) => Promise<Response>;
}

function isInside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return (
    relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)
  );
}

/**
 * The lexical check in resolveAppAssetPath cannot see links: a symlink or
 * junction inside the export could still point anywhere on disk. Resolving
 * both sides to their real paths closes that gap — a regular file whose
 * real location is inside the real export root, or nothing.
 */
async function resolveContainedFile(
  filePath: string,
  exportRoot: string,
): Promise<string | null> {
  try {
    const [realRoot, realFile] = await Promise.all([
      realpath(exportRoot),
      realpath(filePath),
    ]);
    if (!isInside(realRoot, realFile)) return null;
    return (await stat(realFile)).isFile() ? realFile : null;
  } catch {
    return null;
  }
}

function plainResponse(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/**
 * Serves the bundled static export for app://layoutry/ — read-only, GET/HEAD
 * only, never outside exportRoot, never a directory listing. Every
 * successful response carries the desktop CSP.
 */
export function createAppProtocolHandler({
  exportRoot,
  fetchFile,
}: AppProtocolHandlerOptions) {
  return async function handleAppRequest(request: Request): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return plainResponse(405, "Method not allowed");
    }

    const resolution = resolveAppAssetPath(request.url, exportRoot);
    if (resolution.kind === "rejected") {
      return plainResponse(400, "Bad request");
    }
    const filePath = await resolveContainedFile(
      resolution.filePath,
      exportRoot,
    );
    if (filePath === null) {
      return plainResponse(404, "Not found");
    }

    let file: Response;
    try {
      file = await fetchFile(filePath);
    } catch {
      return plainResponse(404, "Not found");
    }
    if (!file.ok) {
      return plainResponse(404, "Not found");
    }
    return new Response(request.method === "HEAD" ? null : file.body, {
      status: 200,
      headers: {
        "Content-Type": contentTypeFor(filePath),
        "Content-Security-Policy": CONTENT_SECURITY_POLICY,
        "X-Content-Type-Options": "nosniff",
      },
    });
  };
}
