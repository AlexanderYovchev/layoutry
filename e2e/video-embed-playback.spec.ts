import { expect, test, type BrowserContext, type Frame, type Page } from "@playwright/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { EditorElementNode } from "../src/features/editor/types/document";
import { exportHtmlCss } from "../src/features/export/utils/exportHtmlCss";
import { gotoApp } from "./support/gotoApp";
import { canvasNode, expectUndoAvailable } from "./support/inspector";
import { importDocument } from "./support/parityFixtures";

/**
 * BC-08.3 — Video Embed playback in Preview and on exported pages, fully
 * deterministic and offline. Every request to a video provider is routed:
 * the exact embed hosts get a local FAKE player page (it reports its URL,
 * Referer and fullscreen permission, and can request fullscreen), every
 * other provider host is aborted and recorded as unexpected. Exported
 * pages are served from a real loopback server (frames inside a
 * route-fulfilled page never load). Real providers: the opt-in
 * e2e/live/video-embed-live.spec.ts.
 */

const YT = "dQw4w9WgXcQ";
const LOOM = "0123456789abcdef0123456789abcdef";
const WISTIA = "26sk4lmiix";
const SURFACE = "[data-document-surface]";
const EMBED_HOSTS = new Set(["www.youtube-nocookie.com", "www.youtube.com", "player.vimeo.com", "www.loom.com", "fast.wistia.net", "widget.example"]);
const PROVIDER_HOSTS = /(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be|ytimg\.com|googlevideo\.com|vimeo\.com|vimeocdn\.com|loom\.com|wistia\.(com|net)|wi\.st|dailymotion\.com|twitch\.tv|widget\.example)$/;
const SANDBOX = "allow-forms allow-popups allow-scripts allow-same-origin";

const FAKE_PLAYER = `<!doctype html><meta charset="utf-8"><title>fake player</title>
<button id="fs" type="button">Fullscreen</button>
<script>
window.__player = { href: location.href, referrer: document.referrer, fullscreenEnabled: document.fullscreenEnabled === true };
document.getElementById("fs").addEventListener("click", function () {
  document.documentElement.requestFullscreen().then(function () { window.__fs = "entered"; }, function (error) { window.__fs = "rejected:" + error.name; });
});
</script>`;

interface Recorded {
  url: string;
  referer: string | undefined;
}

let served: Recorded[];
let unexpected: string[];
/** A generic Embed's URL in these fixtures (generic Embeds load live in Design, as they always have). */
const isGenericUrl = (url: string) => url.startsWith("https://widget.example/") || url.includes("generic=1");
/** Requests made for Video Embed players. */
const providerServed = () => served.filter((entry) => !isGenericUrl(entry.url));

async function routeProviders(context: BrowserContext) {
  served = [];
  unexpected = [];
  await context.route(
    (url) => PROVIDER_HOSTS.test(url.hostname),
    (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (EMBED_HOSTS.has(url.hostname) && request.resourceType() === "document") {
        served.push({ url: request.url(), referer: request.headers().referer });
        return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: FAKE_PLAYER });
      }
      unexpected.push(request.url());
      return route.abort();
    },
  );
}

const video = (id: string, src: string, extra: Partial<EditorElementNode> = {}): EditorElementNode => ({ id, tag: "iframe", controls: true, aspectRatio: { mode: "ratio", width: 16, height: 9 }, src, ...extra });

const GENERIC_VIMEO = "https://player.vimeo.com/video/76979871?generic=1";

