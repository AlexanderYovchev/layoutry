import fs from "node:fs";
import path from "node:path";
import { expect, test, type CDPSession, type Page } from "@playwright/test";
import { gotoApp } from "../support/gotoApp";
import { importDocument } from "../support/parityFixtures";
import { perfDocument } from "../support/perfFixtures";

/*
 * BC-17.3 — performance baseline/after measurement for the shared
 * stylesheet pipeline. Opt-in (LAYOUTRY_PERF=1), Chromium, production
 * build: the same 1,000-element document and the same input sequences
 * before and after the pipeline switch. Results are written to
 * test-results/bc17-3-perf/<label>.json. Not part of the default suite.
 *
 * Fixture: a Free container (760 × 2,600) with 999 Free children in a
 * 20-column grid — paragraphs, buttons and boxes with typography,
 * background, border, radius and shadow — so every element carries real
 * authored CSS and default presentations.
 */

test.skip(
  !process.env.LAYOUTRY_PERF,
  "opt-in performance measurement (LAYOUTRY_PERF=1)",
);

const LABEL = process.env.LAYOUTRY_PERF_LABEL ?? "run";
const OUT = path.join("test-results", "bc17-3-perf");
const SURFACE = "[data-document-surface]";

type Metrics = Record<string, number>;
async function metrics(cdp: CDPSession): Promise<Metrics> {
  const { metrics: list } = await cdp.send("Performance.getMetrics");
  return Object.fromEntries(list.map((entry) => [entry.name, entry.value]));
}
function delta(before: Metrics, after: Metrics) {
  const keys = [
    "TaskDuration",
    "ScriptDuration",
    "RecalcStyleDuration",
    "LayoutDuration",
    "RecalcStyleCount",
    "LayoutCount",
  ];
  return Object.fromEntries(
    keys.map((key) => [
      key,
      key.endsWith("Count")
        ? after[key] - before[key]
        : (after[key] - before[key]) * 1000,
    ]),
  );
}
const stats = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return {
    samples: values.length,
    median: at(0.5),
    p95: at(0.95),
    max: sorted.at(-1),
  };
};

/** Records rAF frame intervals and per-frame main-thread time between start/stop. */
async function startFrames(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as {
      __frames: number[];
      __stopFrames: boolean;
    };
    w.__frames = [];
    w.__stopFrames = false;
    let last = performance.now();
    const tick = (now: number) => {
      w.__frames.push(now - last);
      last = now;
      if (!w.__stopFrames) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
async function stopFrames(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const w = window as unknown as {
      __frames: number[];
      __stopFrames: boolean;
    };
    w.__stopFrames = true;
    return w.__frames.slice(1);
  });
}

/** Counts stylesheet mutations (style elements, CSSOM rule changes) while the callback runs. */
async function startSheetMutationCount(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __sheetMutations: number };
    w.__sheetMutations = 0;
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        const target =
          record.target instanceof Element
            ? record.target
            : record.target.parentElement;
        if (target?.closest("style")) w.__sheetMutations += 1;
      }
    });
    observer.observe(document.head, {
      subtree: true,
      childList: true,
      characterData: true,
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });
    const proto = CSSStyleSheet.prototype;
    for (const name of ["insertRule", "deleteRule", "replaceSync"] as const) {
      const original = proto[name] as (...args: unknown[]) => unknown;
      Object.defineProperty(proto, name, {
        configurable: true,
        value(this: CSSStyleSheet, ...args: unknown[]) {
          w.__sheetMutations += 1;
          return original.apply(this, args);
        },
      });
    }
  });
}

