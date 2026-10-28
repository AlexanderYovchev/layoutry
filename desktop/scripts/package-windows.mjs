// Packages Layoutry as a portable Windows x64 ZIP (DESKTOP-0.4).
// Run through `npm run desktop:package`, which first runs desktop:build.
//
// 1. Stage only the runtime files (package.json, desktop-dist/, out/).
// 2. Validate the committed brand icon (design/branding, BRAND-1.1).
// 3. electron-builder: app.asar + embedded ASAR integrity + ZIP target,
//    with Layoutry's PACKAGED_FUSES flipped in the afterPack hook.
// 4. Verify the final artifact (fuse wire, asar contents) and report sizes.
import {
  cp,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  flipFuses,
  FuseState,
  FuseV1Options,
  getCurrentFuseWire,
} from "@electron/fuses";
import { Arch, build, Platform } from "electron-builder";
import { PACKAGED_FUSES } from "../fuses/layoutryFuses.ts";
import { listAsarFiles } from "../packaging/asarListing.mjs";
import {
  brandPaths,
  readIco,
  WINDOWS_ICON_SIZES,
} from "../../design/branding/brandIcons.mjs";
import {
  FORBIDDEN_ASAR_PATTERNS,
  RELEASE,
  releasePaths,
  REQUIRED_ASAR_ENTRIES,
  TESTER_DOCUMENTS,
} from "../packaging/releaseInfo.mjs";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const {
  releaseDir: RELEASE_DIR,
  stagingDir: STAGING_DIR,
  stagedAppDir: STAGED_APP_DIR,
  stagedBuildResourcesDir: STAGED_BUILD_RESOURCES_DIR,
  unpackedDir: UNPACKED_DIR,
  unpackedExe: UNPACKED_EXE,
  zipPath: ZIP_PATH,
} = releasePaths(REPO_ROOT);

const require = createRequire(path.join(REPO_ROOT, "package.json"));
const electronVersion = require("electron/package.json").version;
const electronDist = path.join(
  path.dirname(require.resolve("electron")),
  "dist",
);
const exportRoot = path.join(REPO_ROOT, "out");
const mainProcessRoot = path.join(REPO_ROOT, "desktop-dist");

function fail(message) {
  console.error(`\n[desktop:package] FAILED: ${message}`);
  process.exit(1);
}

async function directorySize(dir) {
  let total = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    total += entry.isDirectory()
      ? await directorySize(full)
      : (await stat(full)).size;
  }
  return total;
}

const megabytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

// --- 0. Preconditions ---------------------------------------------------
for (const required of [
  path.join(exportRoot, "index.html"),
  path.join(mainProcessRoot, "main", "main.js"),
]) {
  if (!existsSync(required)) {
    fail(`missing ${required} — run "npm run desktop:build" first.`);
  }
}

// --- 1. Stage the runtime files only ------------------------------------
await rm(RELEASE_DIR, { recursive: true, force: true });
await mkdir(STAGED_APP_DIR, { recursive: true });
await mkdir(STAGED_BUILD_RESOURCES_DIR, { recursive: true });

// A minimal manifest: no dependencies, so nothing from node_modules is packed.
await writeFile(
  path.join(STAGED_APP_DIR, "package.json"),
  `${JSON.stringify(
    {
      name: "layoutry",
      productName: RELEASE.productName,
      version: RELEASE.version,
      description: RELEASE.description,
      // Becomes the exe's CompanyName. Without it Windows would show the
      // stock Electron binary's "GitHub, Inc.". The product name is the
      // only grounded value — no company or person is claimed.
      author: { name: RELEASE.productName },
      private: true,
      main: "desktop-dist/main/main.js",
    },
    null,
    2,
  )}\n`,
);
await cp(mainProcessRoot, path.join(STAGED_APP_DIR, "desktop-dist"), {
  recursive: true,
  filter: (source) =>
    !source.endsWith(".map") &&
    (path.extname(source) === "" || source.endsWith(".js")),
});
// Turbopack also emits two unused byproducts for the recovery snapshot
// worker (PROJECT-1.5): a copy of the worker's .ts source under
// static/media, and an empty .map. The worker itself runs from compiled
// chunks; neither file is ever loaded, and neither may ship.
await cp(exportRoot, path.join(STAGED_APP_DIR, "out"), {
  recursive: true,
  filter: (source) => !/\.(map|tsx?)$/.test(source),
});
// Tester documents, shipped next to Layoutry.exe (outside app.asar), with
// the version filled in and Windows line endings for Notepad.
for (const { source, name } of TESTER_DOCUMENTS) {
  await writeFile(
    path.join(STAGED_BUILD_RESOURCES_DIR, name),
    (await readFile(path.join(REPO_ROOT, source), "utf8"))
      .replaceAll("{{VERSION}}", RELEASE.version)
      .replace(/\r?\n/g, "\r\n"),
  );
}

// --- 2. Brand icon ------------------------------------------------------
// Generated from the approved artwork by `npm run brand:generate` and
// committed; checked here so a broken or incomplete .ico never ships.
const iconPath = brandPaths(REPO_ROOT).windowsIconPath;
const iconBytes = await readFile(iconPath);
const iconSizes = readIco(iconBytes).map((entry) => entry.size);
if (iconSizes.join(",") !== WINDOWS_ICON_SIZES.join(",")) {
  fail(
    `${iconPath} has sizes ${iconSizes.join(", ")}; run "npm run brand:generate".`,
  );
}
console.log(
  `[desktop:package] icon: ${iconSizes.join(", ")} px (${iconBytes.length} bytes)`,
);

