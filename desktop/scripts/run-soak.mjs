// Runs the opt-in packaged-app stability session (e2e/packaged/soak.spec.ts)
// against the current release ZIP. Usage: npm run desktop:soak [-- <minutes>]
// Environment is set here, not in the npm script, so it works in any shell.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const require = createRequire(path.join(repoRoot, "package.json"));
const minutes = process.argv[2] ?? "20";

const result = spawnSync(
  process.execPath,
  [
    require.resolve("@playwright/test/cli"),
    "test",
    "-c",
    "playwright.packaged.config.ts",
    "--grep",
    "@soak",
    "--reporter=list",
  ],
  {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, LAYOUTRY_SOAK: "1", LAYOUTRY_SOAK_MINUTES: minutes },
  },
);
process.exit(result.status ?? 1);
