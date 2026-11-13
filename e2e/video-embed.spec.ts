import { expect, test, type Page } from "@playwright/test";
import type { EditorElementNode } from "../src/features/editor/types/document";
import { gotoApp } from "./support/gotoApp";
import { canvasNode, expectUndoAvailable } from "./support/inspector";
import { importDocument } from "./support/parityFixtures";

/**
 * BC-08.2 — Video Embed: library card, provider detection, Inspector
 * controls, static Canvas placeholder, persistence and history. Fully
 * offline: every request to a video provider's hosts is recorded and
 * aborted, and each test asserts there was none (decision 4: no provider
 * request while designing). Preview playback, export and lifecycle are
 * e2e/video-embed-playback.spec.ts (BC-08.3).
 */

const YT = "dQw4w9WgXcQ";
const LOOM = "0123456789abcdef0123456789abcdef";
const PROVIDER_HOSTS = /(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be|ytimg\.com|googlevideo\.com|vimeo\.com|vimeocdn\.com|loom\.com|wistia\.(com|net)|wi\.st|dailymotion\.com|dai\.ly|twitch\.tv|ttvnw\.net)$/;
const SURFACE = "[data-document-surface]";

const inspector = (page: Page) => page.getByRole("complementary", { name: "Inspector panel" });
const resourcePanel = (page: Page) => page.locator('aside[aria-label="Resource panel"]');
const placeholder = (page: Page, id: string) => page.locator(`${SURFACE} [data-node-id="${id}"] [data-video-embed-placeholder]`);
const urlField = (page: Page) => inspector(page).getByLabel("Video URL", { exact: true });

let providerRequests: string[];

test.beforeEach(async ({ page, context }) => {
  providerRequests = [];
  await context.route(
    (url) => PROVIDER_HOSTS.test(url.hostname),
    (route) => {
      providerRequests.push(route.request().url());
      return route.abort();
    },
  );
  await page.setViewportSize({ width: 1600, height: 1000 });
  await gotoApp(page);
});

test.afterEach(() => {
  expect(providerRequests, "no request may reach a video provider while designing").toEqual([]);
});

async function insertVideoEmbed(page: Page): Promise<string> {
  const embeds = () => page.locator(`${SURFACE} [data-node-type="iframe"]`).evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-node-id")));
  const before = await embeds();
  await resourcePanel(page).getByRole("tab", { name: "Elements" }).click();
  await resourcePanel(page).getByRole("button", { name: /^Video Embed\b/ }).click();
  await expect.poll(async () => (await embeds()).length).toBe(before.length + 1);
  const id = (await embeds()).find((candidate) => !before.includes(candidate));
  if (!id) throw new Error("Video Embed not inserted");
  return id;
}

async function commitUrl(page: Page, value: string) {
  await urlField(page).fill(value);
  await urlField(page).press("Enter");
}

async function undo(page: Page) {
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await page.getByRole("menuitem", { name: "Undo" }).click();
}

async function redo(page: Page) {
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await page.getByRole("menuitem", { name: "Redo" }).click();
}

test("insertion: one Undo step, a recognizable empty placeholder, a Video Embed in Structure, no iframe", async ({ page }) => {
  await expectUndoAvailable(page, false);
  const id = await insertVideoEmbed(page);
  await expect(placeholder(page, id)).toHaveAttribute("data-video-embed-placeholder", "empty");
  await expect(placeholder(page, id)).toContainText("Paste a video link in the Inspector");
  await expect(page.locator(`${SURFACE} [data-node-id="${id}"] iframe`)).toHaveCount(0);
  await expect(inspector(page).getByLabel("Video URL", { exact: true })).toHaveValue("");
  await expect(inspector(page).getByTestId("video-embed-provider")).toHaveText("None yet");
  await page.getByRole("tab", { name: "Structure" }).click();
  await expect(page.getByRole("treeitem", { name: /Video Embed/ })).toHaveCount(1);
  await expectUndoAvailable(page, true);
  await undo(page);
  await expect(canvasNode(page, id)).toHaveCount(0);
  await expectUndoAvailable(page, false);
});

