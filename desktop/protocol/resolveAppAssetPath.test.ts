// @vitest-environment node
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveAppAssetPath } from "./resolveAppAssetPath";

const root = path.resolve("/layoutry-export");

function fileAt(...segments: string[]) {
  return { kind: "file", filePath: path.join(root, ...segments) };
}

describe("resolveAppAssetPath", () => {
  it("maps the app root to index.html", () => {
    expect(resolveAppAssetPath("app://layoutry/", root)).toEqual(
      fileAt("index.html"),
    );
    expect(resolveAppAssetPath("app://layoutry", root)).toEqual(
      fileAt("index.html"),
    );
  });

  it("maps static asset paths into the export directory", () => {
    expect(
      resolveAppAssetPath("app://layoutry/_next/static/chunks/abc.js", root),
    ).toEqual(fileAt("_next", "static", "chunks", "abc.js"));
    expect(resolveAppAssetPath("app://layoutry/favicon.ico", root)).toEqual(
      fileAt("favicon.ico"),
    );
  });

  it("maps a trailing-slash directory path to its index.html", () => {
    expect(resolveAppAssetPath("app://layoutry/nested/", root)).toEqual(
      fileAt("nested", "index.html"),
    );
  });

  it("ignores query strings and fragments", () => {
    expect(
      resolveAppAssetPath("app://layoutry/_next/a.css?v=123#x", root),
    ).toEqual(fileAt("_next", "a.css"));
  });

  it("decodes percent-encoded segments", () => {
    expect(
      resolveAppAssetPath("app://layoutry/media/my%20font.woff2", root),
    ).toEqual(fileAt("media", "my font.woff2"));
  });

  it("rejects other schemes and hosts", () => {
    expect(resolveAppAssetPath("file:///C:/Windows/win.ini", root)).toEqual({
      kind: "rejected",
      reason: "scheme",
    });
    expect(resolveAppAssetPath("https://layoutry/index.html", root)).toEqual({
      kind: "rejected",
      reason: "scheme",
    });
    expect(resolveAppAssetPath("app://evil/index.html", root)).toEqual({
      kind: "rejected",
      reason: "host",
    });
    expect(resolveAppAssetPath("app://layoutry:8080/index.html", root)).toEqual(
      { kind: "rejected", reason: "host" },
    );
    expect(
      resolveAppAssetPath("app://user:pw@layoutry/index.html", root),
    ).toEqual({ kind: "rejected", reason: "host" });
  });

  it("rejects malformed URLs and encodings", () => {
    expect(resolveAppAssetPath("not a url", root)).toEqual({
      kind: "rejected",
      reason: "malformed",
    });
    expect(resolveAppAssetPath("app://layoutry/%E0%A4%A", root)).toEqual({
      kind: "rejected",
      reason: "malformed",
    });
  });

  it.each([
    "app://layoutry/..%2Fpackage.json",
    "app://layoutry/..%2F..%2FWindows%2Fwin.ini",
    "app://layoutry/..%5Cpackage.json",
    "app://layoutry/_next/%2e%2e%2f%2e%2e%2fsrc%2fapp%2fpage.tsx",
    "app://layoutry/..\\..\\package.json",
    "app://layoutry/C:%5CWindows%5Cwin.ini",
    "app://layoutry/C:/Windows/win.ini",
    "app://layoutry/index.html:secret",
    "app://layoutry/a%00.js",
    "app://layoutry//etc/passwd",
    "app://layoutry/_next//x.js",
  ])("rejects a smuggled or escaping path: %s", (url) => {
    expect(resolveAppAssetPath(url, root)).toEqual({
      kind: "rejected",
      reason: "unsafe-path",
    });
  });

  // Plain and %2e dot segments are normalized by the URL parser itself
  // (exactly as Chromium does for a standard scheme), so they can never
  // climb above the export root.
  it("keeps parser-normalized dot segments inside the export root", () => {
    expect(
      resolveAppAssetPath("app://layoutry/../../package.json", root),
    ).toEqual(fileAt("package.json"));
    expect(
      resolveAppAssetPath("app://layoutry/%2e%2e/%2e%2e/package.json", root),
    ).toEqual(fileAt("package.json"));
  });
});
