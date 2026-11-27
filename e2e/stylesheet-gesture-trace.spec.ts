import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { gotoApp } from "./support/gotoApp";
import { selectOnCanvas } from "./support/inspector";
import { importDocument } from "./support/parityFixtures";
import type { EditorElementNode } from "../src/features/editor/types/document";

/*
 * BC-17.3 — frame-by-frame traces of the live gesture override contract
 * (BC-17.1.3 Report 1 §8.11) in a real browser. A requestAnimationFrame
 * sampler records, every frame, the element's box, whether it paints the
 * inline override, and how many insertRule/deleteRule calls the generated
 * document sheet has received. Checked:
 * - zero sheet mutations while the pointer moves;
 * - the element follows the gesture every frame;
 * - on commit, no frame ever paints the pre-gesture geometry again (the
 *   sheet is updated before the override is removed), and once the
 *   override is gone the box stays exactly where the gesture ended;
 * - on Escape, the element returns exactly, the override is removed and
 *   the sheet was never touched.
 * Traces are written to test-results/bc17-3-trace/ for the report.
 */

interface Frame {
  t: number;
  x: number;
  y: number;
  width: number;
  height: number;
  override: string | null;
  mutations: number;
  background: string;
}

declare global {
  interface Window {
    __lyTrace: {
      mutations: number;
      frames: Frame[];
      start(id: string): void;
      stop(): Frame[];
    };
  }
}

const SURFACE = "[data-document-surface]";
const node = (page: Page, id: string) =>
  page.locator(`${SURFACE} [data-node-id="${id}"]`);

const fixture: EditorElementNode = {
  id: "page-root",
  tag: "page",
  children: [
    {
      id: "free",
      tag: "div",
      layoutMode: "free",
      displayName: "Free",
      dimensions: {
        preferredWidth: 600,
        preferredHeight: 500,
        offsetX: 0,
        offsetY: 0,
      },
      children: [
        {
          id: "mover",
          tag: "p",
          text: "mover",
          displayName: "mover",
          freeLayout: { x: 60, y: 60, width: 120, height: 40 },
          background: { color: "#3b82f6" },
        },
      ],
    },
    {
      id: "flowp",
      tag: "p",
      text: "Flow paragraph",
      displayName: "FlowPara",
      background: { color: "#22c55e" },
    },
    {
      id: "grad",
      tag: "div",
      displayName: "GradBox",
      dimensions: {
        preferredWidth: 300,
        preferredHeight: 120,
        offsetX: 0,
        offsetY: 0,
      },
    },
  ],
};

async function installTracer(page: Page) {
  await page.addInitScript(() => {
    const isDocumentSheet = (sheet: CSSStyleSheet) =>
      sheet.ownerNode instanceof HTMLStyleElement &&
      sheet.ownerNode.hasAttribute("data-ly-document-styles");
    const insert = CSSStyleSheet.prototype.insertRule;
    const remove = CSSStyleSheet.prototype.deleteRule;
    const trace = {
      mutations: 0,
      frames: [] as Frame[],
      running: false,
      start: (id: string) => void id,
      stop: (): Frame[] => [],
    };
    CSSStyleSheet.prototype.insertRule = function (
      this: CSSStyleSheet,
      rule: string,
      index?: number,
    ) {
      if (isDocumentSheet(this)) trace.mutations += 1;
      return insert.call(this, rule, index);
    };
    CSSStyleSheet.prototype.deleteRule = function (
      this: CSSStyleSheet,
      index: number,
    ) {
      if (isDocumentSheet(this)) trace.mutations += 1;
      return remove.call(this, index);
    };
    trace.start = (id: string) => {
      trace.frames = [];
      trace.running = true;
      const sample = (t: number) => {
        if (!trace.running) return;
        const element = document.querySelector(
          `[data-document-surface] [data-node-id="${id}"]`,
        );
        if (element) {
          const box = element.getBoundingClientRect();
          trace.frames.push({
            t,
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
            override: element.getAttribute("data-ly-gesture-override"),
            mutations: trace.mutations,
            background: getComputedStyle(element).backgroundImage,
          });
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    };
    trace.stop = () => {
      trace.running = false;
      return trace.frames;
    };
    window.__lyTrace = trace;
  });
}

const close = (a: number, b: number) => Math.abs(a - b) <= 0.5;
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

/**
 * After commit: every frame without the override paints one identical box
 * (the committed geometry, from the sheet), and the hand-off moved forward —
 * the final pointer input may land in the same frame as the release, but the
 * box never moves back toward where the gesture started.
 */
function expectStableCommit(
  frames: Frame[],
  start: { x: number; y: number; width: number; height: number },
  measure: (frame: Frame) => number,
) {
  const lastLive = frames.findLastIndex((frame) => frame.override !== null);
  const after = frames.slice(lastLive + 1);
  expect(after.length).toBeGreaterThan(0);
  const final = after[0];
  for (const frame of after) {
    expect(frame.override).toBeNull();
    expect(
      close(frame.x, final.x) &&
        close(frame.y, final.y) &&
        close(frame.width, final.width) &&
        close(frame.height, final.height),
      `frame at ${frame.t} moved after commit`,
    ).toBe(true);
  }
  expect(measure(final)).toBeGreaterThanOrEqual(
    measure(frames[lastLive]) - 0.5,
  );
  return final;
}

/** One pointer step per rendered frame, so every engine (WebKit here is frame-starved) traces every step. */
async function step(page: Page, x: number, y: number) {
  await page.mouse.move(x, y);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  );
}

async function settle(page: Page) {
  // A few frames after the last input, so the trace includes the frames after commit/cancel.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
        ),
      ),
  );
}

