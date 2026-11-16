import { expect, test, type Frame, type Page } from "@playwright/test";
import type { EditorElementNode } from "../../src/features/editor/types/document";
import { serializeProject } from "../../src/features/project/utils/serializeProject";
import { launchLayoutry, type LaunchedLayoutry } from "./support/layoutryApp";

/**
 * BC-08.4 — Video Embed players in the real Electron window, offline. The
 * main process serves a FAKE player page for every https request (this
 * test instance only; the app's own security settings are untouched), so
 * frames load on the exact provider origins. The fake player can request
 * fullscreen, rename itself (window.name) and report.
 *
 * Proven here against the real permission handler and frame tree:
 * fullscreen is granted only to the editor's registered player frames,
 * never to a generic Embed, an unregistered or renamed frame, a stale
 * registration, or an ambiguous URL; it ends with the player (Preview exit,
 * hide, project switch); no other permission changes.
 */

const YT = "M7lc1UVf-VE";
const SURFACE = "[data-document-surface]";
const SANDBOX = "allow-forms allow-popups allow-scripts allow-same-origin";
const ALLOWED_HOSTS = ["https://www.youtube-nocookie.com/", "https://player.vimeo.com/", "https://fast.wistia.net/", "https://widget.example/"];

const FAKE_PLAYER = `<!doctype html><meta charset="utf-8"><title>fake player</title>
<button id="fs" type="button">Fullscreen</button><button id="rename" type="button">Rename</button>
<script>
window.__fs = "idle";
document.getElementById("fs").addEventListener("click", function () {
  window.__fs = "pending";
  document.documentElement.requestFullscreen().then(function () { window.__fs = "entered"; }, function (error) { window.__fs = "rejected:" + error.name; });
});
document.getElementById("rename").addEventListener("click", function () { window.name = "renamed-by-content"; });
</script>`;

let layoutry: LaunchedLayoutry | undefined;

test.afterEach(async () => {
  await layoutry?.dispose();
  layoutry = undefined;
});

const video = (id: string, src: string, extra: Partial<EditorElementNode> = {}): EditorElementNode => ({
  id,
  tag: "iframe",
  controls: true,
  aspectRatio: { mode: "ratio", width: 16, height: 9 },
  dimensions: { preferredWidth: 420, preferredHeight: 236, offsetX: 0, offsetY: 0 },
  src,
  ...extra,
});

function fixture(): EditorElementNode {
  return {
    id: "page-root",
    tag: "page",
    children: [
      { id: "btn-toggle", tag: "button", text: "Toggle box", interactions: [{ id: "i-t", trigger: "click", action: "toggle", targetId: "box" }] },
      { id: "box", tag: "div", children: [video("ve-yt", `https://www.youtube-nocookie.com/embed/${YT}`, { muted: true, autoplay: true, title: "YouTube clip" })] },
      video("ve-vimeo", "https://player.vimeo.com/video/76979871?dnt=1", { title: "Vimeo clip" }),
      video("ve-wistia", "https://fast.wistia.net/embed/iframe/26sk4lmiix?doNotTrack=true", { autoplay: true, muted: false, title: "Wistia clip" }),
      video("ve-spoof", "https://player.vimeo.com.evil.example/video/76979871", { title: "Spoof" }),
      { id: "generic", tag: "iframe", src: "https://widget.example/frame", title: "Generic widget" },
    ],
  };
}

async function start(options: { extraArgs?: string[] } = {}) {
  layoutry = await launchLayoutry(options);
  const { app, page } = layoutry;
  await app.evaluate(({ session }, { body, allowed }) => {
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => callback({ cancel: /^(https?|wss?|ftp):/i.test(details.url) && !allowed.some((prefix) => details.url.startsWith(prefix)) }));
    session.defaultSession.protocol.handle("https", (request) =>
      allowed.some((prefix) => request.url.startsWith(prefix)) ? new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } }) : new Response("blocked", { status: 404 }),
    );
  }, { body: FAKE_PLAYER, allowed: ALLOWED_HOSTS });
  await importDocument(page, fixture(), "generic");
  return layoutry;
}