function playbackDocument(): EditorElementNode {
  return {
    id: "page-root",
    tag: "page",
    children: [
      { id: "btn-toggle", tag: "button", text: "Toggle box", interactions: [{ id: "i-toggle", trigger: "click", action: "toggle", targetId: "box" }] },
      { id: "btn-show", tag: "button", text: "Show late", interactions: [{ id: "i-show", trigger: "click", action: "show", targetId: "ve-late" }] },
      { id: "btn-hide", tag: "button", text: "Hide late", interactions: [{ id: "i-hide", trigger: "click", action: "hide", targetId: "ve-late" }] },
      {
        id: "box",
        tag: "div",
        children: [
          video("ve-yt", `https://www.youtube-nocookie.com/embed/${YT}`, { title: "YouTube clip", muted: true, autoplay: true, loop: true }),
          { id: "inner", tag: "section", children: [{ id: "generic-in-box", tag: "iframe", src: "https://widget.example/in-box", title: "Generic in box" }] },
        ],
      },
      video("ve-vimeo", "https://player.vimeo.com/video/76979871?h=a1b2c3d4e5&dnt=1", { title: "Vimeo clip", controls: false }),
      video("ve-late", `https://www.loom.com/embed/${LOOM}`, { title: "Loom clip", initialPreviewVisibility: "hidden", autoplay: true, muted: true }),
      { id: "gone", tag: "div", display: { display: "none" }, children: [video("ve-gone", `https://fast.wistia.net/embed/iframe/${WISTIA}?doNotTrack=true&time=5`, { title: "Gone clip" })] },
      video("ve-wistia", `https://fast.wistia.net/embed/iframe/${WISTIA}?doNotTrack=true`, { title: "Wistia clip", autoplay: true, muted: false }),
      video("ve-spoof", "https://player.vimeo.com.evil.example/video/76979871", { title: "Spoofed Vimeo" }),
      { id: "generic", tag: "iframe", src: "https://widget.example/frame", title: "Generic widget" },
      { id: "generic-vimeo", tag: "iframe", src: GENERIC_VIMEO, title: "Generic Vimeo" },
    ],
  };
}