function save(name: string, data: unknown) {
  mkdirSync("test-results/bc17-3-trace", { recursive: true });
  writeFileSync(
    `test-results/bc17-3-trace/${name}.json`,
    JSON.stringify(data, null, 2),
  );
}

test.beforeEach(async ({ page }) => {
  await installTracer(page);
  await gotoApp(page);
  await importDocument(page, fixture, "mover");
});

test("Free drag, committed: zero sheet mutations while moving, no frame paints the old geometry, the box stays put when the override goes", async ({
  page,
}, testInfo) => {
  const start = (await node(page, "mover").boundingBox())!;
  await page.evaluate(() => window.__lyTrace.start("mover"));
  await page.mouse.move(start.x + 20, start.y + 20);
  await page.mouse.down();
  for (let n = 1; n <= 30; n += 1)
    await step(page, start.x + 20 + n * 4, start.y + 20 + n * 2);
  const beforeUp = await page.evaluate(() => window.__lyTrace.mutations);
  await page.mouse.up();
  await settle(page);
  const frames = await page.evaluate(() => window.__lyTrace.stop());
  save(`free-drag-commit-${testInfo.project.name}`, { start, frames });

  const live = frames.filter((frame) => frame.override !== null);
  expect(live.length).toBeGreaterThan(5);
  // Zero sheet mutations while the pointer moved.
  expect(live.every((frame) => frame.mutations === frames[0].mutations)).toBe(
    true,
  );
  expect(beforeUp).toBe(frames[0].mutations);
  // The element followed the gesture.
  expect(live.at(-1)!.x - start.x).toBeGreaterThan(100);
  // After the first live frame, no frame ever returns to the start geometry.
  const firstMoved = frames.findIndex((frame) => !close(frame.x, start.x));
  for (const frame of frames.slice(firstMoved))
    expect(
      close(frame.x, start.x) && close(frame.y, start.y),
      `frame at ${frame.t} jumped back`,
    ).toBe(false);
  // After the override is gone, one stable box from the sheet.
  expectStableCommit(frames, start, (frame) => distance(frame, start));
  // The commit touched only the moved node's own rule(s).
  expect(frames.at(-1)!.mutations - frames[0].mutations).toBeGreaterThan(0);
  expect(frames.at(-1)!.mutations - frames[0].mutations).toBeLessThanOrEqual(4);
});

test("Free drag, Escape: exact restore, no override left, the sheet never touched", async ({
  page,
}, testInfo) => {
  const start = (await node(page, "mover").boundingBox())!;
  await page.evaluate(() => window.__lyTrace.start("mover"));
  await page.mouse.move(start.x + 20, start.y + 20);
  await page.mouse.down();
  for (let n = 1; n <= 20; n += 1)
    await step(page, start.x + 20 + n * 5, start.y + 20 + n * 3);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await settle(page);
  const frames = await page.evaluate(() => window.__lyTrace.stop());
  save(`free-drag-cancel-${testInfo.project.name}`, { start, frames });

  expect(frames.some((frame) => frame.override !== null)).toBe(true);
  expect(frames.every((frame) => frame.mutations === frames[0].mutations)).toBe(
    true,
  );
  const last = frames.at(-1)!;
  expect(last.override).toBeNull();
  expect(
    close(last.x, start.x) &&
      close(last.y, start.y) &&
      close(last.width, start.width) &&
      close(last.height, start.height),
  ).toBe(true);
  expect(await node(page, "mover").getAttribute("style")).toBeFalsy();
});

test("Free resize, committed: zero mutations while resizing, the size never snaps back", async ({
  page,
}, testInfo) => {
  await node(page, "mover").click();
  const start = (await node(page, "mover").boundingBox())!;
  await expect(page.locator('[data-resize-handle="se"]')).toBeVisible();
  const handle = (await page
    .locator('[data-resize-handle="se"]')
    .boundingBox())!;
  await page.evaluate(() => window.__lyTrace.start("mover"));
  await page.mouse.move(
    handle.x + handle.width / 2,
    handle.y + handle.height / 2,
  );
  await page.mouse.down();
  for (let n = 1; n <= 25; n += 1)
    await step(
      page,
      handle.x + handle.width / 2 + n * 3,
      handle.y + handle.height / 2 + n * 2,
    );
  await page.mouse.up();
  await settle(page);
  const frames = await page.evaluate(() => window.__lyTrace.stop());
  save(`free-resize-commit-${testInfo.project.name}`, { start, frames });

  const live = frames.filter((frame) => frame.override !== null);
  expect(live.length).toBeGreaterThan(5);
  expect(live.every((frame) => frame.mutations === frames[0].mutations)).toBe(
    true,
  );
  expect(live.at(-1)!.width - start.width).toBeGreaterThan(40);
  const firstGrown = frames.findIndex(
    (frame) => !close(frame.width, start.width),
  );
  for (const frame of frames.slice(firstGrown))
    expect(
      close(frame.width, start.width),
      `frame at ${frame.t} snapped back`,
    ).toBe(false);
  expectStableCommit(frames, start, (frame) => frame.width);
});

