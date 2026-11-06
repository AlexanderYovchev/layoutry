import http from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test, type Page } from "@playwright/test";
import { exportHtmlCss } from "../src/features/export/utils/exportHtmlCss";
import { gotoApp } from "./support/gotoApp";
import {
  ALL_MEDIA,
  CLIP_FILE,
  TONE_FILE,
  UNMUTED_AUTOPLAY,
  clipBytes,
  toneBytes,
  importMediaDocument,
  mediaDocument,
  mediaState,
  startPlayback,
  waitForMediaLoaded,
} from "./support/previewMedia";

/*
 * BC-02.2 — Preview media lifecycle in a real browser, against real local
 * media (served by a loopback server owned by this spec, with byte-range
 * support so the browser can stream and loop normally):
 *
 * - B2: a muted autoplay video that already loaded in Design starts
 *   playing when Preview opens, and its playback position advances.
 * - B3: leaving Preview pauses every video and audio, whether it
 *   autoplayed or the user started it, and keeps it paused.
 *
 * Playback is checked through the media element's own state (paused,
 * currentTime advancing), not only its attributes.
 */

const TYPES: Record<string, string> = { [CLIP_FILE]: "video/webm", [TONE_FILE]: "audio/wav", "export.html": "text/html" };

let server: http.Server;
let base = "";
const files = new Map<string, Buffer>();

