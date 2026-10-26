import { defineConfig } from "@playwright/test";

const soak = process.env.LAYOUTRY_SOAK === "1";

/**
 * Packaged-app suite (DESKTOP-0.4/0.5). Launches the real, fuse-hardened
 * Layoutry.exe produced by `npm run desktop:package` — from the ZIP
 * extracted into a temporary path with spaces and non-ASCII characters,
 * and from release/win-unpacked. Because the packaged exe refuses
 * --inspect (fuse), the app is driven through Chromium's DevTools port and
 * Win32/UI Automation instead of Playwright's _electron launcher.
 *
 * The @soak stability session only runs through `npm run desktop:soak`.
 * Normal runs write release/packaged-test-results.json, which the release
 * manifest uses as its validation record.
 */
export default defineConfig({
  testDir: "./e2e/packaged",
  globalSetup: "./e2e/packaged/support/globalSetup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 120_000,
  grep: soak ? /@soak/ : undefined,
  grepInvert: soak ? undefined : /@soak/,
  reporter: soak
    ? "list"
    : [
        ["list"],
        ["json", { outputFile: "release/packaged-test-results.json" }],
      ],
});
