// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
 * BC-17.3.1 QA-5 — the Inspector must not load the export engine, the
 * shared stylesheet compiler or the export UI just to check a URL. The
 * export feature's index.ts (and the canvas feature's, which it reaches)
 * loads all of them: InspectorContent's import closure was 320 modules
 * through that one import, 251 without it. Production Inspector modules
 * import only the pure modules they need.
 */

const INSPECTOR = path.join(process.cwd(), "src/features/inspector");

function productionFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const file = path.join(directory, name);
    if (statSync(file).isDirectory()) return productionFiles(file);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [file] : [];
  });
}

describe("Inspector import boundary (BC-17.3.1 QA-5)", () => {
  it("no Inspector module imports the export or canvas feature index (which loads the export engine, the compiler and the export UI)", () => {
    const offenders = productionFiles(INSPECTOR).filter((file) =>
      /from\s+"@\/features\/(export|canvas)"/.test(readFileSync(file, "utf8")),
    );
    expect(offenders.map((file) => path.relative(process.cwd(), file))).toEqual(
      [],
    );
  });
});
