// Writes the release manifest and checksum for the packaged Windows ZIP
// (DESKTOP-0.5). Every value is read from the actual artifact, Git, and
// the packaged test results — nothing is typed in by hand:
//   release/<zip>.sha256          "<sha256> *<zip>" (sha256sum format)
//   release/<zip base>.manifest.md
// Validation results count only if they were produced AFTER this ZIP was
// built; otherwise the manifest says so and the script exits nonzero.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FuseState, FuseV1Options, getCurrentFuseWire } from "@electron/fuses";
import {
  KNOWN_LIMITATIONS,
  RELEASE,
  releasePaths,
  SUPPORTED_WINDOWS,
  ZIP_NAME,
} from "../packaging/releaseInfo.mjs";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const { releaseDir, zipPath, unpackedExe } = releasePaths(REPO_ROOT);
const PACKAGED_RESULTS = path.join(releaseDir, "packaged-test-results.json");
const SOAK_RESULTS = path.join(releaseDir, "soak-results.json");
const require = createRequire(path.join(REPO_ROOT, "package.json"));

function git(...args) {
  const result = spawnSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "unknown";
}

function sha256(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(file)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", () => resolve(hash.digest("hex")))
      .on("error", reject);
  });
}

async function readJsonIfNewer(file, since) {
  if (!existsSync(file)) return { status: "missing" };
  const modified = (await stat(file)).mtime;
  if (modified < since) return { status: "stale", modified };
  return {
    status: "current",
    modified,
    data: JSON.parse(await readFile(file, "utf8")),
  };
}

if (!existsSync(zipPath)) {
  console.error(
    `[desktop:manifest] missing ${zipPath} — run "npm run desktop:package".`,
  );
  process.exit(1);
}

const zip = await stat(zipPath);
const checksum = await sha256(zipPath);
const commit = git("rev-parse", "HEAD");
const shortCommit = git("rev-parse", "--short", "HEAD");
const dirtyFiles = git("status", "--porcelain").split("\n").filter(Boolean);
const electronVersion = require("electron/package.json").version;

const wire = await getCurrentFuseWire(unpackedExe);
const fuses = Object.keys(FuseV1Options)
  .filter((key) => Number.isNaN(Number(key)))
  .map(
    (key) =>
      `${key}=${wire[FuseV1Options[key]] === FuseState.ENABLE ? "on" : "off"}`,
  );

const packaged = await readJsonIfNewer(PACKAGED_RESULTS, zip.mtime);
const soak = await readJsonIfNewer(SOAK_RESULTS, zip.mtime);

let validated = false;
let packagedLine;
if (packaged.status === "current") {
  const {
    expected = 0,
    unexpected = 0,
    flaky = 0,
    skipped = 0,
  } = packaged.data.stats ?? {};
  validated = unexpected === 0 && flaky === 0 && expected > 0;
  packagedLine = `${expected} passed, ${unexpected} failed, ${flaky} flaky, ${skipped} skipped (npm run desktop:test:packaged, ${packaged.modified.toISOString()})`;
} else {
  packagedLine = `NOT VALIDATED — packaged test results are ${packaged.status} for this ZIP`;
}

let soakLine;
if (soak.status === "current") {
  const s = soak.data;
  const verdict =
    s.passed === true
      ? "PASSED"
      : `FAILED${s.failure ? ` (${s.failure})` : ""}`;
  soakLine = `${verdict} — ran ${s.elapsedMinutes} of ${s.plannedMinutes} planned min, ${s.iterations} editing iterations, ${s.crashes} crashes, ${s.consoleErrors} console errors, working set ${s.memoryStartMb}→${s.memoryEndMb} MB (peak ${s.memoryPeakMb} MB) (npm run desktop:soak, ${soak.modified.toISOString()})`;
} else {
  soakLine = `not run against this ZIP (${soak.status})`;
}

const manifest = `# ${RELEASE.productName} ${RELEASE.version} — Release Manifest

| Field | Value |
| --- | --- |
| Product | ${RELEASE.productName} |
| Version | ${RELEASE.version} (alpha) |
| Architecture | Windows ${RELEASE.arch} |
| Supported Windows | ${SUPPORTED_WINDOWS} |
| ZIP | ${ZIP_NAME} |
| ZIP size | ${zip.size} bytes (${(zip.size / 1024 / 1024).toFixed(1)} MB) |
| SHA-256 | \`${checksum}\` |
| Built | ${zip.mtime.toISOString()} |
| Build commit | ${commit} (${shortCommit})${dirtyFiles.length ? ` + ${dirtyFiles.length} uncommitted change(s)` : ""} |
| Electron | ${electronVersion} |
| Code signing | none (unsigned alpha) |

## Electron fuses (read from the packaged executable)

${fuses.map((fuse) => `- ${fuse}`).join("\n")}

## Validation summary

- Packaged-app suite: ${packagedLine}
- Stability session: ${soakLine}

## Known limitations

${KNOWN_LIMITATIONS.map((item) => `- ${item}`).join("\n")}

## Verifying the download

In PowerShell: \`Get-FileHash .\\${ZIP_NAME} -Algorithm SHA256\` must print the SHA-256 above.
`;

const base = ZIP_NAME.replace(/\.zip$/, "");
await writeFile(path.join(releaseDir, `${base}.manifest.md`), manifest);
await writeFile(
  path.join(releaseDir, `${ZIP_NAME}.sha256`),
  `${checksum} *${ZIP_NAME}\n`,
);

console.log(manifest);
if (dirtyFiles.length) {
  console.warn(
    `[desktop:manifest] WARNING: built from a working tree with ${dirtyFiles.length} uncommitted change(s); rebuild after committing for a clean-provenance release.`,
  );
}
if (!validated) {
  console.error(
    "[desktop:manifest] The ZIP is NOT validated by a passing packaged test run.",
  );
  process.exit(1);
}
