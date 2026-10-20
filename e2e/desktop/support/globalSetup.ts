import { existsSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./layoutryApp";

/** Fails fast with a clear message instead of 40 identical launch timeouts. */
export default function globalSetup(): void {
  const required = [
    path.join(REPO_ROOT, "out", "index.html"),
    path.join(REPO_ROOT, "desktop-dist", "main", "main.js"),
  ];
  const missing = required.filter((file) => !existsSync(file));
  if (missing.length > 0) {
    throw new Error(
      `Desktop build missing (${missing.join(", ")}). Run "npm run desktop:test" (builds first) or "npm run desktop:build".`,
    );
  }
}
