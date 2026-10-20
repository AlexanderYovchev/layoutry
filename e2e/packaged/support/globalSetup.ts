import { existsSync } from "node:fs";
import path from "node:path";
import { makeTempDir, removeDir } from "../../desktop/support/layoutryApp";
import { UNPACKED_EXE, ZIP_PATH } from "./packagedApp";
import { expandZip } from "./windows";

/**
 * Extracts the release ZIP with Windows' own Expand-Archive into a folder
 * whose path has spaces and non-ASCII characters, outside the repository.
 * Tests then run the exe from there, like a tester would.
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  for (const artifact of [ZIP_PATH, UNPACKED_EXE]) {
    if (!existsSync(artifact)) {
      throw new Error(
        `Missing ${artifact}. Run "npm run desktop:package" before "npm run desktop:test:packaged".`,
      );
    }
  }
  const root = await makeTempDir("layoutry-zip-test-");
  const appDir = path.join(root, "Layoutry Alpha Тест 測試");
  expandZip(ZIP_PATH, appDir);
  process.env.LAYOUTRY_EXTRACTED_APP_DIR = appDir;
  return () => removeDir(root);
}
