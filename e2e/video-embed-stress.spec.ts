import { expect, test, type Page } from "@playwright/test";
import type { EditorElementNode } from "../src/features/editor/types/document";
import { gotoApp } from "./support/gotoApp";
import { importDocument } from "./support/parityFixtures";

/**
 * BC-08.3 / BC-08.3.1 — embedded-frame lifecycle under repetition
 * (Chromium: heap figures need the DevTools protocol). Eight Video Embeds
 * (two Vimeo with encrypted-media) and two generic Embeds, some nested
 * inside a toggled container; 20 Preview round trips and 30 show/hide
 * cycles, against local fake pages on the exact provider hosts and on a
 * generic widget host. Asserted: live player and frame counts return to their expected
 * values every time, requests grow only by the players actually mounted,
 * window listeners do not accumulate, nothing is requested in Design.
 * Heap and timings are printed, not asserted.
 */

test.skip(({ browserName }) => browserName !== "chromium", "heap figures and forced GC need Chromium's DevTools protocol");

const YT = "dQw4w9WgXcQ";
const SURFACE = "[data-document-surface]";
const FAKE_PLAYER = "<!doctype html><title>fake player</title><p>player</p>";

const video = (id: string, src: string): EditorElementNode => ({ id, tag: "iframe", controls: true, muted: true, autoplay: true, aspectRatio: { mode: "ratio", width: 16, height: 9 }, src });

function stressDocument(): EditorElementNode {
  const yt = (n: number) => `https://www.youtube-nocookie.com/embed/${YT}?start=${n}`;
  return {
    id: "page-root",
    tag: "page",
    children: [
      { id: "btn-toggle", tag: "button", text: "Toggle", interactions: [{ id: "i-t", trigger: "click", action: "toggle", targetId: "box" }] },
      {
        id: "box",
        tag: "div",
        children: [
          video("s-1", yt(1)),
          { id: "nest", tag: "div", children: [video("s-2", yt(2)), { id: "nest-2", tag: "section", children: [video("s-3", "https://fast.wistia.net/embed/iframe/26sk4lmiix?doNotTrack=true&time=3"), { id: "g-1", tag: "iframe", src: "https://widget.example/g-1", title: "g-1" }] }] },
          video("v-1", "https://player.vimeo.com/video/76979871?dnt=1#t=1s"),
        ],
      },
      video("s-4", yt(4)),
      video("s-5", `https://www.loom.com/embed/${"a".repeat(32)}?t=5s`),
      video("s-6", "https://fast.wistia.net/embed/iframe/26sk4lmiix?doNotTrack=true&time=6"),
      video("v-2", "https://player.vimeo.com/video/76979872?dnt=1"),
      { id: "g-2", tag: "iframe", src: "https://widget.example/g-2", title: "g-2" },
    ],
  };
}

async function heapMb(page: Page): Promise<number> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("HeapProfiler.collectGarbage");
  const { usedSize } = (await cdp.send("Runtime.getHeapUsage")) as { usedSize: number };
  await cdp.detach();
  return usedSize / (1024 * 1024);
}