// --- 3. electron-builder -------------------------------------------------
await build({
  projectDir: STAGED_APP_DIR,
  targets: Platform.WINDOWS.createTarget(["zip"], Arch.x64),
  publish: "never",
  config: {
    productName: RELEASE.productName,
    executableName: RELEASE.executableName,
    electronVersion,
    // No copyright holder has been stated for Layoutry, so none is claimed
    // (electron-builder would otherwise generate "Copyright © <year> ...").
    copyright: "",
    // The exact Electron runtime the dev suite tests, from node_modules.
    // electron-builder copies it; the original is never modified.
    electronDist,
    directories: {
      output: RELEASE_DIR,
      buildResources: STAGED_BUILD_RESOURCES_DIR,
    },
    files: ["package.json", "desktop-dist/**/*", "out/**/*"],
    asar: true,
    npmRebuild: false,
    nodeGypRebuild: false,
    buildDependenciesFromSource: false,
    artifactName: "${productName}-${version}-win-${arch}.${ext}",
    win: {
      target: [{ target: "zip", arch: ["x64"] }],
      icon: iconPath,
    },
    extraFiles: TESTER_DOCUMENTS.map(({ name }) => ({
      from: path.join(STAGED_BUILD_RESOURCES_DIR, name),
      to: name,
    })),
    // Fuses go in after electron-builder has embedded the ASAR integrity
    // hash into the executable and before its resource-editing step. Our
    // own pinned @electron/fuses is used: electron-builder bundles an older
    // copy that does not know every fuse in Electron 44, which
    // PACKAGED_FUSES (strictlyRequireAllFuses) correctly refuses.
    afterPack: async (context) => {
      // Electron's stock runtime ships its demo app; a release must not.
      await rm(path.join(context.appOutDir, "resources", "default_app.asar"), {
        force: true,
      });
      await flipFuses(
        path.join(context.appOutDir, `${RELEASE.executableName}.exe`),
        PACKAGED_FUSES,
      );
    },
  },
});

// --- 4. Verify the final artifact ---------------------------------------
if (!existsSync(UNPACKED_EXE)) fail(`missing ${UNPACKED_EXE}`);
if (!existsSync(ZIP_PATH)) fail(`missing ${ZIP_PATH}`);

const wire = await getCurrentFuseWire(UNPACKED_EXE);
const fuseReport = [];
for (const key of Object.keys(FuseV1Options).filter((k) =>
  Number.isNaN(Number(k)),
)) {
  const fuse = FuseV1Options[key];
  const expected = PACKAGED_FUSES[fuse] ? FuseState.ENABLE : FuseState.DISABLE;
  const actual = wire[fuse];
  fuseReport.push(`${key}=${actual === FuseState.ENABLE ? "on" : "off"}`);
  if (actual !== expected)
    fail(`fuse ${key} is ${actual}, expected ${expected}`);
}

for (const { name } of TESTER_DOCUMENTS) {
  const shipped = path.join(UNPACKED_DIR, name);
  const text = existsSync(shipped) ? await readFile(shipped, "utf8") : "";
  if (!text.includes(RELEASE.version) || text.includes("{{")) {
    fail(`${name} is missing or was not filled in`);
  }
}

const resourcesDir = path.join(UNPACKED_DIR, "resources");
const resources = await readdir(resourcesDir);
if (resources.join(",") !== "app.asar") {
  fail(
    `resources/ should contain only app.asar, found: ${resources.join(", ")}`,
  );
}
const asarPath = path.join(resourcesDir, "app.asar");
const asarFiles = await listAsarFiles(asarPath);
for (const entry of REQUIRED_ASAR_ENTRIES) {
  if (!asarFiles.includes(entry)) fail(`app.asar is missing ${entry}`);
}
const forbidden = asarFiles.filter((file) =>
  FORBIDDEN_ASAR_PATTERNS.some((pattern) => pattern.test(file)),
);
if (forbidden.length > 0) {
  fail(
    `app.asar contains files it must not: ${forbidden.slice(0, 10).join(", ")}`,
  );
}

await rm(STAGING_DIR, { recursive: true, force: true });

const zipBytes = (await stat(ZIP_PATH)).size;
const unpackedBytes = await directorySize(UNPACKED_DIR);
const asarBytes = (await stat(asarPath)).size;
console.log(`
[desktop:package] OK — Layoutry ${RELEASE.version} (Electron ${electronVersion}, win-${RELEASE.arch})
  executable : ${path.relative(REPO_ROOT, UNPACKED_EXE)}
  zip        : ${path.relative(REPO_ROOT, ZIP_PATH)} (${megabytes(zipBytes)}, ${zipBytes} bytes)
  unpacked   : ${path.relative(REPO_ROOT, UNPACKED_DIR)} (${megabytes(unpackedBytes)})
  app.asar   : ${megabytes(asarBytes)}, ${asarFiles.length} files
  fuses      : ${fuseReport.join(" ")}
`);
