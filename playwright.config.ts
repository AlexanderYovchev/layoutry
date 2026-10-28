import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Real-Electron specs run separately: playwright.desktop.config.ts and
  // playwright.packaged.config.ts.
  testIgnore: ["desktop/**", "packaged/**"],
  fullyParallel: true,
  // At most 4 browsers at once (Playwright's default is half the logical
  // CPUs: 8 on the reference 16-thread, 7.9 GB machine). With 8 workers,
  // free memory fell to ~4 MB and timing-sensitive specs (recovery status,
  // the export parity specs) timed out intermittently from memory
  // thrashing; with 4 the full suite passed 3/3 and ran faster (EXPORT-1.3
  // report, section AF).
  workers: 4,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
