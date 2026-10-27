// Release identity and artifact locations for the Windows portable alpha
// (DESKTOP-0.4). Shared by desktop/scripts/package-windows.mjs and the
// packaged-app test suite so names and paths are defined exactly once.
// Location-independent on purpose (no import.meta): the Playwright suite
// loads this module as CommonJS.
import path from "node:path";

/**
 * The desktop release has its own version. The repository's package.json
 * version (the browser app) is deliberately left alone.
 */
export const RELEASE = {
  productName: "Layoutry",
  executableName: "Layoutry",
  version: "0.1.0-alpha.1",
  description: "Build layouts visually. Own the code.",
  arch: "x64",
};

export const ZIP_NAME = `${RELEASE.productName}-${RELEASE.version}-win-${RELEASE.arch}.zip`;

/** Every generated path, under the gitignored release/ folder. */
export function releasePaths(repoRoot) {
  const releaseDir = path.join(repoRoot, "release");
  const stagingDir = path.join(releaseDir, ".staging");
  const unpackedDir = path.join(releaseDir, "win-unpacked");
  return {
    releaseDir,
    stagingDir,
    stagedAppDir: path.join(stagingDir, "app"),
    stagedBuildResourcesDir: path.join(stagingDir, "build"),
    unpackedDir,
    unpackedExe: path.join(unpackedDir, `${RELEASE.executableName}.exe`),
    zipPath: path.join(releaseDir, ZIP_NAME),
  };
}

/** Tester-facing documents shipped next to Layoutry.exe ({{VERSION}} is filled in). */
export const TESTER_DOCUMENTS = [
  { source: "desktop/packaging/README-alpha.txt", name: "README.txt" },
  {
    source: "desktop/packaging/FEEDBACK-TEMPLATE.txt",
    name: "FEEDBACK-TEMPLATE.txt",
  },
];

/** Supported platforms, as stated in the release manifest and README. */
export const SUPPORTED_WINDOWS = "Windows 10 and Windows 11, 64-bit (x64)";

/** Known alpha limitations, as stated in the release manifest. */
export const KNOWN_LIMITATIONS = [
  "No project saving, opening, autosave, recovery or export: closing, a crash or a Windows restart discards the document.",
  "Unsigned executable: Windows SmartScreen and antivirus products may warn on first launch.",
  "No installer and no auto-update: each release is a new ZIP.",
  "Validated on one Windows 10 x64 machine (single 1920x1080 monitor, 100% scaling); 125%/150% scaling was simulated; Windows 11 and multi-monitor setups are untested.",
  "The editor needs a content area of at least 900 x 600 pixels.",
  "Offline operation was verified by blocking and observing network requests, not on a machine without a network adapter.",
];

/** Files every packaged app.asar must contain. */
export const REQUIRED_ASAR_ENTRIES = [
  "package.json",
  "desktop-dist/main/main.js",
  "desktop-dist/preload/preload.js",
  "desktop-dist/files/projectFileSystem.js",
  "desktop-dist/recovery/recoveryStore.js",
  "desktop-dist/protocol/appProtocolHandler.js",
  "desktop-dist/security/contentSecurityPolicy.js",
  "out/index.html",
];

/** Patterns that must never appear inside app.asar. */
export const FORBIDDEN_ASAR_PATTERNS = [
  /(^|\/)node_modules\//,
  /(^|\/)src\//,
  /(^|\/)e2e\//,
  /(^|\/)test\//,
  /(^|\/)docs\//,
  /(^|\/)\.git(\/|$)/,
  /(^|\/)\.next\//,
  /(^|\/)\.env/,
  /(^|\/)desktop\//,
  /(^|\/)fuses\//,
  /\.map$/,
  /\.tsx?$/,
  /\.test\.[cm]?js$/,
  /(^|\/)test-results\//,
  /(^|\/)changelogs\//,
];