test("YouTube, Vimeo, Loom and Wistia links are detected and normalized; the placeholder follows", async ({ page }) => {
  const id = await insertVideoEmbed(page);
  const cases = [
    [`https://www.youtube.com/watch?v=${YT}&si=TRACKING`, "YouTube", `https://www.youtube-nocookie.com/embed/${YT}`],
    ["https://vimeo.com/76979871/a1b2c3d4e5", "Vimeo", "https://player.vimeo.com/video/76979871?h=a1b2c3d4e5&dnt=1"],
    [`https://www.loom.com/share/${LOOM}?sid=abc`, "Loom", `https://www.loom.com/embed/${LOOM}`],
    ["https://acme.wistia.com/medias/26sk4lmiix", "Wistia", "https://fast.wistia.net/embed/iframe/26sk4lmiix?doNotTrack=true"],
  ] as const;
  for (const [input, provider, canonical] of cases) {
    await commitUrl(page, input);
    await expect(urlField(page)).toHaveValue(canonical);
    await expect(inspector(page).getByTestId("video-embed-provider")).toHaveText(provider);
    await expect(placeholder(page, id)).toContainText(`${provider} video`);
    await expect(inspector(page).getByLabel("Title", { exact: true })).toHaveValue(`${provider} video`);
  }
  await expect(page.locator(`${SURFACE} iframe`)).toHaveCount(0);
});

test("an invalid link: an announced error, the draft stays, the last valid link is kept and no Undo step is added", async ({ page }) => {
  const id = await insertVideoEmbed(page);
  await commitUrl(page, `https://youtu.be/${YT}`);
  await expect(placeholder(page, id)).toContainText("YouTube video");
  for (const [input, message] of [
    ["https://youtube.com.evil.example/watch?v=x", "That isn't a YouTube, Vimeo, Loom or Wistia link."],
    ["javascript:alert(1)", "Only https:// video links are supported."],
    ["https://www.twitch.tv/somechannel", "Twitch videos aren't supported yet."],
    ["https://www.dailymotion.com/video/x84sh87", "Dailymotion videos aren't supported yet."],
  ] as const) {
    await commitUrl(page, input);
    await expect(inspector(page).getByRole("alert")).toContainText(message);
    await expect(urlField(page)).toHaveValue(input);
    await expect(urlField(page)).toHaveAttribute("aria-invalid", "true");
    await expect(placeholder(page, id)).toContainText("YouTube video");
  }
  // History holds exactly insertion + one valid link.
  await undo(page);
  await expect(placeholder(page, id)).toHaveAttribute("data-video-embed-placeholder", "empty");
  await undo(page);
  await expect(canvasNode(page, id)).toHaveCount(0);
  await expectUndoAvailable(page, false);
  await redo(page);
  await redo(page);
  await expect(placeholder(page, id)).toContainText("YouTube video");
});

