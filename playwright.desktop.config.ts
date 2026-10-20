import { defineConfig } from "@playwright/test";

/**
 * Real-Electron desktop suite (DESKTOP-0.3). Every spec launches the actual
 * Electron main process against the built static export — run through
 * `npm run desktop:test`, which builds first.
 *
 * Serial on purpose: each test owns a private --user-data-dir (and with it
 * its own single-instance lock), but launching several Electron apps at
 * once makes window focus and startup timing nondeterministic.
 */
export default defineConfig({
  testDir: "./e2e/desktop",
  globalSetup: "./e2e/desktop/support/globalSetup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 90_000,
  reporter: "list",
});