const players = (page: Page) => page.locator(`${SURFACE} iframe[data-video-embed-player]`);
const providerFrames = (page: Page) => page.frames().filter((frame) => /^https:\/\/(www\.youtube-nocookie\.com|player\.vimeo\.com|www\.loom\.com|fast\.wistia\.net)\//.test(frame.url())).length;
const genericFrames = (page: Page) => page.frames().filter((frame) => frame.url().startsWith("https://widget.example/")).length;

test("20 Preview sessions and 30 show/hide cycles leave no stale players, frames or listeners", async ({ page, context }) => {
  test.setTimeout(300_000);
  const requests: string[] = [];
  const genericRequests: string[] = [];
  await context.route(
    (url) => /(^|\.)(youtube-nocookie\.com|vimeo\.com|loom\.com|wistia\.net|widget\.example)$/.test(url.hostname),
    (route) => {
      const url = route.request().url();
      (url.startsWith("https://widget.example/") ? genericRequests : requests).push(url);
      return route.fulfill({ contentType: "text/html", body: FAKE_PLAYER });
    },
  );
  await page.addInitScript(() => {
    const counts = { added: 0, removed: 0 };
    Reflect.set(window, "__bc083", counts);
    const add = window.addEventListener.bind(window);
    const remove = window.removeEventListener.bind(window);
    window.addEventListener = ((...args: Parameters<typeof add>) => {
      counts.added += 1;
      add(...args);
    }) as typeof window.addEventListener;
    window.removeEventListener = ((...args: Parameters<typeof remove>) => {
      counts.removed += 1;
      remove(...args);
    }) as typeof window.removeEventListener;
  });
  await page.setViewportSize({ width: 1600, height: 3000 });
  await gotoApp(page);
  await importDocument(page, stressDocument(), "g-2");
  expect(requests, "Design requests nothing from video providers").toEqual([]);
  await expect.poll(() => genericFrames(page), { message: "generic Embeds are live in Design, as before" }).toBe(2);
  const genericAtStart = genericRequests.length;
  const listeners = async () => page.evaluate(() => { const c = Reflect.get(window, "__bc083") as { added: number; removed: number }; return c.added - c.removed; });
  const heapStart = await heapMb(page);
  const listenersStart = await listeners();

  const startTimes: number[] = [];
  for (let session = 0; session < 20; session += 1) {
    const started = Date.now();
    await page.getByRole("button", { name: "Enter Preview" }).click();
    await expect(players(page)).toHaveCount(8);
    startTimes.push(Date.now() - started);
    await page.getByRole("button", { name: "Exit Preview" }).focus();
    await page.keyboard.press("Enter");
    await expect(players(page)).toHaveCount(0);
  }
  await expect.poll(() => providerFrames(page)).toBe(0);
  await expect.poll(() => genericFrames(page)).toBe(2);
  const afterSessions = requests.length;
  expect(afterSessions, "each session mounts exactly eight players").toBe(160);
  // Each generic Embed: a fresh Preview frame on entry and a fresh Design frame on exit.
  await expect.poll(() => genericRequests.length - genericAtStart).toBe(20 * 2 * 2);
  const genericAfterSessions = genericRequests.length;
  const heapAfterSessions = await heapMb(page);

  await page.getByRole("button", { name: "Enter Preview" }).click();
  await expect(players(page)).toHaveCount(8);
  for (let cycle = 0; cycle < 30; cycle += 1) {
    await page.locator(`${SURFACE} [data-node-id="btn-toggle"]`).click();
    await expect(players(page)).toHaveCount(4);
    await expect.poll(() => genericFrames(page)).toBe(1);
    await page.locator(`${SURFACE} [data-node-id="btn-toggle"]`).click();
    await expect(players(page)).toHaveCount(8);
  }
  await expect.poll(() => providerFrames(page)).toBe(8);
  await expect.poll(() => genericFrames(page)).toBe(2);
  expect(requests.length - afterSessions, "entry (8) plus four re-mounted players per cycle").toBe(8 + 30 * 4);
  await expect.poll(() => genericRequests.length - genericAfterSessions, { message: "entry (2) plus one re-mounted generic frame per cycle" }).toBe(2 + 30);
  await page.getByRole("button", { name: "Exit Preview" }).focus();
  await page.keyboard.press("Enter");
  await expect(players(page)).toHaveCount(0);
  await expect.poll(() => providerFrames(page)).toBe(0);
  await expect.poll(() => genericFrames(page)).toBe(2);

  const listenerDelta = (await listeners()) - listenersStart;
  expect(Math.abs(listenerDelta), "window listeners added and not removed").toBeLessThanOrEqual(2);
  const heapEnd = await heapMb(page);
  const median = [...startTimes].sort((a, b) => a - b)[Math.floor(startTimes.length / 2)];
  process.stdout.write(
    `\n[BC-08.3.1 stress] 20 Preview sessions x 8 players + 2 generic: median entry-to-8-players ${median} ms (max ${Math.max(...startTimes)} ms); ` +
      `provider requests ${requests.length} (Design 0), generic requests ${genericRequests.length}; frames now: provider ${providerFrames(page)}, generic ${genericFrames(page)}; net window listeners ${listenerDelta}; heap ${heapStart.toFixed(1)} -> ${heapAfterSessions.toFixed(1)} (after sessions) -> ${heapEnd.toFixed(1)} MB (after 30 cycles, GC)\n`,
  );
});
