import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  launchLayoutry,
  makeTempDir,
  removeDir,
  requestWindowClose,
  scriptFileDialogs,
  waitForExit,
  type LaunchedLayoutry,
} from "./support/layoutryApp";

/**
 * BC-08.2 — Video Embed in the real Electron window, with every shipped
 * security setting. Playback, Referer and fullscreen are BC-08.4; here the
 * desktop app must insert, validate, edit, save and reopen a Video Embed
 * while making NO network request at all (launchLayoutry records and
 * cancels every non-app:// request) and creating no iframe.
 */

const YT = "dQw4w9WgXcQ";
const SURFACE = "[data-document-surface]";

let layoutry: LaunchedLayoutry | undefined;
let folder: string;

test.beforeEach(async () => {
  folder = await makeTempDir("layoutry-video-embed-e2e-");
});

test.afterEach(async () => {
  await layoutry?.dispose();
  layoutry = undefined;
  await removeDir(folder);
});

const inspector = (page: Page) => page.getByRole("complementary", { name: "Inspector panel" });
const urlField = (page: Page) => inspector(page).getByLabel("Video URL", { exact: true });
const placeholder = (page: Page) => page.locator(`${SURFACE} [data-video-embed-placeholder]`).first();

/** Network requests (http/https/ws/ftp) the harness recorded and cancelled; the app's own local file:// bundle loads are not network. */
async function networkRequests(app: LaunchedLayoutry["app"]): Promise<string[]> {
  const seen = await app.evaluate(() => {
    const recorded: unknown = Reflect.get(globalThis, "__layoutryNonAppRequests");
    return Array.isArray(recorded) ? recorded.map(String) : [];
  });
  return seen.filter((url) => /^(https?|wss?|ftp):/i.test(url));
}

/** The Video Embed's layout box (the placeholder sits under the Design interaction shield, like any embed). */
const embedBox = (page: Page) => page.locator(`${SURFACE} [data-node-type="iframe"]`).first();

async function insertVideoEmbed(page: Page) {
  const panel = page.locator('aside[aria-label="Resource panel"]');
  await panel.getByRole("tab", { name: "Elements" }).click();
  await panel.getByRole("button", { name: /^Video Embed\b/ }).click();
  await expect(placeholder(page)).toHaveAttribute("data-video-embed-placeholder", "empty");
}

async function commitUrl(page: Page, value: string) {
  await urlField(page).fill(value);
  await urlField(page).press("Enter");
}

test("insert, validate and configure a Video Embed: static placeholder, no iframe, no network request", async () => {
  layoutry = await launchLayoutry();
  const { app, page } = layoutry;
  await insertVideoEmbed(page);

  await commitUrl(page, "https://youtube.com.evil.example/watch?v=x");
  await expect(inspector(page).getByRole("alert")).toContainText("That isn't a YouTube, Vimeo, Loom or Wistia link.");
  await expect(placeholder(page)).toHaveAttribute("data-video-embed-placeholder", "empty");
  await commitUrl(page, "file:///C:/Windows/win.ini");
  await expect(inspector(page).getByRole("alert")).toContainText("Only https:// video links are supported.");

  await commitUrl(page, `https://www.youtube.com/watch?v=${YT}&si=tracking`);
  await expect(urlField(page)).toHaveValue(`https://www.youtube-nocookie.com/embed/${YT}`);
  await expect(placeholder(page)).toContainText("YouTube video");
  await inspector(page).getByRole("switch", { name: "Muted" }).click();
  await inspector(page).getByRole("switch", { name: "Autoplay" }).click();
  await expect(placeholder(page)).toContainText("Muted · Autoplay");

  // Design: no iframe, no network request at all.
  await expect(page.locator(`${SURFACE} iframe`)).toHaveCount(0);
  expect(page.frames()).toHaveLength(1);
  expect(await networkRequests(app), "Design made no network request").toEqual([]);

  // BC-08.3 Preview: the player is mounted with the unchanged sandbox and
  // WITHOUT fullscreen delegation (desktop fullscreen is BC-08.4). The
  // harness cancels its network request (the suite is offline).
  await page.getByRole("button", { name: "Enter Preview" }).click();
  const player = page.locator(`${SURFACE} iframe[data-video-embed-player="youtube"]`);
  await expect(player).toHaveCount(1);
  await expect(player).toHaveAttribute("sandbox", "allow-forms allow-popups allow-scripts allow-same-origin");
  await expect(player).toHaveAttribute("src", `https://www.youtube-nocookie.com/embed/${YT}?autoplay=1&mute=1`);
  await expect(player).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");
  expect(await player.getAttribute("allow")).toBeNull();
  expect(await player.getAttribute("allowfullscreen")).toBeNull();
  await expect.poll(() => networkRequests(app)).toEqual([`https://www.youtube-nocookie.com/embed/${YT}?autoplay=1&mute=1`]);

  // Exit: the player is gone; Design is a placeholder again.
  await page.getByRole("button", { name: "Exit Preview" }).click();
  await expect(page.locator(`${SURFACE} iframe`)).toHaveCount(0);
  await expect(placeholder(page)).toContainText("YouTube video");
  await expect.poll(() => page.frames().length).toBe(1);
  // Nothing new was granted: still one window, still no permission prompt path.
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isFullScreen())).toBe(false);
});

test("save to a .layoutry file (format 2) and reopen after a restart: identity and settings intact", async () => {
  const target = path.join(folder, "Video Site.layoutry");
  layoutry = await launchLayoutry();
  const { app, page, userDataDir } = layoutry;
  await scriptFileDialogs(app, { save: [target] });
  await insertVideoEmbed(page);
  await commitUrl(page, "https://vimeo.com/76979871/a1b2c3d4e5");
  await inspector(page).getByRole("switch", { name: "Loop" }).click();
  await page.keyboard.press("Control+s");
  await expect(page.locator("[data-project-status]")).toHaveAttribute("data-project-status", "saved");

  const saved: unknown = JSON.parse(await readFile(target, "utf8"));
  expect(Reflect.get(Object(saved), "formatVersion")).toBe(2);
  const text = JSON.stringify(saved);
  expect(text).toContain('"src":"https://player.vimeo.com/video/76979871?h=a1b2c3d4e5&dnt=1"');
  expect(text).toContain('"controls":true');
  expect(text).toContain('"loop":true');

  const child = app.process();
  await requestWindowClose(app).catch(() => undefined);
  expect(await waitForExit(child, 15_000)).toBe(0);
  layoutry = undefined;

  layoutry = await launchLayoutry({ userDataDir });
  await scriptFileDialogs(layoutry.app, { open: [target] });
  await layoutry.page.keyboard.press("Control+o");
  await expect(placeholder(layoutry.page)).toContainText("Vimeo video");
  await expect(placeholder(layoutry.page)).toContainText("Loop · Privacy mode");
  await embedBox(layoutry.page).click({ position: { x: 10, y: 10 } });
  await expect(urlField(layoutry.page)).toHaveValue("https://player.vimeo.com/video/76979871?h=a1b2c3d4e5&dnt=1");
  await expect(inspector(layoutry.page).getByRole("switch", { name: "Loop" })).toHaveAttribute("aria-checked", "true");
  await expect(layoutry.page.locator(`${SURFACE} iframe`)).toHaveCount(0);
  expect(await networkRequests(layoutry.app)).toEqual([]);
});
