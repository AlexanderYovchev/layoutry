import { expect, test } from "@playwright/test";
import { stat } from "node:fs/promises";
import {
  documentNodeCount,
  dragInsertContainer,
  makeTempDir,
  removeDir,
} from "../desktop/support/layoutryApp";
import { extractedExe, launchPackaged, ZIP_PATH } from "./support/packagedApp";
import { processTree } from "./support/windows";

/**
 * Single-machine baselines for the packaged exe, recorded as annotations.
 * Startup is measured from process spawn to "editor hydrated and window
 * visible", including DevTools-port polling overhead (~200 ms steps).
 * Ceilings only catch gross regressions.
 */

test.describe.configure({ timeout: 180_000 });

test("records packaged startup, memory and interaction baselines", async ({}, testInfo) => {
  const record = (type: string, value: number, unit: string) => {
    const description = `${Math.round(value)} ${unit}`;
    testInfo.annotations.push({ type, description });
    console.log(`[packaged perf] ${type}: ${description}`);
  };
  record("zip-size", (await stat(ZIP_PATH)).size / 1024 / 1024, "MB");

  const profile = await makeTempDir("layoutry-packaged-perf-");
  try {
    let launched = await launchPackaged(extractedExe(), {
      userDataDir: profile,
    });
    const coldMs = launched.startupMs;
    await launched.dispose();

    launched = await launchPackaged(extractedExe(), { userDataDir: profile });
    const warmMs = launched.startupMs;
    record("startup-cold-to-hydrated", coldMs, "ms");
    record("startup-warm-to-hydrated", warmMs, "ms");

    try {
      const { page, pid } = launched;
      await page.waitForTimeout(1_000);
      const tree = processTree(pid);
      const workingSetMb =
        tree.reduce((sum, process) => sum + process.workingSetBytes, 0) /
        1024 /
        1024;
      record("processes", tree.length, "processes");
      record("memory-working-set-total", workingSetMb, "MB");

      const inspector = page.getByRole("complementary", {
        name: "Inspector panel",
      });
      let started = performance.now();
      await page.locator("[data-document-surface] h1").first().click();
      await expect(inspector.getByText("heading-1")).toBeVisible();
      record("click-to-inspector-update", performance.now() - started, "ms");

      const before = await documentNodeCount(page);
      await dragInsertContainer(page);
      started = performance.now();
      await expect
        .poll(() => documentNodeCount(page), { intervals: [10] })
        .toBe(before + 1);
      record("drop-to-node-rendered", performance.now() - started, "ms");

      expect(coldMs).toBeLessThan(30_000);
      expect(warmMs).toBeLessThan(30_000);
      expect(workingSetMb).toBeLessThan(2_048);
    } finally {
      await launched.dispose();
    }
  } finally {
    await removeDir(profile);
  }
});
