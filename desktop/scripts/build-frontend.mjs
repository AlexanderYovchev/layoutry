// Builds the Next.js static export (out/) for the desktop shell.
// Sets LAYOUTRY_DESKTOP_BUILD here rather than in the npm script so the
// command works the same in PowerShell, CMD and POSIX shells.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const result = spawnSync(
  process.execPath,
  [require.resolve("next/dist/bin/next"), "build"],
  {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, LAYOUTRY_DESKTOP_BUILD: "1" },
  },
);

process.exit(result.status ?? 1);
