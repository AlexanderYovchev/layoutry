import { expect, test, type Page } from "@playwright/test";
import {
  documentNodeCount,
  dragInsertContainer,
  launchLayoutry,
  makeTempDir,
  removeDir,
} from "./support/layoutryApp";

/**
 * Baseline measurements, not benchmarks: each number includes Playwright's
 * own launch and CDP overhead, runs once on whatever machine executes the
 * suite, and is recorded as a test annotation (visible in the list
 * reporter output). The assertions are deliberately generous ceilings
 * that only catch gross regressions such as a startup hang.
 */

test.describe.configure({ timeout: 180_000 });

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

async function roundTripMs(page: Page): Promise<number> {
  const samples: number[] = [];
  for (let i = 0; i < 15; i += 1) {
    const started = performance.now();
    await page.evaluate(() => 0);
    samples.push(performance.now() - started);
  }
  return median(samples);
}

test("records startup, memory and interaction baselines", async ({}, testInfo) => {
  const profile = await makeTempDir("layoutry-perf-");
  const record = (type: string, value: number, unit: string) => {
    const description = `${Math.round(value)} ${unit}`;
    testInfo.annotations.push({ type, description });
    console.log(`[desktop perf] ${type}: ${description}`);
  };

  try {
    // Cold-ish: brand-new profile (OS file caches may still be warm).
    let started = performance.now();
    let launched = await launchLayoutry({ userDataDir: profile });
    const coldMs = performance.now() - started;
    await launched.dispose();

    // Warm: same profile, second launch.
    started = performance.now();
    launched = await launchLayoutry({ userDataDir: profile });
    const warmMs = performance.now() - started;
    record("startup-cold-to-hydrated", coldMs, "ms");
    record("startup-warm-to-hydrated", warmMs, "ms");

    try {
      const { app, page } = launched;
      const memory = await app.evaluate(({ app: electronApp }) => {
        const metrics = electronApp.getAppMetrics();
        return {
          processes: metrics.length,
          workingSetKb: metrics.reduce(
            (sum, m) => sum + m.memory.workingSetSize,
            0,
          ),
          privateKb: metrics.reduce(
            (sum, m) => sum + (m.memory.privateBytes ?? 0),
            0,
          ),
        };
      });
      record("processes", memory.processes, "processes");
      record("memory-working-set-total", memory.workingSetKb / 1024, "MB");
      record("memory-private-total", memory.privateKb / 1024, "MB");

      const responsiveness = await roundTripMs(page);
      record("main-window-roundtrip-median", responsiveness, "ms");

      const inspector = page.getByRole("complementary", {
        name: "Inspector panel",
      });
      started = performance.now();
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
      expect(memory.workingSetKb / 1024).toBeLessThan(2_048);
      expect(responsiveness).toBeLessThan(500);
    } finally {
      await launched.dispose();
    }
  } finally {
    await removeDir(profile);
  }
});
