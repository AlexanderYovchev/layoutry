import { expect, test, type Locator } from "@playwright/test";
import {
  CLIP_FILE,
  TONE_FILE,
  clipBytes,
  toneBytes,
} from "../support/previewMedia";
import {
  hiddenMediaDocument,
  importDocument,
  motionDocument,
} from "../support/parityFixtures";
import {
  copyApp,
  launchLayoutry,
  removeDir,
  type LaunchedLayoutry,
} from "./support/layoutryApp";

/**
 * BC-02.5 in the real Electron window (offline; media from app:// in a copy
 * of the export): hidden media stops, the trigger's aria-expanded follows
 * the target, and authored motion follows prefers-reduced-motion, with
 * the app's security settings unchanged.
 */

let root: string;
let layoutry: LaunchedLayoutry;

test.beforeEach(async () => {
  const copy = await copyApp("layoutry-preview-parity", {
    [CLIP_FILE]: clipBytes(),
    [TONE_FILE]: toneBytes(),
  });
  root = copy.root;
  layoutry = await launchLayoutry({ appPath: copy.appDir });
});

test.afterEach(async () => {
  await layoutry?.dispose();
  if (root) await removeDir(root);
});

const surface = "[data-document-surface]";
const time = (media: Locator) =>
  media.evaluate((element: HTMLMediaElement) => element.currentTime);
const paused = (media: Locator) =>
  media.evaluate((element: HTMLMediaElement) => element.paused);

test("hiding a target stops its media and keeps its position; aria-expanded and aria-controls follow it", async () => {
  const { page } = layoutry;
  await importDocument(page, hiddenMediaDocument(""), "v-loop");
  const url = page.url();
  await page.getByRole("button", { name: "Enter Preview" }).click();
  const trigger = page.locator(`${surface} #b-panel`);
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  const panel = page.locator(`${surface} [data-node-id="d-panel"]`);
  const controls = await trigger.getAttribute("aria-controls");
  expect(controls).toMatch(/^ly-target-\d+$/);
  expect(await panel.getAttribute("id")).toBe(controls);

  const loop = page.locator(`${surface} #v-loop`);
  const auto = page.locator(`${surface} #v-auto`);
  await expect
    .poll(() =>
      auto.evaluate((element: HTMLMediaElement) => element.readyState),
    )
    .toBeGreaterThanOrEqual(3);
  await expect.poll(() => paused(auto)).toBe(false);
  await loop.click();
  expect(
    await loop.evaluate((element: HTMLMediaElement) =>
      element.play().then(
        () => "playing",
        (error: Error) => error.name,
      ),
    ),
  ).toBe("playing");
  await expect.poll(() => time(loop)).toBeGreaterThan(0.5);

  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  // Still in the DOM (so aria-controls stays valid), just not displayed.
  await expect(panel).toHaveCount(1);
  await expect(panel).toBeHidden();
  expect(await panel.getAttribute("id")).toBe(controls);
  await expect.poll(() => paused(loop)).toBe(true);
  await expect.poll(() => paused(auto)).toBe(true);
  const kept = await time(loop);
  expect(kept).toBeGreaterThan(0);

  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(panel).toBeVisible();
  // Ordinary media stays paused where it was; muted autoplay resumes.
  expect(await paused(loop)).toBe(true);
  expect(await time(loop)).toBeCloseTo(kept, 1);
  await expect.poll(() => paused(auto)).toBe(false);
  expect(page.url()).toBe(url);

  await page.getByRole("button", { name: "Exit Preview" }).click();
  await expect.poll(() => paused(auto)).toBe(true);
  await expect(page.locator(`${surface} [aria-expanded]`)).toHaveCount(0);
  await expect(page.locator(`${surface} [aria-controls]`)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeDisabled();
});

test("authored motion follows prefers-reduced-motion in the desktop Preview", async () => {
  const { page } = layoutry;
  await importDocument(page, motionDocument(), "d-motion");
  await page.getByRole("button", { name: "Enter Preview" }).click();
  const box = page.locator(`${surface} #d-motion`);
  const motion = () =>
    box.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        duration: style.transitionDuration,
        delay: style.transitionDelay,
      };
    });

  await page.emulateMedia({ reducedMotion: "no-preference" });
  expect(await motion()).toEqual({ duration: "0.5s", delay: "0.2s" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const reduced = await motion();
  expect(Number.parseFloat(reduced.duration)).toBeLessThan(0.001);
  expect(reduced.delay).toBe("0s");

  // Still operable with reduced motion.
  await page.getByRole("button", { name: "Toggle box" }).click();
  await expect(box).toBeHidden();
  await page.emulateMedia({ reducedMotion: null });
});
