// Regenerates every derived brand asset from the approved artwork
// (BRAND-1.1). Run with `npm run brand:generate` after changing
// layoutry-icon-source.png or a layoutry-icon-small-*.svg; the outputs are
// committed so builds and packaging never depend on this step.
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  brandPaths,
  buildBrandIco,
  extractIconMaster,
  FAVICON_SIZES,
  optimizeForWeb,
  renderIconPng,
  renderOpaqueIconPng,
  WINDOWS_ICON_SIZES,
} from "./brandIcons.mjs";

const { appDir, brandingDir, sourcePath, windowsIconPath } = brandPaths(
  fileURLToPath(new URL("../..", import.meta.url)),
);
const master = await extractIconMaster(sourcePath);
const icon = { master, brandingDir };
const outputs = [
  [windowsIconPath, await buildBrandIco(icon, WINDOWS_ICON_SIZES)],
  [path.join(appDir, "favicon.ico"), await buildBrandIco(icon, FAVICON_SIZES)],
  [
    path.join(appDir, "icon.png"),
    await optimizeForWeb(await renderIconPng(icon, 192)),
  ],
  [
    path.join(appDir, "apple-icon.png"),
    await optimizeForWeb(await renderOpaqueIconPng(master, 180)),
  ],
];
for (const [file, bytes] of outputs) {
  await writeFile(file, bytes);
  console.log(
    `[brand] ${path.relative(process.cwd(), file)} (${bytes.length} bytes)`,
  );
}