test("Flow resize (flow-size slice), committed and then cancelled: the same contract", async ({
  page,
}, testInfo) => {
  await node(page, "flowp").click();
  const start = (await node(page, "flowp").boundingBox())!;
  await expect(page.locator('[data-resize-handle="e"]')).toBeVisible();
  const handle = (await page
    .locator('[data-resize-handle="e"]')
    .boundingBox())!;
  await page.evaluate(() => window.__lyTrace.start("flowp"));
  await page.mouse.move(
    handle.x + handle.width / 2,
    handle.y + handle.height / 2,
  );
  await page.mouse.down();
  for (let n = 1; n <= 20; n += 1)
    await step(
      page,
      handle.x + handle.width / 2 - n * 6,
      handle.y + handle.height / 2,
    );
  await page.mouse.up();
  await settle(page);
  const frames = await page.evaluate(() => window.__lyTrace.stop());
  save(`flow-resize-commit-${testInfo.project.name}`, { start, frames });

  const live = frames.filter((frame) => frame.override !== null);
  expect(live.length).toBeGreaterThan(5);
  expect(
    live.every(
      (frame) =>
        frame.override === "flow-size" &&
        frame.mutations === frames[0].mutations,
    ),
  ).toBe(true);
  expect(start.width - live.at(-1)!.width).toBeGreaterThan(60);
  expectStableCommit(frames, start, (frame) => -frame.width);

  // Now cancel one: back to the committed width, nothing written to the sheet.
  const committed = (await node(page, "flowp").boundingBox())!;
  await expect(page.locator('[data-resize-handle="e"]')).toBeVisible();
  const handle2 = (await page
    .locator('[data-resize-handle="e"]')
    .boundingBox())!;
  await page.evaluate(() => window.__lyTrace.start("flowp"));
  await page.mouse.move(
    handle2.x + handle2.width / 2,
    handle2.y + handle2.height / 2,
  );
  await page.mouse.down();
  for (let n = 1; n <= 10; n += 1)
    await step(
      page,
      handle2.x + handle2.width / 2 - n * 6,
      handle2.y + handle2.height / 2,
    );
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await settle(page);
  const cancelFrames = await page.evaluate(() => window.__lyTrace.stop());
  save(`flow-resize-cancel-${testInfo.project.name}`, {
    start: committed,
    frames: cancelFrames,
  });
  expect(
    cancelFrames.every(
      (frame) => frame.mutations === cancelFrames[0].mutations,
    ),
  ).toBe(true);
  expect(close(cancelFrames.at(-1)!.width, committed.width)).toBe(true);
  expect(cancelFrames.at(-1)!.override).toBeNull();
});

test("gradient stop drag (background-image slice): zero sheet mutations while dragging, the committed gradient is the last live one", async ({
  page,
}, testInfo) => {
  await selectOnCanvas(page, "grad");
  const header = page
    .getByRole("button", { name: "Background", exact: true })
    .first();
  const section = page.locator(
    `[aria-labelledby="${await header.getAttribute("id")}"]`,
  );
  await section.getByRole("button", { name: "Gradient", exact: true }).click();
  const stop = page.locator('[aria-label^="Gradient stop:"]').last();
  await expect(stop).toBeVisible();
  const box = (await stop.boundingBox())!;
  await page.evaluate(() => window.__lyTrace.start("grad"));
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let n = 1; n <= 15; n += 1)
    await step(page, box.x + box.width / 2 - n * 6, box.y + box.height / 2);
  await page.mouse.up();
  await settle(page);
  const frames = await page.evaluate(() => window.__lyTrace.stop());
  save(`gradient-stop-commit-${testInfo.project.name}`, { frames });

  const live = frames.filter((frame) => frame.override !== null);
  expect(live.length).toBeGreaterThan(5);
  expect(
    live.every(
      (frame) =>
        frame.override === "background-image" &&
        frame.mutations === frames[0].mutations,
    ),
  ).toBe(true);
  // The gradient changed live (inline), while the sheet still held the committed one.
  expect(new Set(live.map((frame) => frame.background)).size).toBeGreaterThan(
    1,
  );
  const after = frames.slice(
    frames.findLastIndex((frame) => frame.override !== null) + 1,
  );
  expect(after.length).toBeGreaterThan(0);
  for (const frame of after) {
    expect(frame.override).toBeNull();
    expect(frame.background).toBe(after[0].background);
  }
  expect(after[0].background).not.toBe(frames[0].background);
  expect(frames.at(-1)!.mutations).toBeGreaterThan(frames[0].mutations);
});