test("provider switching shows only the controls the provider supports, keeping the other settings", async ({ page }) => {
  const id = await insertVideoEmbed(page);
  await commitUrl(page, `https://youtu.be/${YT}`);
  for (const name of ["Muted", "Autoplay", "Loop", "Controls", "Privacy mode"]) await expect(inspector(page).getByRole("switch", { name })).toBeVisible();
  await expect(inspector(page).getByLabel("Start at", { exact: true })).toBeVisible();
  await inspector(page).getByRole("switch", { name: "Loop" }).click();
  await expect(placeholder(page, id)).toContainText("Loop");

  await commitUrl(page, "https://vimeo.com/76979871");
  await expect(inspector(page).getByRole("switch", { name: "Controls" })).toHaveCount(0);
  await expect(inspector(page).getByText(/Hiding them needs the video owner's paid Vimeo plan/)).toBeVisible();
  await expect(inspector(page).getByRole("switch", { name: "Loop" })).toHaveAttribute("aria-checked", "true");

  await commitUrl(page, `https://www.loom.com/share/${LOOM}`);
  for (const name of ["Loop", "Controls", "Privacy mode"]) await expect(inspector(page).getByRole("switch", { name })).toHaveCount(0);
  await expect(inspector(page).getByText("Loom videos can't loop.")).toBeVisible();
  await expect(placeholder(page, id)).not.toContainText("Loop");

  // Back to YouTube: Loop was kept all along.
  await commitUrl(page, `https://youtu.be/${YT}`);
  await expect(inspector(page).getByRole("switch", { name: "Loop" })).toHaveAttribute("aria-checked", "true");
});

test("muted-only autoplay: Autoplay alone never claims to start, Muted is never switched on for the user", async ({ page }) => {
  const id = await insertVideoEmbed(page);
  await commitUrl(page, `https://youtu.be/${YT}`);
  await expect(inspector(page).getByText(/^Starts by itself only when Muted is also on/)).toBeVisible();
  await inspector(page).getByRole("switch", { name: "Autoplay" }).click();
  await expect(inspector(page).getByText("Autoplay won't start until Muted is on. Layoutry only autoplays muted videos.")).toBeVisible();
  await expect(inspector(page).getByRole("switch", { name: "Muted" })).toHaveAttribute("aria-checked", "false");
  await expect(placeholder(page, id)).not.toContainText("Autoplay");
  await inspector(page).getByRole("switch", { name: "Muted" }).click();
  await expect(placeholder(page, id)).toContainText("Muted · Autoplay");
});

test("responsive 16:9 by default in Flow, and the placeholder stays inside its box", async ({ page }) => {
  const id = await insertVideoEmbed(page);
  // Both rectangles in one synchronous read: the canvas may still be scrolling to the new element.
  const geometry = () =>
    canvasNode(page, id).evaluate((element) => {
      const outer = element.getBoundingClientRect();
      const inner = element.querySelector("[data-video-embed-placeholder]")?.getBoundingClientRect();
      return { ratio: outer.width / outer.height, aspect: getComputedStyle(element).aspectRatio, outer: [outer.left, outer.top, outer.right, outer.bottom], inner: inner ? [inner.left, inner.top, inner.right, inner.bottom] : null };
    });
  const { ratio, aspect, outer, inner } = await geometry();
  expect(ratio).toBeCloseTo(16 / 9, 1);
  expect(aspect).toBe("16 / 9");
  if (!inner) throw new Error("no placeholder");
  expect(inner[0]).toBeGreaterThanOrEqual(outer[0] - 0.5);
  expect(inner[1]).toBeGreaterThanOrEqual(outer[1] - 0.5);
  expect(inner[2]).toBeLessThanOrEqual(outer[2] + 0.5);
  expect(inner[3]).toBeLessThanOrEqual(outer[3] + 0.5);
});

function freeLayoutDocument(): EditorElementNode {
  return {
    id: "page-root",
    tag: "page",
    children: [
      {
        id: "free-host",
        tag: "div",
        layoutMode: "free",
        dimensions: { preferredWidth: 900, preferredHeight: 500, offsetX: 0, offsetY: 0 },
        children: [
          { id: "video-free", tag: "iframe", title: "YouTube video", controls: true, aspectRatio: { mode: "ratio", width: 16, height: 9 }, src: `https://www.youtube-nocookie.com/embed/${YT}`, freeLayout: { x: 40, y: 40, width: 320, height: 180 } },
        ],
      },
    ],
  };
}

test("drag and resize work on the placeholder like on any element, one Undo step each", async ({ page }) => {
  await importDocument(page, freeLayoutDocument(), "video-free");
  const node = canvasNode(page, "video-free");
  const start = await node.boundingBox();
  if (!start) throw new Error("no box");
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 120, start.y + start.height / 2 + 60, { steps: 10 });
  await page.mouse.up();
  await expect.poll(async () => Math.round(((await node.boundingBox())?.x ?? 0) - start.x)).toBeGreaterThan(80);

  const handle = page.locator('[data-resize-handle="e"]').first();
  const handleBox = await handle.boundingBox();
  if (!handleBox) throw new Error("no resize handle");
  const widthBefore = (await node.boundingBox())?.width ?? 0;
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + 80, handleBox.y + handleBox.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => Math.round(((await node.boundingBox())?.width ?? 0) - widthBefore)).toBeGreaterThan(40);
  await expect(page.locator(`${SURFACE} iframe`)).toHaveCount(0);

  await undo(page);
  await expect.poll(async () => Math.round((await node.boundingBox())?.width ?? 0)).toBe(Math.round(widthBefore));
  await undo(page);
  await expect.poll(async () => Math.round((await node.boundingBox())?.x ?? 0)).toBe(Math.round(start.x));
});