async function importDocument(page: Page, document: EditorElementNode, waitFor: string, name = "BC-08.4 fullscreen") {
  const file = serializeProject({ metadata: { id: name === "BC-08.4 fullscreen" ? "00000000-0000-4000-8000-000000000841" : "00000000-0000-4000-8000-000000000842", name, createdAt: "2026-11-16T00:00:00.000Z", updatedAt: "2026-11-16T00:00:00.000Z" }, document });
  await page.getByTestId("project-import-input").setInputFiles({ name: "fixture.layoutry", mimeType: "application/json", buffer: Buffer.from(file) });
  await expect(page.locator(`${SURFACE} [data-node-id="${waitFor}"]`)).toBeAttached({ timeout: 30_000 });
}

const player = (page: Page, id: string) => page.locator(`${SURFACE} [data-node-id="${id}"] iframe`);

async function frameFor(page: Page, prefix: string): Promise<Frame> {
  await expect.poll(() => page.frames().some((frame) => frame.url().startsWith(prefix)), { timeout: 15_000 }).toBe(true);
  const frame = page.frames().filter((candidate) => candidate.url().startsWith(prefix)).at(-1);
  if (!frame) throw new Error(`no frame ${prefix}`);
  await frame.waitForFunction(() => Reflect.get(window, "__fs") === "idle");
  return frame;
}

const windowFullScreen = (app: LaunchedLayoutry["app"]) => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isFullScreen() ?? false);
const fsState = (frame: Frame) => frame.evaluate(() => String(Reflect.get(window, "__fs")));

/** Clicks the player's fullscreen button until the player has seen the click (its state leaves "idle"); the result is asserted by the caller. */
async function requestFullscreen(page: Page, id: string) {
  const frame = page.frameLocator(`${SURFACE} [data-node-id="${id}"] iframe`);
  await expect(async () => {
    await frame.locator("#fs").click({ timeout: 2_000 });
    expect(await frame.locator("body").evaluate(() => String(Reflect.get(window, "__fs")))).not.toBe("idle");
  }).toPass({ timeout: 15_000 });
}

/**
 * A person can only hide or leave a fullscreen player after seeing it: the
 * player covers the editor. Electron 44 loses the element-fullscreen exit
 * when fullscreen ends within ~50 ms of entering it (window leaves, but
 * leave-html-full-screen never fires; see the BC-08.4 report), so these
 * tests wait a realistic moment before ending fullscreen programmatically.
 */
async function watchFullscreen(page: Page) {
  await page.waitForTimeout(1_000);
}

async function enterPreview(page: Page) {
  await page.getByRole("button", { name: "Enter Preview" }).click();
  await expect(page.getByRole("button", { name: "Exit Preview" })).toBeAttached();
}

test("authorized players: named, registered, fullscreen granted; Escape and the player's own exit restore the window", async () => {
  const { app, page } = await start();
  // Design: placeholders, no frame.
  await expect(page.locator(`${SURFACE} iframe[data-video-embed-player]`)).toHaveCount(0);
  await enterPreview(page);
  for (const id of ["ve-yt", "ve-vimeo", "ve-wistia"]) {
    await expect(player(page, id)).toHaveAttribute("name", /^ly-video-[0-9a-f]{32}$/);
    await expect(player(page, id)).toHaveAttribute("sandbox", SANDBOX);
  }
  await expect(player(page, "ve-yt")).toHaveAttribute("allow", "fullscreen");
  await expect(player(page, "ve-vimeo")).toHaveAttribute("allow", "fullscreen; encrypted-media");
  // Muted-only autoplay, as Preview loads it.
  await expect(player(page, "ve-yt")).toHaveAttribute("src", `https://www.youtube-nocookie.com/embed/${YT}?autoplay=1&mute=1`);
  await expect(player(page, "ve-wistia")).toHaveAttribute("src", "https://fast.wistia.net/embed/iframe/26sk4lmiix?doNotTrack=true&autoPlay=false");
  // Spoofed Vimeo: no player at all.
  await expect(page.locator(`${SURFACE} [data-node-id="ve-spoof"] iframe`)).toHaveCount(0);
  const names = await page.locator(`${SURFACE} iframe[data-video-embed-player]`).evaluateAll((frames) => frames.map((frame) => frame.getAttribute("name")));
  expect(new Set(names).size).toBe(3);

  const youtube = await frameFor(page, "https://www.youtube-nocookie.com/");
  await requestFullscreen(page, "ve-yt");
  await expect.poll(() => fsState(youtube), { timeout: 10_000 }).toBe("entered");
  await expect.poll(() => windowFullScreen(app)).toBe(true);
  await youtube.evaluate(() => document.exitFullscreen());
  await expect.poll(() => windowFullScreen(app)).toBe(false);

  // Escape (keyboard) leaves fullscreen, is not passed on (Preview stays open), and does not crash or lose the editor.
  await requestFullscreen(page, "ve-yt");
  await expect.poll(() => windowFullScreen(app)).toBe(true);
  // A real key press, through Electron's native input path (Playwright's CDP key events bypass before-input-event).
  await app.evaluate(({ BrowserWindow }) => {
    const contents = BrowserWindow.getAllWindows()[0]?.webContents;
    contents?.sendInputEvent({ type: "keyDown", keyCode: "Escape" });
    contents?.sendInputEvent({ type: "keyUp", keyCode: "Escape" });
  });
  await expect.poll(() => windowFullScreen(app)).toBe(false);
  await expect(page.locator(SURFACE)).toBeVisible();
  await expect(page.getByRole("button", { name: "Exit Preview" })).toBeAttached();
  await expect(player(page, "ve-yt")).toHaveCount(1);
});

