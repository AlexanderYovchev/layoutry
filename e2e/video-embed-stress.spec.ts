import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { EditorElementNode } from "../src/features/editor/types/document";
import { gotoApp } from "./support/gotoApp";
import { importDocument } from "./support/parityFixtures";

/**
 * BC-08.3 / BC-08.3.1 — embedded-frame lifecycle under repetition
 * (Chromium: heap figures need the DevTools protocol). Eight Video Embeds
 * (two Vimeo with encrypted-media) and two generic Embeds, some nested
 * inside a toggled container; 25 Preview round trips (BC-08.5; 20 before)
 * and 30 show/hide cycles (60 transitions), then 10 website ZIP exports
 * (BC-08.5: byte-identical, no provider request, no leaked download URL), against local fake pages on the exact provider hosts and on a
 * generic widget host. Asserted: live player and frame counts return to their expected
 * values every time, requests grow only by the players actually mounted,
 * window listeners do not accumulate, nothing is requested in Design.
 * Heap and timings are printed, not asserted.
 */

test.skip(({ browserName }) => browserName !== "chromium", "heap figures and forced GC need Chromium's DevTools protocol");

const YT = "dQw4w9WgXcQ";
const SURFACE = "[data-document-surface]";
// An uploaded image makes the Separate-files export a website ZIP (BC-07.3).
const PNG = `data:image/png;base64,${readFileSync(path.join(process.cwd(), "test", "fixtures", "images", "upload-40x30.png")).toString("base64")}`;
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
      { id: "img-upload", tag: "img", src: PNG, displayName: "Uploaded" },
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

test("25 Preview sessions, 30 show/hide cycles and 10 exports leave no stale players, frames, listeners or URLs", async ({ page, context }) => {
  test.setTimeout(600_000);
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
  const SESSIONS = 25;
  for (let session = 0; session < SESSIONS; session += 1) {
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
  expect(afterSessions, "each session mounts exactly eight players").toBe(SESSIONS * 8);
  // Each generic Embed: a fresh Preview frame on entry and a fresh Design frame on exit.
  await expect.poll(() => genericRequests.length - genericAtStart).toBe(SESSIONS * 2 * 2);
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
  const heapAfterCycles = await heapMb(page);

  // BC-08.5: repeated exports of the same page (Design mode, players absent).
  await page.evaluate(() => {
    const urls = { created: 0, revoked: 0 };
    Reflect.set(window, "__bc085urls", urls);
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (object: Blob | MediaSource) => { urls.created += 1; return create(object); };
    URL.revokeObjectURL = (url: string) => { urls.revoked += 1; revoke(url); };
  });
  const requestsBeforeExport = requests.length;
  await page.getByRole("button", { name: "Export Code" }).click();
  const dialog = page.getByRole("dialog", { name: "Export Code" });
  await expect(dialog.getByTestId("export-code")).toBeVisible();
  await dialog.getByLabel("Separate files").check();
  const zips: Buffer[] = [];
  const exportTimes: number[] = [];
  for (let cycle = 0; cycle < 10; cycle += 1) {
    const started = Date.now();
    const downloaded = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "Download website (.zip)" }).click();
    zips.push(readFileSync((await (await downloaded).path())!));
    exportTimes.push(Date.now() - started);
  }
  expect(new Set(zips.map((zip) => zip.toString("base64"))).size, "every export is byte-identical").toBe(1);
  expect(requests.length, "exporting loads no provider player").toBe(requestsBeforeExport);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  // Download URLs are revoked 10 s after each click.
  await page.waitForTimeout(10_500);
  const urls = await page.evaluate(() => Reflect.get(window, "__bc085urls") as { created: number; revoked: number });
  expect(urls.created - urls.revoked, "download URLs created and not revoked").toBe(0);
  await expect(players(page)).toHaveCount(0);
  await expect.poll(() => genericFrames(page)).toBe(2);
  const heapEnd = await heapMb(page);
  const exportMedian = [...exportTimes].sort((a, b) => a - b)[5];
  const median = [...startTimes].sort((a, b) => a - b)[Math.floor(startTimes.length / 2)];
  process.stdout.write(
    `\n[BC-08.5 stress] ${SESSIONS} Preview sessions x 8 players + 2 generic: median entry-to-8-players ${median} ms (max ${Math.max(...startTimes)} ms); ` +
      `provider requests ${requests.length} (Design 0), generic requests ${genericRequests.length}; frames now: provider ${providerFrames(page)}, generic ${genericFrames(page)}; net window listeners ${listenerDelta}; heap ${heapStart.toFixed(1)} -> ${heapAfterSessions.toFixed(1)} (after sessions) -> ${heapAfterCycles.toFixed(1)} MB (after 30 cycles) -> ${heapEnd.toFixed(1)} MB (after 10 exports, GC); 10 ZIP exports: ${zips[0].length} bytes each, identical, median ${exportMedian} ms (max ${Math.max(...exportTimes)} ms), object URLs ${urls.created} created / ${urls.revoked} revoked\n`,
  );
});
