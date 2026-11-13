import { expect, test, type Frame, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import type { EditorElementNode } from "../../src/features/editor/types/document";
import { exportHtmlCss } from "../../src/features/export/utils/exportHtmlCss";
import { gotoApp } from "../support/gotoApp";
import { importDocument } from "../support/parityFixtures";

/**
 * BC-08.3 — OPTIONAL live smoke test against the real providers. Never part
 * of the default run: it needs the internet and the providers' cooperation.
 *
 *   LAYOUTRY_LIVE_PROVIDERS=1 npx playwright test e2e/live/video-embed-live.spec.ts
 *
 * Public videos published by the providers themselves (their API/demo or
 * documentation examples). Loom has no known public test video: pending.
 * Vimeo is not loaded at all (playback blocked: its player needs the
 * encrypted-media permission, see the BC-08.3 report), so it is not here.
 * Results are recorded in the checkpoint report, never used as a gate.
 */

test.skip(process.env.LAYOUTRY_LIVE_PROVIDERS !== "1", "live provider smoke test: set LAYOUTRY_LIVE_PROVIDERS=1");
test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

const SURFACE = "[data-document-surface]";
const CASES = [
  { id: "live-yt", provider: "youtube", host: "www.youtube-nocookie.com", src: "https://www.youtube-nocookie.com/embed/M7lc1UVf-VE" },
  { id: "live-wistia", provider: "wistia", host: "fast.wistia.net", src: "https://fast.wistia.net/embed/iframe/26sk4lmiix?doNotTrack=true" },
] as const;

function liveDocument(): EditorElementNode {
  return {
    id: "page-root",
    tag: "page",
    children: CASES.map((entry) => ({ id: entry.id, tag: "iframe", controls: true, muted: true, autoplay: true, aspectRatio: { mode: "ratio", width: 16, height: 9 }, src: entry.src, dimensions: { preferredWidth: 640, preferredHeight: 360, offsetX: 0, offsetY: 0 } })),
  };
}

async function providerFrame(page: Page, host: string): Promise<Frame | undefined> {
  await expect.poll(() => page.frames().some((frame) => frame.url().includes(host)), { timeout: 30_000 }).toBe(true).catch(() => undefined);
  return page.frames().find((frame) => frame.url().includes(host));
}

/** What the player shows after a while: does a <video> exist, is it muted, is it playing, and any visible error text. */
async function observe(frame: Frame | undefined) {
  if (!frame) return { frame: false };
  await frame.waitForSelector("video", { timeout: 30_000 }).catch(() => undefined);
  await new Promise((resolve) => setTimeout(resolve, 6_000));
  return frame
    .evaluate(() => {
      const video = document.querySelector("video");
      const text = (document.body?.innerText ?? "").replace(/\s+/g, " ").slice(0, 160);
      return { frame: true, video: Boolean(video), muted: video?.muted ?? null, playing: video ? !video.paused && video.currentTime > 0 : null, currentTime: video?.currentTime ?? null, fullscreenEnabled: document.fullscreenEnabled, text };
    })
    .catch((error: unknown) => ({ frame: true, error: String(error) }));
}

test("Preview: the real players load under the BC-02.3 sandbox; muted autoplay (as authored) and fullscreen", async ({ page, browserName }) => {
  await page.setViewportSize({ width: 1600, height: 1400 });
  await gotoApp(page);
  await importDocument(page, liveDocument(), "live-wistia");
  await page.getByRole("button", { name: "Enter Preview" }).click();
  for (const entry of CASES) {
    await expect(page.locator(`${SURFACE} [data-node-id="${entry.id}"] iframe`)).toHaveAttribute("sandbox", "allow-forms allow-popups allow-scripts allow-same-origin");
    const result = await observe(await providerFrame(page, entry.host));
    process.stdout.write(`\n[BC-08.3 live ${browserName} Preview ${entry.provider}] ${JSON.stringify(result)}\n`);
  }
  await page.getByRole("button", { name: "Exit Preview" }).click();
  await expect.poll(() => page.frames().filter((frame) => CASES.some((entry) => frame.url().includes(entry.host))).length).toBe(0);
});

test.describe("exported page from a local web server", () => {
  let server: Server;
  let origin = "";
  test.beforeAll(async () => {
    const result = exportHtmlCss(liveDocument(), { mode: "standalone", title: "Live video export" });
    const html = result.files[0].content;
    server = createServer((_request, response) => response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    origin = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  });
  test.afterAll(() => server.close());

  test("the exported players load and play muted", async ({ page, browserName }) => {
    await page.setViewportSize({ width: 900, height: 2400 });
    await page.goto(`${origin}/`);
    for (const entry of CASES) {
      const result = await observe(await providerFrame(page, entry.host));
      process.stdout.write(`\n[BC-08.3 live ${browserName} export ${entry.provider}] ${JSON.stringify(result)}\n`);
    }
  });
});