test("save and reopen keep the identity and every setting (Design stays a placeholder)", async ({ page }) => {
  await importDocument(page, { id: "page-root", tag: "page", children: [{ id: "video-empty", tag: "iframe", title: "Embedded video", controls: true, aspectRatio: { mode: "ratio", width: 16, height: 9 } }] }, "video-empty");
  await canvasNode(page, "video-empty").click({ position: { x: 10, y: 10 } });
  await commitUrl(page, `https://youtu.be/${YT}?t=90`);
  await inspector(page).getByRole("switch", { name: "Muted" }).click();
  await inspector(page).getByRole("switch", { name: "Privacy mode" }).click();
  await expect(urlField(page)).toHaveValue(`https://www.youtube.com/embed/${YT}?start=90`);

  await page.keyboard.press("Control+s");
  await expect(page.getByText("Unsaved changes", { exact: true })).toHaveCount(0);
  await page.reload();
  await gotoApp(page);
  await page.keyboard.press("Control+o");
  await page.getByRole("dialog", { name: "Open Project" }).getByRole("button", { name: "Open BC-02.5 parity" }).click();
  await canvasNode(page, "video-empty").waitFor();
  await expect(placeholder(page, "video-empty")).toContainText("Muted · Starts at 1:30");
  await canvasNode(page, "video-empty").click({ position: { x: 10, y: 10 } });
  await expect(urlField(page)).toHaveValue(`https://www.youtube.com/embed/${YT}?start=90`);
  await expect(inspector(page).getByRole("switch", { name: "Muted" })).toHaveAttribute("aria-checked", "true");
  await expect(inspector(page).getByRole("switch", { name: "Privacy mode" })).toHaveAttribute("aria-checked", "false");
  await expect(inspector(page).getByLabel("Start at", { exact: true })).toHaveValue("1:30");
  // Preview playback, lifecycle and export are e2e/video-embed-playback.spec.ts (BC-08.3).
  await expect(page.locator(`${SURFACE} iframe`)).toHaveCount(0);
});

test("generic Embed is unchanged: Source URL field, sandboxed iframe, never a Video Embed", async ({ page }) => {
  const embeds = () => page.locator(`${SURFACE} [data-node-type="iframe"]`).count();
  const before = await embeds();
  await resourcePanel(page).getByRole("tab", { name: "Elements" }).click();
  await resourcePanel(page).getByRole("button", { name: /^Embed\b/ }).click();
  await expect.poll(embeds).toBe(before + 1);
  const source = inspector(page).getByLabel("Source URL", { exact: true });
  await expect(source).toBeVisible();
  await expect(inspector(page).getByLabel("Video URL", { exact: true })).toHaveCount(0);
  // A non-provider page (it never resolves; the suite stays offline): the existing live frame and sandbox.
  await source.fill("https://embed.invalid/page");
  await source.press("Enter");
  const iframe = page.locator(`${SURFACE} [data-node-type="iframe"] iframe`).last();
  await expect(iframe).toHaveAttribute("sandbox", "allow-forms allow-popups allow-scripts allow-same-origin");
  await expect(iframe).not.toHaveAttribute("allow", /.*/);
  await expect(iframe).not.toHaveAttribute("allowfullscreen", /.*/);
  await page.getByRole("tab", { name: "Structure" }).click();
  await expect(page.getByRole("treeitem", { name: /Video Embed/ })).toHaveCount(0);
});

test("keyboard: Video URL, the switches and Start at are reachable and operable without a mouse", async ({ page }) => {
  const id = await insertVideoEmbed(page);
  await urlField(page).focus();
  await page.keyboard.type(`https://youtu.be/${YT}`);
  await page.keyboard.press("Enter");
  await expect(placeholder(page, id)).toContainText("YouTube video");
  const muted = inspector(page).getByRole("switch", { name: "Muted" });
  await urlField(page).focus();
  // Tab order runs from the URL field down the section; reach Muted by Tab alone.
  for (let step = 0; step < 6 && !(await muted.evaluate((element) => element === document.activeElement)); step += 1) await page.keyboard.press("Tab");
  await expect(muted).toBeFocused();
  await page.keyboard.press("Space");
  await expect(muted).toHaveAttribute("aria-checked", "true");
  const start = inspector(page).getByLabel("Start at", { exact: true });
  await start.focus();
  await page.keyboard.type("45");
  await page.keyboard.press("Enter");
  await expect(placeholder(page, id)).toContainText("Starts at 0:45");
});
