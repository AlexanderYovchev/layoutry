import { expect, test } from "@playwright/test";
import { FuseState, FuseV1Options, getCurrentFuseWire } from "@electron/fuses";
import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { PACKAGED_FUSES } from "../../desktop/fuses/layoutryFuses";
import { brandPaths, readIco } from "../../design/branding/brandIcons.mjs";
import { listAsarFiles } from "../../desktop/packaging/asarListing.mjs";
import {
  FORBIDDEN_ASAR_PATTERNS,
  RELEASE,
  REQUIRED_ASAR_ENTRIES,
  TESTER_DOCUMENTS,
  ZIP_NAME,
} from "../../desktop/packaging/releaseInfo.mjs";
import { electronBinary, REPO_ROOT } from "../desktop/support/layoutryApp";
import {
  extractedAppDir,
  extractedExe,
  UNPACKED_DIR,
  UNPACKED_EXE,
  ZIP_PATH,
} from "./support/packagedApp";
import {
  associatedIconHash,
  executableInfo,
  zipEntries,
} from "./support/windows";

const allFuses = Object.values(FuseV1Options).filter(
  (value): value is FuseV1Options => typeof value === "number",
);

async function listTree(root: string, prefix = ""): Promise<string[]> {
  const entries = await readdir(path.join(root, prefix), {
    withFileTypes: true,
  });
  const files: string[] = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...(await listTree(root, relative)));
    else files.push(relative);
  }
  return files.sort();
}

test("the release ZIP is deterministically named and extracts to a flat, complete app", async () => {
  expect(path.basename(ZIP_PATH)).toBe(ZIP_NAME);
  expect(ZIP_NAME).toBe(`Layoutry-${RELEASE.version}-win-x64.zip`);
  expect((await stat(ZIP_PATH)).size).toBeGreaterThan(50 * 1024 * 1024);

  const extracted = await listTree(extractedAppDir());
  // No extra parent folder: Layoutry.exe sits at the ZIP root.
  expect(extracted).toContain("Layoutry.exe");
  // The ZIP holds exactly what release/win-unpacked holds.
  expect(extracted).toEqual(await listTree(UNPACKED_DIR));
  for (const required of [
    "Layoutry.exe",
    "README.txt",
    "resources/app.asar",
    "icudtl.dat",
    "ffmpeg.dll",
    "resources.pak",
    "v8_context_snapshot.bin",
    "locales/en-US.pak",
    "LICENSE.electron.txt",
    "LICENSES.chromium.html",
  ]) {
    expect(extracted, required).toContain(required);
  }
  expect(extracted.filter((file) => file.startsWith("resources/"))).toEqual([
    "resources/app.asar",
  ]);

  for (const { name } of TESTER_DOCUMENTS) {
    const text = await readFile(path.join(extractedAppDir(), name), "utf8");
    expect(text, name).toContain(RELEASE.version);
    expect(text, name).not.toContain("{{");
  }
});

test("the ZIP's own entry list contains no development files", () => {
  const entries = zipEntries(ZIP_PATH);
  expect(entries.length).toBeGreaterThan(50);
  expect(entries).toContain("Layoutry.exe");
  expect(entries).toContain("FEEDBACK-TEMPLATE.txt");
  const suspicious = entries.filter((entry) =>
    /(^|\/)(node_modules|src|e2e|test|docs|\.git|\.next|desktop)\/|\.(map|ts|tsx|env|pem|log)$|(^|\/)\.env/i.test(
      entry,
    ),
  );
  expect(suspicious).toEqual([]);
});

test("shipped app code and documents contain no secrets or developer-machine paths", async () => {
  const shipped = [
    path.join(extractedAppDir(), "resources", "app.asar"),
    ...TESTER_DOCUMENTS.map(({ name }) => path.join(extractedAppDir(), name)),
  ];
  const patterns: [string, RegExp][] = [
    ["developer checkout path", /Main Projects|Visual CSS Playground Project/i],
    ["user profile path", /C:\\\\?Users\\\\?User\b/i],
    ["developer e-mail", /yovchev/i],
    ["private key", /BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/],
    ["AWS access key", /AKIA[0-9A-Z]{16}/],
    ["GitHub token", /gh[pousr]_[A-Za-z0-9]{30,}/],
    ["Anthropic/OpenAI-style key", /\bsk-[A-Za-z0-9_-]{20,}/],
  ];
  for (const file of shipped) {
    const content = (await readFile(file)).toString("latin1");
    for (const [label, pattern] of patterns) {
      expect(pattern.test(content), `${label} in ${path.basename(file)}`).toBe(
        false,
      );
    }
  }
});

test("app.asar holds only the compiled main process and the static export", async () => {
  for (const asar of [
    path.join(UNPACKED_DIR, "resources", "app.asar"),
    path.join(extractedAppDir(), "resources", "app.asar"),
  ]) {
    const files = await listAsarFiles(asar);
    for (const required of REQUIRED_ASAR_ENTRIES) {
      expect(files, required).toContain(required);
    }
    expect(
      files.filter((file) => FORBIDDEN_ASAR_PATTERNS.some((p) => p.test(file))),
    ).toEqual([]);
    expect(
      files.filter(
        (file) =>
          file !== "package.json" &&
          !file.startsWith("desktop-dist/") &&
          !file.startsWith("out/"),
      ),
    ).toEqual([]);
  }
});

test("both executables carry every fuse from PACKAGED_FUSES", async () => {
  for (const exe of [UNPACKED_EXE, extractedExe()]) {
    const wire = await getCurrentFuseWire(exe);
    for (const fuse of allFuses) {
      expect(wire[fuse], `${exe}: ${FuseV1Options[fuse]}`).toBe(
        PACKAGED_FUSES[fuse] ? FuseState.ENABLE : FuseState.DISABLE,
      );
    }
  }
  // The development Electron binary is never modified by packaging.
  const stock = await getCurrentFuseWire(electronBinary());
  expect(stock[FuseV1Options.RunAsNode]).toBe(FuseState.ENABLE);
  expect(stock[FuseV1Options.OnlyLoadAppFromAsar]).toBe(FuseState.DISABLE);
});

test("the executable has Layoutry metadata, the Layoutry icon, and is (honestly) unsigned", async () => {
  const info = executableInfo(extractedExe());
  expect(info).toEqual({
    ProductName: "Layoutry",
    FileDescription: "Layoutry",
    FileVersion: RELEASE.version,
    CompanyName: "Layoutry",
    LegalCopyright: "",
    Signature: "NotSigned",
  });
  expect(associatedIconHash(extractedExe())).not.toBe(
    associatedIconHash(electronBinary()),
  );
  // The brand icon (BRAND-1.1), byte for byte: icon resources are stored
  // verbatim in the exe, so every size of layoutry.ico must appear in it.
  const exeBytes = await readFile(extractedExe());
  for (const { size, png } of readIco(
    await readFile(brandPaths(REPO_ROOT).windowsIconPath),
  )) {
    expect(exeBytes.includes(png), `${size} px icon embedded`).toBe(true);
  }
  expect(
    existsSync(path.join(extractedAppDir(), "resources", "default_app.asar")),
  ).toBe(false);
});