const playerFor = (page: Page, id: string) => page.locator(`${SURFACE} [data-node-id="${id}"] iframe[data-video-embed-player]`);
const surfacePlayers = (page: Page) => page.locator(`${SURFACE} iframe[data-video-embed-player]`);
const providerFrames = (page: Page) => page.frames().filter((frame) => /^https:\/\/(www\.youtube-nocookie\.com|player\.vimeo\.com|www\.loom\.com|fast\.wistia\.net)\//.test(frame.url()) && !isGenericUrl(frame.url()));
const genericFrame = (page: Page, id: string) => page.locator(`${SURFACE} [data-node-id="${id}"] iframe`);

async function frameWhere(page: Page, predicate: (url: string) => boolean): Promise<Frame> {
  await expect.poll(() => page.frames().some((frame) => predicate(frame.url())), { timeout: 15_000 }).toBe(true);
  const frame = page.frames().find((candidate) => predicate(candidate.url()));
  if (!frame) throw new Error("frame not found");
  await frame.waitForFunction(() => Reflect.has(window, "__player"));
  return frame;
}

async function playerReport(frame: Frame) {
  return frame.evaluate(() => Reflect.get(window, "__player") as { href: string; referrer: string; fullscreenEnabled: boolean });
}

async function start(page: Page, context: BrowserContext) {
  await routeProviders(context);
  await page.setViewportSize({ width: 1600, height: 1400 });
  await gotoApp(page);
  await importDocument(page, playbackDocument(), "ve-wistia");
}

/** By keyboard (focus + Enter): no pointer "stable" wait, which headless WebKit can starve under parallel load. */
async function exitPreview(page: Page) {
  await page.bringToFront();
  const exit = page.getByRole("button", { name: "Exit Preview" });
  await exit.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Enter Preview" })).toBeVisible();
}

async function enterPreview(page: Page) {
  await page.getByRole("button", { name: "Enter Preview" }).click();
  await expect(page.getByRole("button", { name: "Exit Preview" })).toBeVisible();
}

test.afterEach(() => {
  expect(unexpected, "only the exact provider embed hosts may be requested").toEqual([]);
});

test.describe("Preview", () => {
  test("Design loads nothing; Preview mounts exactly the shown players; hide, ancestor, show and exit remove/recreate them; nothing is recorded", async ({ page, context }) => {
    await start(page, context);
    // Design: Video Embeds are placeholders only, no provider request at all.
    await expect(page.locator(`${SURFACE} [data-video-embed-placeholder]`)).toHaveCount(6);
    await expect(surfacePlayers(page)).toHaveCount(0);
    expect(providerServed()).toEqual([]);
    await expectUndoAvailable(page, false);
    // Generic Embeds are live in Design (unchanged); mark their Design frames.
    for (const id of ["generic", "generic-in-box", "generic-vimeo"]) await genericFrame(page, id).evaluate((element) => Reflect.set(element, "__design", true));

    await enterPreview(page);
    // Shown: YouTube (inside the box), Vimeo, Wistia. Not: Loom (hidden at start), the display:none one, the spoofed Vimeo.
    await expect(surfacePlayers(page)).toHaveCount(3);
    await expect(playerFor(page, "ve-late")).toHaveCount(0);
    await expect(playerFor(page, "ve-gone")).toHaveCount(0);
    await expect(playerFor(page, "ve-spoof")).toHaveCount(0);
    await expect(page.locator(`${SURFACE} [data-node-id="ve-spoof"] [data-video-embed-placeholder]`)).toHaveAttribute("data-video-embed-placeholder", "empty");
    expect(served.some((entry) => entry.url.includes("time=5") || entry.url.startsWith("https://www.loom.com/") || entry.url.includes("evil.example"))).toBe(false);
    for (const id of ["ve-yt", "ve-vimeo", "ve-wistia"]) {
      await expect(playerFor(page, id)).toHaveAttribute("sandbox", SANDBOX);
      await expect(playerFor(page, id)).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    }
    // BC-08.3.1: encrypted-media for the validated Vimeo player only.
    await expect(playerFor(page, "ve-vimeo")).toHaveAttribute("allow", "fullscreen; encrypted-media");
    await expect(playerFor(page, "ve-yt")).toHaveAttribute("allow", "fullscreen");
    await expect(playerFor(page, "ve-wistia")).toHaveAttribute("allow", "fullscreen");
    await expect(playerFor(page, "ve-yt")).toHaveAttribute("title", "YouTube clip");
    // Muted-only autoplay and provider parameters, as each player received them.
    await expect(playerFor(page, "ve-yt")).toHaveAttribute("src", `https://www.youtube-nocookie.com/embed/${YT}?autoplay=1&mute=1&loop=1&playlist=${YT}`);
    await expect(playerFor(page, "ve-vimeo")).toHaveAttribute("src", "https://player.vimeo.com/video/76979871?h=a1b2c3d4e5&dnt=1&autoplay=0");
    await expect(playerFor(page, "ve-wistia")).toHaveAttribute("src", `https://fast.wistia.net/embed/iframe/${WISTIA}?doNotTrack=true&autoPlay=false`);
    const youtube = await frameWhere(page, (url) => url.startsWith("https://www.youtube-nocookie.com/"));
    expect((await playerReport(youtube)).referrer).toBe(new URL(page.url()).origin + "/");
    // Generic Embeds: a fresh Preview frame (BC-08.3.1), unchanged source and sandbox, never a permission — a Vimeo URL included.
    for (const id of ["generic", "generic-in-box", "generic-vimeo"]) {
      await expect(genericFrame(page, id)).toHaveAttribute("sandbox", SANDBOX);
      expect(await genericFrame(page, id).getAttribute("allow"), id).toBeNull();
      expect(await genericFrame(page, id).evaluate((element) => Reflect.get(element, "__design")), id).toBeUndefined();
    }
    await expect(genericFrame(page, "generic-vimeo")).toHaveAttribute("src", GENERIC_VIMEO);

    // Hide the box (an ANCESTOR of the YouTube player and of a nested generic Embed): both frames are removed.
    const genericInBox = page.frames().find((frame) => frame.url() === "https://widget.example/in-box");
    await page.locator(`${SURFACE} [data-node-id="btn-toggle"]`).click();
    await expect(playerFor(page, "ve-yt")).toHaveCount(0);
    await expect(genericFrame(page, "generic-in-box")).toHaveCount(0);
    await expect(page.locator(`${SURFACE} [data-node-id="generic-in-box"]`)).toHaveCount(1);
    await expect.poll(() => providerFrames(page).some((frame) => frame.url().includes("youtube-nocookie"))).toBe(false);
    expect(youtube.isDetached()).toBe(true);
    expect(genericInBox?.isDetached()).toBe(true);
    // Shown again: fresh frames (new requests), from their initial state.
    // Counted for the two re-shown frames only: hiding the box moves the page, so a lazy player further down may load meanwhile.
    const reshown = () => served.filter((entry) => entry.url.startsWith("https://www.youtube-nocookie.com/") || entry.url === "https://widget.example/in-box").length;
    const requestsBefore = reshown();
    await page.locator(`${SURFACE} [data-node-id="btn-toggle"]`).click();
    await expect(playerFor(page, "ve-yt")).toHaveCount(1);
    await expect(genericFrame(page, "generic-in-box")).toHaveAttribute("src", "https://widget.example/in-box");
    await expect.poll(reshown).toBe(requestsBefore + 2);

    // Hidden at start, shown, hidden again.
    await page.locator(`${SURFACE} [data-node-id="btn-show"]`).click();
    await expect(playerFor(page, "ve-late")).toHaveAttribute("src", `https://www.loom.com/embed/${LOOM}?autoplay=1&muted=1`);
    await page.locator(`${SURFACE} [data-node-id="btn-hide"]`).click();
    await expect(playerFor(page, "ve-late")).toHaveCount(0);

    // Repeated visibility changes never accumulate frames.
    for (let round = 0; round < 4; round += 1) {
      await page.locator(`${SURFACE} [data-node-id="btn-toggle"]`).click();
      await page.locator(`${SURFACE} [data-node-id="btn-toggle"]`).click();
    }
    await expect(surfacePlayers(page)).toHaveCount(3);
    await expect.poll(() => providerFrames(page).length).toBe(3);
    await expect(genericFrame(page, "generic-in-box")).toHaveCount(1);

    // Exit Preview: every Video Embed player is removed; every generic Embed gets a fresh Design frame (nothing from Preview keeps running).
    for (const id of ["generic", "generic-in-box", "generic-vimeo"]) await genericFrame(page, id).evaluate((element) => Reflect.set(element, "__preview", true));
    await exitPreview(page);
    await expect(surfacePlayers(page)).toHaveCount(0);
    await expect.poll(() => providerFrames(page).length).toBe(0);
    await expect(page.locator(`${SURFACE} [data-video-embed-placeholder]`)).toHaveCount(6);
    for (const id of ["generic", "generic-in-box", "generic-vimeo"]) {
      await expect(genericFrame(page, id)).toHaveCount(1);
      expect(await genericFrame(page, id).evaluate((element) => Reflect.get(element, "__preview")), id).toBeUndefined();
    }
    // Nothing was written: no Undo step, no unsaved change.
    await expectUndoAvailable(page, false);
    await expect(page.getByText("Unsaved changes", { exact: true })).toHaveCount(0);

    // Repeated Preview sessions start clean each time; frames never accumulate.
    const frameCount = page.frames().length;
    for (let session = 0; session < 3; session += 1) {
      await enterPreview(page);
      await expect(surfacePlayers(page)).toHaveCount(3);
      await exitPreview(page);
      await expect(surfacePlayers(page)).toHaveCount(0);
    }
    await expect.poll(() => providerFrames(page).length).toBe(0);
    await expect.poll(() => page.frames().length).toBe(frameCount);
  });

  test("keyboard: hiding by keyboard keeps focus on the control; the removed frame leaves the tab order; showing never steals focus", async ({ page, context }) => {
    await start(page, context);
    await enterPreview(page);
    const toggle = page.locator(`${SURFACE} [data-node-id="btn-toggle"]`);
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(playerFor(page, "ve-yt")).toHaveCount(0);
    await expect(genericFrame(page, "generic-in-box")).toHaveCount(0);
    await expect(toggle).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(playerFor(page, "ve-yt")).toHaveCount(1);
    await expect(toggle).toBeFocused();
    await exitPreview(page);
  });

  test("browser fullscreen: delegated to provider players only, never to a generic Embed; leaving it restores the layout", async ({ page, context }) => {
    await start(page, context);
    await enterPreview(page);
    // loading="lazy": WebKit loads only frames near the viewport.
    await playerFor(page, "ve-wistia").scrollIntoViewIfNeeded();
    const wistia = await frameWhere(page, (url) => url.startsWith("https://fast.wistia.net/"));
    expect((await playerReport(wistia)).fullscreenEnabled).toBe(true);
    const generic = await frameWhere(page, (url) => url.startsWith("https://widget.example/"));
    expect((await playerReport(generic)).fullscreenEnabled).toBe(false);

    // Geometry relative to the page root: the canvas may scroll while the player is fullscreen.
    const layout = () => playerFor(page, "ve-wistia").evaluate((frame) => {
      const own = frame.getBoundingClientRect();
      const root = frame.closest("[data-node-id=\"page-root\"]")?.getBoundingClientRect() ?? own;
      // Rounded to 0.01 px: engines differ by sub-pixel float noise after a fullscreen round trip.
      return JSON.stringify([own.left - root.left, own.top - root.top, own.width, own.height].map((value) => Math.round(value * 100) / 100));
    });
    const box = await layout();
    await page.frameLocator(`${SURFACE} [data-node-id="ve-wistia"] iframe`).locator("#fs").click();
    await expect.poll(() => wistia.evaluate(() => Reflect.get(window, "__fs"))).toBe("entered");
    await wistia.evaluate(() => document.exitFullscreen());
    await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
    await expect.poll(layout).toBe(box);
    // No automatic fullscreen anywhere.
    expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
  });

  test("keyboard: a player is reachable with Tab in Preview", async ({ page, context }) => {
    await start(page, context);
    await enterPreview(page);
    await page.locator(`${SURFACE} [data-node-id="btn-hide"]`).focus();
    let reached = false;
    for (let step = 0; step < 8 && !reached; step += 1) {
      await page.keyboard.press("Tab");
      reached = await page.evaluate(() => document.activeElement?.closest("[data-node-id]")?.getAttribute("data-node-id") === "ve-yt" || (document.activeElement?.tagName === "IFRAME" && document.activeElement.hasAttribute("data-video-embed-player")));
    }
    expect(reached, "Tab moves focus into a Video Embed player").toBe(true);
  });

  test("responsive: the Preview player occupies exactly the placeholder's box, in Flow, Flex, Grid and Free (phone width: the exported page)", async ({ browser }) => {
    test.setTimeout(120_000);
    const src = `https://www.youtube-nocookie.com/embed/${YT}`;
    const responsiveDocument: EditorElementNode = {
        id: "page-root",
        tag: "page",
        children: [
          video("r-flow", src),
          { id: "r-flex-host", tag: "div", flowLayout: { display: "flex" }, children: [video("r-flex", src)] },
          { id: "r-grid-host", tag: "div", flowLayout: { display: "grid" }, children: [video("r-grid", src)] },
          { id: "r-free-host", tag: "div", layoutMode: "free", dimensions: { preferredWidth: 600, preferredHeight: 300, offsetX: 0, offsetY: 0 }, children: [video("r-free", src, { freeLayout: { x: 20, y: 20, width: 320, height: 180 } })] },
        ],
    };
    // The editor itself needs a desktop-sized window; two editor widths, then the exported page at phone width below.
    // Each width is a fresh load: headless WebKit leaves EVERY aspect-ratio grid item (Image, Video, Embed and
    // Video Embed alike) at a stale height after a live window resize — a pre-existing engine behavior, see the BC-08.3 report.
    // A fresh browser context per width (its own project library, so the import never meets "already in library").
    // BC-08.5: the brief's editor widths (the editor needs >= 900 px; 320-768 are covered on the exported page).
    for (const width of [1440, 1024]) {
      const context = await browser.newContext({ viewport: { width, height: 1400 } });
      await routeProviders(context);
      const page = await context.newPage();
      await gotoApp(page);
      await importDocument(page, responsiveDocument, "r-free");
      const ids = ["r-flow", "r-flex", "r-grid", "r-free"];
      const measure = () => Promise.all(ids.map((id) => canvasNode(page, id).evaluate((element) => { const r = element.getBoundingClientRect(); return JSON.stringify([Math.round(r.width), Math.round(r.height)]); })));
      // Settled: two reads 200 ms apart agree (the canvas re-lays out after a viewport change).
      let settled = await measure();
      await expect.poll(async () => { const next = await measure(); const same = JSON.stringify(next) === JSON.stringify(settled); settled = next; return same; }, { intervals: [200] }).toBe(true);
      const design: Record<string, string> = Object.fromEntries(ids.map((id, index) => [id, settled[index]]));
      await enterPreview(page);
      for (const id of ids) {
        const geometry = await canvasNode(page, id).evaluate((element) => {
          const outer = element.getBoundingClientRect();
          const inner = element.querySelector("iframe")?.getBoundingClientRect();
          return { outer: [Math.round(outer.width), Math.round(outer.height)], inner: inner ? [inner.left - outer.left, inner.top - outer.top, outer.right - inner.right, outer.bottom - inner.bottom] : null };
        });
        expect(JSON.stringify(geometry.outer), `${id} at ${width}px: same box as its Design placeholder`).toBe(design[id]);
        expect(geometry.inner, `${id} has a player`).not.toBeNull();
        for (const gap of geometry.inner ?? []) expect(Math.abs(gap), `${id} player fills its box exactly`).toBeLessThan(1.5);
      }
      const [w, h] = JSON.parse(design["r-flow"]) as number[];
      expect(w / h).toBeCloseTo(16 / 9, 1);
      await exitPreview(page);
      expect(unexpected).toEqual([]);
      await context.close();
    }
  });
});

test.describe("Preview, reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });
  test("no player autoplays; manual playback stays available (same player, autoplay off)", async ({ page, context }) => {
    await start(page, context);
    await enterPreview(page);
    await expect(playerFor(page, "ve-yt")).toHaveAttribute("src", `https://www.youtube-nocookie.com/embed/${YT}?mute=1&loop=1&playlist=${YT}`);
    await page.locator(`${SURFACE} [data-node-id="btn-show"]`).click();
    await expect(playerFor(page, "ve-late")).toHaveAttribute("src", `https://www.loom.com/embed/${LOOM}?muted=1`);
  });
});

