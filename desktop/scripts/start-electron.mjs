// Launches the desktop shell from the repository root. ELECTRON_RUN_AS_NODE
// is removed because some hosts (e.g. editor extension terminals) export
// it, which would make electron.exe behave as plain Node.js instead.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const electronBinary = require("electron");

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronBinary, ["."], {
  cwd: repoRoot,
  stdio: "inherit",
  env,
});
child.on("exit", (code) => process.exit(code ?? 1));