test("1,000-element pipeline measurements", async ({ browser }) => {
  test.setTimeout(600_000);
  const result: Record<string, unknown> = { label: LABEL };

  // Initial document rendering (import → visible): 5 samples, each in a fresh context (empty project library).
  const imports: number[] = [];
  const importMetrics: unknown[] = [];
  let page!: Page;
  let cdp!: CDPSession;
  for (let run = 0; run < 5; run += 1) {
    if (run > 0) await page.context().close();
    page = await (
      await browser.newContext({ viewport: { width: 1600, height: 1000 } })
    ).newPage();
    cdp = await page.context().newCDPSession(page);
    await cdp.send("Performance.enable");
    await gotoApp(page);
    await startSheetMutationCount(page);
    result.userAgent = await page.evaluate(() => navigator.userAgent);
    const before = await metrics(cdp);
    const start = Date.now();
    await importDocument(page, perfDocument(), "n-210");
    await expect(
      page.locator(`${SURFACE} [data-node-id="n-998"]`),
    ).toBeAttached();
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    imports.push(Date.now() - start);
    importMetrics.push(delta(before, await metrics(cdp)));
  }
  result.initialRender = { wallMs: stats(imports), metrics: importMetrics };

  const target = page.locator(`${SURFACE} [data-node-id="n-210"]`);
  await target.click();

  async function gesture(
    name: string,
    from: { x: number; y: number },
    steps: number,
    dx: number,
    dy: number,
  ) {
    const samples: unknown[] = [];
    const frames: number[] = [];
    const mutations: number[] = [];
    for (let run = 0; run < 5; run += 1) {
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(from.x + 2, from.y + 2);
      await page.evaluate(
        () =>
          ((
            window as unknown as { __sheetMutations: number }
          ).__sheetMutations = 0),
      );
      await startFrames(page);
      const before = await metrics(cdp);
      for (let step = 1; step <= steps; step += 1)
        await page.mouse.move(
          from.x + 2 + (dx * step) / steps,
          from.y + 2 + (dy * step) / steps,
        );
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      const after = await metrics(cdp);
      frames.push(...(await stopFrames(page)));
      mutations.push(
        await page.evaluate(
          () =>
            (window as unknown as { __sheetMutations: number })
              .__sheetMutations,
        ),
      );
      const perStep = delta(before, after);
      samples.push(
        Object.fromEntries(
          Object.entries(perStep).map(([key, value]) => [
            key,
            key.endsWith("Count") ? value : value / steps,
          ]),
        ),
      );
      await page.keyboard.press("Escape");
      await page.mouse.up();
    }
    result[name] = {
      perStepMainThreadMs: samples,
      frameIntervalMs: stats(frames),
      sheetMutationsDuringMove: mutations,
    };
  }

  const box = (await target.boundingBox())!;
  await gesture(
    "freeDrag",
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    60,
    120,
    80,
  );
  await target.click();
  const handle = page.locator('[data-resize-handle="se"]');
  await expect(handle).toBeVisible();
  const handleBox = (await handle.boundingBox())!;
  await gesture(
    "freeResize",
    {
      x: handleBox.x + handleBox.width / 2,
      y: handleBox.y + handleBox.height / 2,
    },
    60,
    60,
    40,
  );

  // Single committed geometry edit: an arrow-key nudge, keydown → next painted frame.
  await target.click();
  await page.evaluate(() => {
    const w = window as unknown as { __nudges: number[] };
    w.__nudges = [];
    window.addEventListener(
      "keydown",
      () => {
        const start = performance.now();
        requestAnimationFrame(() =>
          setTimeout(() => w.__nudges.push(performance.now() - start), 0),
        );
      },
      { capture: true },
    );
  });
  // One committed drag, then Undo/Redo it 15 times each: a single-node
  // committed geometry edit (keydown → next frame), verified by position.
  const start = (await target.boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  for (let step = 1; step <= 10; step += 1)
    await page.mouse.move(
      start.x + start.width / 2 + step * 4,
      start.y + start.height / 2,
    );
  await page.mouse.up();
  const committedLeft = await target.evaluate(
    (element) => getComputedStyle(element).left,
  );
  await page.evaluate(
    () => ((window as unknown as { __nudges: number[] }).__nudges = []),
  );
  const lefts: string[] = [];
  for (let run = 0; run < 30; run += 1) {
    await page.keyboard.press(run % 2 === 0 ? "Control+z" : "Control+Shift+z");
    await page.waitForTimeout(50);
    lefts.push(
      await target.evaluate((element) => getComputedStyle(element).left),
    );
  }
  result.undoRedoLatencyMs = {
    ...stats(
      await page.evaluate(
        () => (window as unknown as { __nudges: number[] }).__nudges,
      ),
    ),
    committedLeft,
    lefts: [...new Set(lefts)],
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(
    path.join(OUT, `${LABEL}.json`),
    JSON.stringify(result, null, 2),
  );
});
