// @vitest-environment node
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FORBIDDEN_ASAR_PATTERNS,
  RELEASE,
  releasePaths,
  REQUIRED_ASAR_ENTRIES,
  ZIP_NAME,
} from "./releaseInfo.mjs";

const isForbidden = (file: string) =>
  FORBIDDEN_ASAR_PATTERNS.some((pattern) => pattern.test(file));

describe("release identity", () => {
  it("names the ZIP after product, version and architecture", () => {
    expect(RELEASE.version).toMatch(/^\d+\.\d+\.\d+-alpha\.\d+$/);
    expect(ZIP_NAME).toBe(`Layoutry-${RELEASE.version}-win-x64.zip`);
  });

  it("keeps every generated path inside release/", () => {
    const root = path.resolve("/repo");
    const paths = releasePaths(root);
    for (const generated of Object.values(paths)) {
      expect(path.relative(root, generated).startsWith("release")).toBe(true);
    }
    expect(paths.unpackedExe).toBe(
      path.join(root, "release", "win-unpacked", "Layoutry.exe"),
    );
    expect(paths.zipPath).toBe(path.join(root, "release", ZIP_NAME));
  });
});

describe("app.asar content rules", () => {
  it("never forbids a required runtime file", () => {
    expect(REQUIRED_ASAR_ENTRIES.filter(isForbidden)).toEqual([]);
  });

  it.each([
    "node_modules/react/index.js",
    "src/app/page.tsx",
    "e2e/desktop/launch.spec.ts",
    "desktop/main/main.ts",
    "desktop-dist/main/main.js.map",
    "desktop-dist/main/closeGuard.test.js",
    ".env.local",
    ".git/config",
    "docs/architecture/desktop-shell.md",
  ])("forbids %s", (file) => {
    expect(isForbidden(file)).toBe(true);
  });

  it.each([
    "out/index.html",
    "out/_next/static/chunks/abc.js",
    "out/_next/static/media/inter.woff2",
    "desktop-dist/protocol/appProtocolHandler.js",
  ])("allows %s", (file) => {
    expect(isForbidden(file)).toBe(false);
  });
});
