import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  documentNodeCount,
  dragInsertContainer,
  REPO_ROOT,
} from "../desktop/support/layoutryApp";
import { releasePaths } from "../../desktop/packaging/releaseInfo.mjs";
import { extractedExe, launchPackaged } from "./support/packagedApp";
import {
  mainWindowState,
  processTree,
  resizeMainWindow,
} from "./support/windows";

/**
 * DESKTOP-0.5 stability session (opt-in: `npm run desktop:soak`, excluded
 * from the normal packaged run). Repeats a realistic editing cycle in the
 * packaged exe for LAYOUTRY_SOAK_MINUTES (default 20). Each cycle edits and
 * then undoes back to the starting document, so memory should stay flat:
 * steady growth would mean a leak, not a bigger document. Results go to
 * release/soak-results.json for the release manifest.
 */

const MINUTES = Number(process.env.LAYOUTRY_SOAK_MINUTES ?? "20");

test("@soak sustained editing session in the packaged app", async () => {
  test.setTimeout((MINUTES + 5) * 60_000);
  const launched = await launchPackaged(extractedExe());
  const { page, pid } = launched;
  const consoleErrors: string[] = [];
  let crashes = 0;
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(String(error)));
  page.on("crash", () => {
    crashes += 1;
  });

  const workingSetMb = () =>
    Math.round(
      processTree(pid).reduce(
        (sum, process) => sum + process.workingSetBytes,
        0,
      ) /
        1024 /
        1024,
    );
  const inspector = page.getByRole("complementary", {
    name: "Inspector panel",
  });
  const baseline = await documentNodeCount(page);
  // Visibility matters for interpreting timings: Chromium throttles timers
  // and animation frames of a window that is minimized or fully covered
  // by other windows, which slows automated input without any app fault.
  const visibility = () => page.evaluate(() => document.visibilityState);
  const sample = async (minute: number) => {
    const os = mainWindowState(pid);
    return {
      minute,
      mb: workingSetMb(),
      visibility: await visibility(),
      foreground: os.foreground,
      minimized: os.minimized,
    };
  };
  const memory = [await sample(0)];
  const iterationMs: number[] = [];
  const iterationVisibility: string[] = [];
  const started = Date.now();
  const deadline = started + MINUTES * 60_000;
  let nextSample = started + 60_000;
  let iteration = 0;
  let completedFullDuration = false;
  let failure: string | null = null;

  try {
    while (Date.now() < deadline) {
      iteration += 1;
      const begin = performance.now();

      // Insert, restyle, duplicate — then undo all three.
      await dragInsertContainer(page);
      await expect.poll(() => documentNodeCount(page)).toBe(baseline + 1);
      // Human pacing after a drop. At pure automation speed, interacting
      // immediately after a drop occasionally stops the NEXT library drag
      // from activating (the pointer makes a native text selection
      // instead) — recorded as a P3 editor finding in the DESKTOP-0.5 QA
      // report, not a packaging issue.
      await page.waitForTimeout(500);
      await page
        .locator('[data-document-surface] [data-node-id="heading-1"]')
        .click();
      const fontSize = inspector.getByLabel("Font size", { exact: true });
      await fontSize.fill(iteration % 2 ? "24" : "18");
      await fontSize.press("Enter");
      await page
        .locator('[data-document-surface] [data-node-id="paragraph-1"]')
        .click();
      await page.keyboard.press("Control+c");
      await page.keyboard.press("Control+v");
      await expect.poll(() => documentNodeCount(page)).toBe(baseline + 2);
      for (let undo = 0; undo < 3; undo += 1)
        await page.keyboard.press("Control+z");
      await expect.poll(() => documentNodeCount(page)).toBe(baseline);

      if (iteration % 5 === 0) {
        await page.getByRole("button", { name: "Enter Preview" }).click();
        await page.getByRole("button", { name: "Exit Preview" }).click();
      }
      if (iteration % 10 === 0) {
        resizeMainWindow(
          pid,
          iteration % 20 ? 1200 : 1440,
          iteration % 20 ? 760 : 900,
        );
      }
      iterationMs.push(Math.round(performance.now() - begin));
      iterationVisibility.push(await visibility());

      if (Date.now() >= nextSample) {
        memory.push(await sample(Math.round((Date.now() - started) / 60_000)));
        nextSample += 60_000;
      }
      expect(crashes, "renderer crashed").toBe(0);
    }
    memory.push(await sample(MINUTES));
    completedFullDuration = true;
  } catch (error) {
    // First line, without the terminal color codes Playwright adds.
    failure = String(error)
      .replace(new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g"), "")
      .split("\n")[0];
    throw error;
  } finally {
    const memoryStartMb = memory[0].mb;
    const memoryEndMb = memory[memory.length - 1].mb;
    const passed =
      completedFullDuration &&
      crashes === 0 &&
      consoleErrors.length === 0 &&
      iteration > MINUTES * 5 &&
      memoryEndMb < memoryStartMb * 2;
    const results = {
      passed,
      failure,
      plannedMinutes: MINUTES,
      elapsedMinutes: Math.round(((Date.now() - started) / 60_000) * 10) / 10,
      iterations: iteration,
      crashes,
      consoleErrors: consoleErrors.length,
      consoleErrorSamples: consoleErrors.slice(0, 5),
      memoryStartMb,
      memoryEndMb,
      memoryPeakMb: Math.max(...memory.map((sample) => sample.mb)),
      memory,
      iterationMs: {
        first10: iterationMs.slice(0, 10),
        last10: iterationMs.slice(-10),
        max: Math.max(...iterationMs, 0),
        median:
          [...iterationMs].sort((a, b) => a - b)[
            Math.floor(iterationMs.length / 2)
          ] ?? 0,
        // Iterations slower than 5 s, split by whether the page was visible.
        slowWhileVisible: iterationMs.filter(
          (ms, index) => ms > 5_000 && iterationVisibility[index] === "visible",
        ).length,
        slowWhileHidden: iterationMs.filter(
          (ms, index) => ms > 5_000 && iterationVisibility[index] !== "visible",
        ).length,
        hiddenIterations: iterationVisibility.filter(
          (state) => state !== "visible",
        ).length,
        all: iterationMs,
      },
    };
    await writeFile(
      path.join(releasePaths(REPO_ROOT).releaseDir, "soak-results.json"),
      `${JSON.stringify(results, null, 2)}\n`,
    );
    console.log("[soak]", JSON.stringify(results));
    await launched.dispose();
  }

  expect(crashes).toBe(0);
  expect(consoleErrors).toEqual([]);
  expect(iteration).toBeGreaterThan(MINUTES * 5);
  // Generous leak guard: a flat document must not double its footprint.
  expect(memory[memory.length - 1].mb).toBeLessThan(memory[0].mb * 2);
});