test.describe("exported page", () => {
  let server: Server;
  let origin = "";
  let files: Record<string, { content: string; type: string }> = {};

  test.beforeAll(async () => {
    server = createServer((request, response) => {
      const file = files[new URL(request.url ?? "/", "http://x").pathname.replace(/^\//, "") || "index.html"];
      if (!file) return void response.writeHead(404).end();
      response.writeHead(200, { "content-type": file.type }).end(file.content);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    origin = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  });
  test.afterAll(() => server.close());

  function publish(mode: "standalone" | "separate") {
    const result = exportHtmlCss(playbackDocument(), { mode, title: "Video export" });
    expect(result.ok).toBe(true);
    files = Object.fromEntries(result.files.map((file) => [file.path, { content: file.content, type: file.mediaType }]));
    return result;
  }

  for (const mode of ["standalone", "separate"] as const) {
    test(`${mode}: the same players as Preview; hide, ancestor and show remove/recreate them; nothing loads hidden`, async ({ page, context }) => {
      await routeProviders(context);
      publish(mode);
      await page.setViewportSize({ width: 900, height: 2400 });
      await page.goto(`${origin}/index.html`);
      const players = page.locator("iframe[data-ly-video-src]");
      await expect(players).toHaveCount(3);
      const titles = await players.evaluateAll((frames) => frames.map((frame) => frame.getAttribute("title")));
      expect(titles).toEqual(["YouTube clip", "Vimeo clip", "Wistia clip"]);
      // Same permissions as Preview: encrypted-media on the Vimeo player only; none on any generic Embed.
      await expect(page.locator('iframe[title="Vimeo clip"]')).toHaveAttribute("allow", "fullscreen; encrypted-media");
      for (const title of ["Generic widget", "Generic in box", "Generic Vimeo"]) expect(await page.locator(`iframe[title="${title}"]`).getAttribute("allow"), title).toBeNull();
      const staticGeneric = page.locator('iframe[title="Generic widget"]');
      await staticGeneric.evaluate((element) => Reflect.set(element, "__static", true));
      const yt = page.locator('iframe[title="YouTube clip"]');
      // Parity with Preview (first test): identical URL, sandbox, permission, referrer policy, loading.
      await expect(yt).toHaveAttribute("src", `https://www.youtube-nocookie.com/embed/${YT}?autoplay=1&mute=1&loop=1&playlist=${YT}`);
      await expect(yt).toHaveAttribute("sandbox", SANDBOX);
      await expect(yt).toHaveAttribute("allow", "fullscreen");
      await expect(yt).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");
      await expect(yt).toHaveAttribute("loading", "lazy");
      await expect(page.locator('iframe[title="Wistia clip"]')).toHaveAttribute("src", `https://fast.wistia.net/embed/iframe/${WISTIA}?doNotTrack=true&autoPlay=false`);
      const frame = await frameWhere(page, (url) => url.startsWith("https://www.youtube-nocookie.com/"));
      expect((await playerReport(frame)).referrer).toBe(`${origin}/`);
      expect((await playerReport(frame)).fullscreenEnabled).toBe(true);
      // Never loaded: the hidden-at-start Loom and the display:none Wistia.
      expect(served.some((entry) => entry.url.startsWith("https://www.loom.com/"))).toBe(false);
      expect(served.some((entry) => entry.url.includes("time=5"))).toBe(false);

      await page.getByRole("button", { name: "Toggle box" }).click();
      await expect(yt).toHaveCount(0);
      await expect(page.locator('iframe[title="Generic in box"]')).toHaveCount(0);
      expect(frame.isDetached()).toBe(true);
      await page.getByRole("button", { name: "Toggle box" }).click();
      await expect(yt).toHaveCount(1);
      await expect(page.locator('iframe[title="Generic in box"]')).toHaveAttribute("src", "https://widget.example/in-box");
      await page.getByRole("button", { name: "Show late" }).click();
      await expect(page.locator('iframe[title="Loom clip"]')).toHaveAttribute("src", `https://www.loom.com/embed/${LOOM}?autoplay=1&muted=1`);
      await page.getByRole("button", { name: "Hide late" }).click();
      await expect(page.locator('iframe[title="Loom clip"]')).toHaveCount(0);
      for (let round = 0; round < 4; round += 1) {
        await page.getByRole("button", { name: "Toggle box" }).click();
        await page.getByRole("button", { name: "Toggle box" }).click();
      }
      await expect(players).toHaveCount(3);
      await expect.poll(() => providerFrames(page).length).toBe(3);
      // A generic frame never hidden is never touched (same element, never reloaded).
      expect(await staticGeneric.evaluate((element) => Reflect.get(element, "__static"))).toBe(true);
    });
  }

  test("320, 375, 768, 1024 and 1440 px: players fill their 16:9 boxes, nothing overflows the page", async ({ page, context }) => {
    await routeProviders(context);
    publish("standalone");
    for (const width of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${origin}/index.html`);
      await expect(page.locator("iframe[data-ly-video-src]")).toHaveCount(3);
      const report = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        players: Array.from(document.querySelectorAll("iframe[data-ly-video-src]")).map((frame) => {
          const inner = frame.getBoundingClientRect();
          const outer = (frame.parentElement ?? frame).getBoundingClientRect();
          return { ratio: outer.width / outer.height, gaps: [inner.left - outer.left, inner.top - outer.top, outer.right - inner.right, outer.bottom - inner.bottom], right: outer.right };
        }),
      }));
      expect(report.overflow, `no horizontal overflow at ${width}px`).toBeLessThanOrEqual(0);
      for (const player of report.players) {
        expect(player.ratio).toBeCloseTo(16 / 9, 1);
        for (const gap of player.gaps) expect(Math.abs(gap)).toBeLessThan(1.5);
        expect(player.right).toBeLessThanOrEqual(width + 0.5);
      }
    }
  });

  test("opened as a local file (file://): the players load but receive no Referer — the documented limitation", async ({ page, context }) => {
    await routeProviders(context);
    const result = publish("separate");
    const directory = mkdtempSync(path.join(tmpdir(), "bc083-export-"));
    for (const file of result.files) writeFileSync(path.join(directory, file.path), file.content);
    await page.goto(pathToFileURL(path.join(directory, "index.html")).href);
    await expect(page.locator("iframe[data-ly-video-src]")).toHaveCount(3);
    // The player request is made, with no Referer header (the evidence in every engine).
    await expect.poll(() => served.some((entry) => entry.url.startsWith("https://www.youtube-nocookie.com/"))).toBe(true);
    expect(served.find((entry) => entry.url.startsWith("https://www.youtube-nocookie.com/"))?.referer).toBeUndefined();
  });

  test.describe("reduced motion", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } });
    test("the exported page never autoplays", async ({ page, context }) => {
      await routeProviders(context);
      publish("standalone");
      await page.goto(`${origin}/index.html`);
      await expect(page.locator('iframe[title="YouTube clip"]')).toHaveAttribute("src", `https://www.youtube-nocookie.com/embed/${YT}?mute=1&loop=1&playlist=${YT}`);
      await page.getByRole("button", { name: "Show late" }).click();
      await expect(page.locator('iframe[title="Loom clip"]')).toHaveAttribute("src", `https://www.loom.com/embed/${LOOM}?muted=1`);
      expect(served.some((entry) => /autoplay=1|autoPlay=true/.test(entry.url))).toBe(false);
    });
  });
});

test("Export dialog: the player markup and the 'needs a website' note, with no provider request from the editor", async ({ page, context }) => {
  await start(page, context);
  await page.getByRole("button", { name: "Export Code" }).click();
  const dialog = page.getByRole("dialog", { name: "Export Code" });
  await expect(dialog.getByTestId("export-code")).toContainText("data-ly-video-src");
  await expect(dialog.getByText(/Video players load from YouTube, Vimeo, Loom or Wistia/)).toBeVisible();
  expect(providerServed()).toEqual([]);
});