test("never granted: generic Embeds, unregistered or renamed frames, a URL also shown by a generic Embed", async () => {
  const { app, page } = await start();
  await enterPreview(page);
  // The generic Embed: no allow, no name, no fullscreen.
  await expect(player(page, "generic")).not.toHaveAttribute("allow", /.*/);
  await expect(player(page, "generic")).not.toHaveAttribute("name", /.*/);
  const generic = await frameFor(page, "https://widget.example/");
  await requestFullscreen(page, "generic");
  await expect.poll(() => fsState(generic)).toMatch(/^rejected:/);

  // A hostile frame with allow="fullscreen" and a well-formed but UNREGISTERED name, on a provider origin.
  await page.evaluate(() => {
    const frame = document.createElement("iframe");
    frame.id = "intruder";
    frame.name = "ly-video-0123456789abcdef0123456789abcdef";
    frame.setAttribute("sandbox", "allow-scripts allow-same-origin");
    frame.setAttribute("allow", "fullscreen");
    frame.src = "https://player.vimeo.com/video/123?intruder=1";
    frame.style.cssText = "position:fixed;left:0;top:0;width:200px;height:120px;z-index:99999";
    document.body.append(frame);
  });
  const intruder = await frameFor(page, "https://player.vimeo.com/video/123?intruder=1");
  await page.frameLocator("#intruder").locator("#fs").click();
  await page.waitForTimeout(1_000);
  expect(await fsState(intruder)).not.toBe("entered");
  expect(await windowFullScreen(app)).toBe(false);
  await page.evaluate(() => document.getElementById("intruder")?.remove());

  // An authorized player that renames itself loses its authorization.
  const vimeo = await frameFor(page, "https://player.vimeo.com/video/76979871");
  await page.frameLocator(`${SURFACE} [data-node-id="ve-vimeo"] iframe`).locator("#rename").click();
  await requestFullscreen(page, "ve-vimeo");
  await page.waitForTimeout(1_000);
  expect(await fsState(vimeo)).not.toBe("entered");
  expect(await windowFullScreen(app)).toBe(false);

  // Ambiguous: a generic Embed showing EXACTLY the authorized player's URL makes that URL ineligible.
  const playerUrl = await player(page, "ve-yt").getAttribute("src");
  await page.evaluate((src) => {
    const frame = document.createElement("iframe");
    frame.id = "same-url";
    frame.setAttribute("sandbox", "allow-scripts allow-same-origin");
    frame.src = src ?? "";
    document.body.append(frame);
  }, playerUrl);
  await expect.poll(() => page.frames().filter((frame) => frame.url() === playerUrl).length).toBe(2);
  const youtube = page.frames().find((frame) => frame.url() === playerUrl && frame.name() !== "");
  if (!youtube) throw new Error("no youtube player frame");
  await requestFullscreen(page, "ve-yt");
  await page.waitForTimeout(1_000);
  expect(await fsState(youtube)).not.toBe("entered");
  expect(await windowFullScreen(app)).toBe(false);
});