test.beforeAll(async () => {
  files.set(CLIP_FILE, clipBytes());
  files.set(TONE_FILE, toneBytes());
  server = http.createServer((request, response) => {
    const name = new URL(request.url ?? "/", "http://127.0.0.1").pathname.slice(1);
    const body = files.get(name);
    if (!body) {
      response.writeHead(404).end();
      return;
    }
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Accept-Ranges", "bytes");
    response.setHeader("Content-Type", TYPES[name] ?? "application/octet-stream");
    const range = /bytes=(\d+)-(\d*)/.exec(request.headers.range ?? "");
    if (range) {
      const start = Number(range[1]);
      const end = range[2] ? Number(range[2]) : body.length - 1;
      response.writeHead(206, { "Content-Range": `bytes ${start}-${end}/${body.length}`, "Content-Length": end - start + 1 });
      response.end(body.subarray(start, end + 1));
      return;
    }
    response.writeHead(200, { "Content-Length": body.length });
    response.end(body);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
});

test.afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

const enterPreview = (page: Page) => page.getByRole("button", { name: "Enter Preview" }).click();
const exitPreview = (page: Page) => page.getByRole("button", { name: "Exit Preview" }).click();

async function expectAdvancing(page: Page, nodeId: string) {
  await expect.poll(async () => (await mediaState(page, nodeId)).paused, { message: `${nodeId} should be playing` }).toBe(false);
  const start = (await mediaState(page, nodeId)).currentTime;
  // The 4 s fixture loops, so the position can wrap back to 0: "advancing"
  // means it moved by more than 0.2 s either way (BC-02.5 flake fix).
  await expect.poll(async () => Math.abs((await mediaState(page, nodeId)).currentTime - start), { message: `${nodeId} position should advance` }).toBeGreaterThan(0.2);
}

async function expectStopped(page: Page, nodeId: string) {
  await expect.poll(async () => (await mediaState(page, nodeId)).paused, { message: `${nodeId} should be paused` }).toBe(true);
  const at = (await mediaState(page, nodeId)).currentTime;
  await page.waitForTimeout(400);
  expect((await mediaState(page, nodeId)).currentTime, `${nodeId} must not keep advancing`).toBe(at);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await gotoApp(page);
  await importMediaDocument(page, mediaDocument(base));
  // B2's real precondition: every element has already loaded in Design.
  await waitForMediaLoaded(page, ALL_MEDIA);
});

test("Design never plays media, even media that already loaded", async ({ page }) => {
  await page.waitForTimeout(500);
  for (const id of ALL_MEDIA) {
    const state = await mediaState(page, id);
    expect(state.paused, id).toBe(true);
    expect(state.currentTime, id).toBe(0);
    expect(state.autoplay, id).toBe(false);
  }
});

test("B2: muted autoplay video and audio start when Preview opens; media without autoplay stays paused", async ({ page }) => {
  await enterPreview(page);
  await expectAdvancing(page, "v-auto");
  await expectAdvancing(page, "a-auto");
  await expectAdvancing(page, "v-nested");
  expect((await mediaState(page, "v-auto")).muted).toBe(true);
  // Unmuted autoplay is not started (BC-02.2.1), even right after the
  // Enter Preview click, and is not muted to make it start.
  for (const id of ["v-plain", "v-noctrl", "a-plain", ...UNMUTED_AUTOPLAY]) {
    const state = await mediaState(page, id);
    expect(state.paused, id).toBe(true);
    expect(state.currentTime, id).toBe(0);
  }
  for (const id of UNMUTED_AUTOPLAY) {
    const state = await mediaState(page, id);
    expect(state.muted, id).toBe(false);
    expect(state.autoplay, id).toBe(false);
  }
});

test("B3: leaving Preview pauses every playing video and audio without rewinding it", async ({ page }) => {
  await enterPreview(page);
  // Started by hand so this test shows B3 on its own, independent of B2's
  // autoplay. A real click gives the page user activation for the unmuted
  // media (with native controls it may itself start v-plain; play() then
  // just resolves).
  await page.locator('[data-document-surface] [data-node-id="v-plain"] video').click();
  for (const id of ALL_MEDIA) expect(await startPlayback(page, id), id).toBe("playing");
  for (const id of ALL_MEDIA) await expectAdvancing(page, id);

  await exitPreview(page);
  for (const id of ALL_MEDIA) await expectStopped(page, id);
  // Paused where it was, not rewound.
  expect((await mediaState(page, "v-auto")).currentTime).toBeGreaterThan(0);
  expect((await mediaState(page, "a-plain")).currentTime).toBeGreaterThan(0);

  // Design editing is back: the shield, not the native player, is under the pointer.
  const topmost = await page.locator('[data-document-surface] [data-node-id="v-plain"]').evaluate((wrapper) => {
    const box = wrapper.getBoundingClientRect();
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return hit?.tagName === "DIV" && hit.getAttribute("aria-hidden") === "true" && wrapper.contains(hit);
  });
  expect(topmost).toBe(true);
});

test("repeated Preview sessions: autoplay restarts each time, everything stops each time", async ({ page }) => {
  for (let session = 0; session < 3; session++) {
    await enterPreview(page);
    await expectAdvancing(page, "v-auto");
    await expectAdvancing(page, "a-auto");
    for (const id of ["v-plain", ...UNMUTED_AUTOPLAY]) expect((await mediaState(page, id)).paused, id).toBe(true);
    await exitPreview(page);
    for (const id of ALL_MEDIA) await expectStopped(page, id);
  }
});

test("media hidden by an interaction during Preview is not left playing after exit", async ({ page }) => {
  await enterPreview(page);
  await expectAdvancing(page, "v-nested");
  await page.locator("[data-document-surface] button", { hasText: "Toggle media box" }).click();
  await expect(page.locator('[data-document-surface] [data-node-id="v-nested"]')).toHaveCount(0);
  await exitPreview(page);
  await expect(page.locator('[data-document-surface] [data-node-id="v-nested"]')).toHaveCount(1);
  await expectStopped(page, "v-nested");
});

test("Undo stays unavailable: playback across a Preview session records no history", async ({ page }) => {
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  await expect(undo).toBeDisabled();
  await enterPreview(page);
  await expectAdvancing(page, "v-auto");
  await exitPreview(page);
  await expect(undo).toBeDisabled();
});

test("muted-only policy: unmuted autoplay can still be started by hand, keeps its sound, and stops on exit", async ({ page }) => {
  await enterPreview(page);
  await expectAdvancing(page, "v-auto");
  for (const id of UNMUTED_AUTOPLAY) expect((await mediaState(page, id)).paused, id).toBe(true);
  // A real click is the user gesture the native Play control would provide.
  await page.locator('[data-document-surface] [data-node-id="v-sound"] video').click();
  for (const id of UNMUTED_AUTOPLAY) expect(await startPlayback(page, id), id).toBe("playing");
  for (const id of UNMUTED_AUTOPLAY) {
    await expectAdvancing(page, id);
    expect((await mediaState(page, id)).muted, id).toBe(false);
  }
  await exitPreview(page);
  for (const id of UNMUTED_AUTOPLAY) await expectStopped(page, id);
});

test("Export follows muted-only autoplay and has no editor pause logic", async ({ page }) => {
  const result = exportHtmlCss(mediaDocument(base), { mode: "standalone", title: "Media" });
  expect(result.ok).toBe(true);
  expect(result.diagnostics.filter((diagnostic) => diagnostic.code === "unmuted-autoplay").map((diagnostic) => diagnostic.nodeId)).toEqual(["v-sound", "a-sound"]);
  const html = result.files.find((file) => file.path.endsWith(".html"))?.content ?? "";
  // No editor-only lifecycle: the exported page has no Design/Preview mode to
  // leave. (Since BC-02.5 its runtime does pause media inside a hidden
  // target, so the check is for the editor concept, not for pause() itself.)
  expect(html).not.toMatch(/editorMode|exitPreview|enterPreview/);
  files.set("export.html", Buffer.from(html));
  await page.goto(`${base}export.html`);
  const attributes = (id: string) => page.locator(`#${id}`).evaluate((media: HTMLMediaElement) => ({ autoplay: media.hasAttribute("autoplay"), muted: media.hasAttribute("muted"), loop: media.loop, controls: media.controls }));
  expect(await attributes("v-auto")).toEqual({ autoplay: true, muted: true, loop: true, controls: true });
  expect(await attributes("a-auto")).toEqual({ autoplay: true, muted: true, loop: true, controls: true });
  expect(await attributes("v-sound")).toEqual({ autoplay: false, muted: false, loop: true, controls: true });
  expect(await attributes("a-sound")).toEqual({ autoplay: false, muted: false, loop: true, controls: true });

  const state = (id: string) => page.locator(`#${id}`).evaluate((media: HTMLMediaElement) => ({ paused: media.paused, currentTime: media.currentTime }));
  await expect.poll(async () => (await state("v-auto")).currentTime).toBeGreaterThan(0.2);
  for (const id of [...UNMUTED_AUTOPLAY, "v-plain"]) expect(await state(id), id).toEqual({ paused: true, currentTime: 0 });

  // Manual playback still works on the exported page.
  await page.locator("#v-sound").click();
  const started = await page.locator("#v-sound").evaluate((media: HTMLMediaElement) => media.play().then(() => "playing", (error: Error) => error.name));
  expect(started).toBe("playing");
  await expect.poll(async () => (await state("v-sound")).currentTime).toBeGreaterThan(0.2);
});
