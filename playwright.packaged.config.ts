import { defineConfig } from "@playwright/test";

/**
 * Packaged-app suite (DESKTOP-0.4). Launches the real, fuse-hardened
 * Layoutry.exe produced by `npm run desktop:package` — from the ZIP
 * extracted into a temporary path with spaces and non-ASCII characters,
 * and from release/win-unpacked. Because the packaged exe refuses
 * --inspect (fuse), the app is driven through Chromium's DevTools port and
 * Windows UI Automation instead of Playwright's _electron launcher.
 */
export default defineConfig({
  testDir: "./e2e/packaged",
  globalSetup: "./e2e/packaged/support/globalSetup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 120_000,
  reporter: "list",
});