test("authorization ends with the player: Preview exit, hide, project switch; stale names are refused", async () => {
  const { app, page } = await start();
  await enterPreview(page);
  const oldName = await player(page, "ve-yt").getAttribute("name");

  // Fullscreen, then the player's ancestor is hidden: the frame is removed and the window leaves fullscreen.
  await frameFor(page, "https://www.youtube-nocookie.com/");
  await requestFullscreen(page, "ve-yt");
  await expect.poll(() => windowFullScreen(app)).toBe(true);
  await watchFullscreen(page);
  await page.evaluate(() => (document.querySelector('[data-document-surface] [data-node-id="btn-toggle"]') as HTMLElement | null)?.click());
  await expect(player(page, "ve-yt")).toHaveCount(0);
  await expect.poll(() => windowFullScreen(app)).toBe(false);
  await page.locator(`${SURFACE} [data-node-id="btn-toggle"]`).click();
  await expect(player(page, "ve-yt")).toHaveAttribute("name", /^ly-video-/);
  expect(await player(page, "ve-yt").getAttribute("name")).not.toBe(oldName);

  // Fullscreen, then Preview closes: removed, window restored, nothing left playing.
  await frameFor(page, "https://www.youtube-nocookie.com/");
  await requestFullscreen(page, "ve-yt");
  await expect.poll(() => windowFullScreen(app)).toBe(true);
  const sessionName = await player(page, "ve-yt").getAttribute("name");
  await watchFullscreen(page);
  await page.evaluate(() => (document.querySelector('button[aria-label="Exit Preview"]') as HTMLElement | null)?.click());
  await expect(page.locator(`${SURFACE} iframe[data-video-embed-player]`)).toHaveCount(0);
  await expect.poll(() => windowFullScreen(app)).toBe(false);
  await expect.poll(() => page.frames().filter((frame) => frame.url().startsWith("https://www.youtube-nocookie.com/")).length).toBe(0);

  // A frame re-using a removed player's name (stale) is refused.
  await page.evaluate((name) => {
    const frame = document.createElement("iframe");
    frame.id = "stale";
    frame.name = name ?? "";
    frame.setAttribute("sandbox", "allow-scripts allow-same-origin");
    frame.setAttribute("allow", "fullscreen");
    frame.src = "https://www.youtube-nocookie.com/embed/stale";
    frame.style.cssText = "position:fixed;left:0;top:0;width:200px;height:120px;z-index:99999";
    document.body.append(frame);
  }, sessionName);
  const stale = await frameFor(page, "https://www.youtube-nocookie.com/embed/stale");
  await page.frameLocator("#stale").locator("#fs").click();
  await page.waitForTimeout(1_000);
  expect(await fsState(stale)).not.toBe("entered");
  expect(await windowFullScreen(app)).toBe(false);
  await page.evaluate(() => document.getElementById("stale")?.remove());

  // Project switch during Preview: players go away; the old names no longer count.
  await enterPreview(page);
  const beforeSwitch = await player(page, "ve-yt").getAttribute("name");
  await importDocument(page, { id: "page-root", tag: "page", children: [{ id: "other", tag: "p", text: "Another project" }] }, "other", "Another project");
  await expect(page.locator(`${SURFACE} iframe[data-video-embed-player]`)).toHaveCount(0);
  await page.evaluate((name) => {
    const frame = document.createElement("iframe");
    frame.id = "after-switch";
    frame.name = name ?? "";
    frame.setAttribute("sandbox", "allow-scripts allow-same-origin");
    frame.setAttribute("allow", "fullscreen");
    frame.src = "https://www.youtube-nocookie.com/embed/after-switch";
    frame.style.cssText = "position:fixed;left:0;top:0;width:200px;height:120px;z-index:99999";
    document.body.append(frame);
  }, beforeSwitch);
  const afterSwitch = await frameFor(page, "https://www.youtube-nocookie.com/embed/after-switch");
  await page.frameLocator("#after-switch").locator("#fs").click();
  await page.waitForTimeout(1_000);
  expect(await fsState(afterSwitch)).not.toBe("entered");
  expect(await windowFullScreen(app)).toBe(false);
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
});

test("reduced motion in the desktop app: no player autoplays", async () => {
  const { page } = await start();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enterPreview(page);
  await expect(player(page, "ve-yt")).toHaveAttribute("src", `https://www.youtube-nocookie.com/embed/${YT}?mute=1`);
});
