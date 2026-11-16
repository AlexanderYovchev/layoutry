import { expect, test, type Frame } from "@playwright/test";
import type { EditorElementNode } from "../../src/features/editor/types/document";
import { serializeProject } from "../../src/features/project/utils/serializeProject";
import { launchLayoutry, type LaunchedLayoutry } from "./support/layoutryApp";

/**
 * BC-08.4 — OPTIONAL live check of real providers in the desktop app. Never
 * part of the default run: it needs the internet and the providers.
 *
 *   LAYOUTRY_LIVE_PROVIDERS=1 npx playwright test -c playwright.desktop.config.ts e2e/desktop/video-embed-live.spec.ts
 *
 * The app runs with all of its own security settings (permission handler,
 * Referer hook, CSP, navigation guards); only the test harness's offline
 * proxy is lifted and its request recorder replaced by a pass-through. A
 * generic Embed showing the same YouTube video is the control: it must get
 * no Referer (so YouTube refuses it) and no fullscreen.
 */

test.skip(process.env.LAYOUTRY_LIVE_PROVIDERS !== "1", "live provider check: set LAYOUTRY_LIVE_PROVIDERS=1");
test.setTimeout(300_000);

const SURFACE = "[data-document-surface]";
const sized = { preferredWidth: 480, preferredHeight: 270, offsetX: 0, offsetY: 0 };
const ve = (id: string, src: string): EditorElementNode => ({ id, tag: "iframe", controls: true, muted: true, autoplay: true, aspectRatio: { mode: "ratio", width: 16, height: 9 }, src, dimensions: sized });

let layoutry: LaunchedLayoutry | undefined;
test.afterEach(async () => {
  await layoutry?.dispose();
  layoutry = undefined;
});

async function observe(frame: Frame | undefined) {
  if (!frame) return { frame: false };
  await frame.waitForSelector("video", { timeout: 30_000 }).catch(() => undefined);
  await new Promise((resolve) => setTimeout(resolve, 8_000));
  return frame
    .evaluate(() => {
      const video = document.querySelector("video");
      return { video: Boolean(video), muted: video?.muted ?? null, playing: video ? !video.paused && video.currentTime > 0 : null, t: video ? Math.round(video.currentTime * 10) / 10 : null, fullscreenEnabled: document.fullscreenEnabled, text: (document.body?.innerText ?? "").replace(/\s+/g, " ").slice(0, 120) };
    })
    .catch((error: unknown) => ({ error: String(error) }));
}

test("real providers in the desktop Preview: YouTube (Referer), Wistia, Vimeo (DRM), generic control", async () => {
  layoutry = await launchLayoutry();
  const { app, page } = layoutry;
  await app.evaluate(async ({ session }) => {
    await session.defaultSession.setProxy({ mode: "direct" });
    session.defaultSession.webRequest.onBeforeRequest((_details, callback) => callback({}));
  });
  const document: EditorElementNode = {
    id: "page-root",
    tag: "page",
    children: [
      ve("live-yt", "https://www.youtube-nocookie.com/embed/M7lc1UVf-VE"),
      ve("live-wistia", "https://fast.wistia.net/embed/iframe/26sk4lmiix?doNotTrack=true"),
      ve("live-vimeo", "https://player.vimeo.com/video/76979871?dnt=1"),
      { id: "live-generic", tag: "iframe", src: "https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?autoplay=1&mute=1&generic=1", title: "Generic YouTube", dimensions: sized },
    ],
  };
  const file = serializeProject({ metadata: { id: "00000000-0000-4000-8000-000000000843", name: "BC-08.4 live", createdAt: "2026-11-16T00:00:00.000Z", updatedAt: "2026-11-16T00:00:00.000Z" }, document });
  await page.getByTestId("project-import-input").setInputFiles({ name: "live.layoutry", mimeType: "application/json", buffer: Buffer.from(file) });
  await expect(page.locator(`${SURFACE} [data-node-id="live-generic"]`)).toBeAttached({ timeout: 30_000 });
  await page.getByRole("button", { name: "Enter Preview" }).click();

  for (const [id, match] of [["live-yt", (url: string) => url.includes("youtube-nocookie") && !url.includes("generic=1")], ["live-wistia", (url: string) => url.includes("fast.wistia.net")], ["live-vimeo", (url: string) => url.includes("player.vimeo.com")], ["live-generic", (url: string) => url.includes("generic=1")]] as const) {
    const iframe = page.locator(`${SURFACE} [data-node-id="${id}"] iframe`);
    await iframe.scrollIntoViewIfNeeded();
    await expect.poll(() => page.frames().some((frame) => match(frame.url())), { timeout: 30_000 }).toBe(true).catch(() => undefined);
    const frame = page.frames().find((frame) => match(frame.url()));
    let result: unknown = await observe(frame);
    if (frame && !(result as { playing?: boolean }).playing) {
      const box = await iframe.boundingBox();
      if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      result = { autoplay: result, afterClick: await observe(frame) };
    }
    process.stdout.write(`\n[BC-08.4 live electron ${id}] allow=${await iframe.getAttribute("allow")} name=${(await iframe.getAttribute("name")) ? "token" : "none"} ${JSON.stringify(result)}\n`);
  }
  await page.getByRole("button", { name: "Exit Preview" }).click();
  await expect.poll(() => page.frames().length).toBe(2);
});
