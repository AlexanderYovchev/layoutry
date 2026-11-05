import { expect, test, type Page } from "@playwright/test";
import {
  ALL_MEDIA,
  CLIP_FILE,
  TONE_FILE,
  UNMUTED_AUTOPLAY,
  clipBytes,
  importMediaDocument,
  mediaDocument,
  mediaState,
  startPlayback,
  toneBytes,
  waitForMediaLoaded,
} from "../support/previewMedia";
import {
  copyApp,
  launchLayoutry,
  nonAppRequests,
  removeDir,
  type LaunchedLayoutry,
} from "./support/layoutryApp";

/**
 * BC-02.2 — B2 and B3 in the real Electron window, with its real security
 * settings and the offline network black hole. The media fixtures ship
 * inside a copy of the static export, so they load from app:// (allowed
 * by the existing `media-src 'self'`), and no network request is made.
 */

let root: string;
let layoutry: LaunchedLayoutry;

test.beforeEach(async () => {
  const copy = await copyApp("layoutry-preview-media", {
    [CLIP_FILE]: clipBytes(),
    [TONE_FILE]: toneBytes(),
  });
  root = copy.root;
  layoutry = await launchLayoutry({ appPath: copy.appDir });
});

test.afterEach(async () => {
  await layoutry?.dispose();
  if (root) await removeDir(root);
});

async function expectPlaying(page: Page, nodeId: string) {
  await expect
    .poll(async () => (await mediaState(page, nodeId)).paused, {
      message: `${nodeId} should be playing`,
    })
    .toBe(false);
  const start = (await mediaState(page, nodeId)).currentTime;
  await expect
    .poll(async () => (await mediaState(page, nodeId)).currentTime, {
      message: `${nodeId} position should advance`,
    })
    .toBeGreaterThan(start + 0.2);
}

async function expectStopped(page: Page, nodeId: string) {
  await expect
    .poll(async () => (await mediaState(page, nodeId)).paused, {
      message: `${nodeId} should be paused`,
    })
    .toBe(true);
  const at = (await mediaState(page, nodeId)).currentTime;
  await page.waitForTimeout(400);
  expect(
    (await mediaState(page, nodeId)).currentTime,
    `${nodeId} must not keep advancing`,
  ).toBe(at);
}

test("muted-only autoplay starts in Preview and every video and audio stops when Preview exits, in the desktop app", async () => {
  const { app, page } = layoutry;
  await importMediaDocument(page, mediaDocument(""));
  await waitForMediaLoaded(page, ALL_MEDIA);
  for (const id of ALL_MEDIA)
    expect((await mediaState(page, id)).paused, id).toBe(true);

  for (let session = 0; session < 2; session++) {
    await page.getByRole("button", { name: "Enter Preview" }).click();
    // B2: loaded in Design first, still starts when Preview opens.
    await expectPlaying(page, "v-auto");
    await expectPlaying(page, "a-auto");
    expect((await mediaState(page, "v-auto")).muted).toBe(true);
    // Muted-only autoplay (BC-02.2.1): unmuted autoplay is left paused.
    for (const id of ["v-plain", ...UNMUTED_AUTOPLAY])
      expect((await mediaState(page, id)).paused, id).toBe(true);

    // B3: user-started media too, including unmuted audio.
    await page
      .locator('[data-document-surface] [data-node-id="v-plain"] video')
      .click();
    for (const id of ["v-plain", "v-noctrl", "a-plain"])
      expect(await startPlayback(page, id), id).toBe("playing");
    for (const id of ["v-plain", "a-plain"]) await expectPlaying(page, id);

    await page.getByRole("button", { name: "Exit Preview" }).click();
    for (const id of ALL_MEDIA) await expectStopped(page, id);
  }

  // The app:// handler reads the fixtures through file://; nothing may touch the network.
  expect(
    (await nonAppRequests(app)).filter((url) => /^(https?|wss?):/i.test(url)),
  ).toEqual([]);
});
