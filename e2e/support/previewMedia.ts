import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import type { EditorElementNode } from "../../src/features/editor/types/document";
import { serializeProject } from "../../src/features/project/utils/serializeProject";

/*
 * BC-02.2 — shared media fixtures for the Preview media lifecycle specs
 * (browser and Electron). Everything is local: a committed 4-second VP8
 * WebM (no audio track) and a WAV tone generated here, so no external
 * media host is ever involved.
 */

export const CLIP_FILE = "preview-clip.webm";
export const TONE_FILE = "preview-tone.wav";

export function clipBytes(): Buffer {
  return readFileSync(path.join(__dirname, "..", "fixtures", "media", CLIP_FILE));
}

/** 4 seconds of a quiet 440 Hz sine, 8 kHz mono 16-bit PCM. */
export function toneBytes(): Buffer {
  const rate = 8000;
  const samples = rate * 4;
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + samples * 2, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) {
    wav.writeInt16LE(Math.round(Math.sin((i / rate) * 2 * Math.PI * 440) * 4000), 44 + i * 2);
  }
  return wav;
}

const size = { preferredWidth: 240, preferredHeight: 135, offsetX: 0, offsetY: 0 };

/** Every media configuration the lifecycle specs cover; `base` prefixes the fixture file names. */
export function mediaDocument(base: string): EditorElementNode {
  const clip = `${base}${CLIP_FILE}`;
  const tone = `${base}${TONE_FILE}`;
  return {
    id: "page-root",
    tag: "page",
    children: [
      {
        id: "media-section",
        tag: "section",
        children: [
          { id: "v-auto", htmlId: "v-auto", tag: "video", src: clip, autoplay: true, muted: true, loop: true, dimensions: size },
          { id: "v-plain", htmlId: "v-plain", tag: "video", src: clip, dimensions: size },
          // Autoplay authored WITHOUT mute: Layoutry never starts these by itself (BC-02.2.1).
          { id: "v-sound", htmlId: "v-sound", tag: "video", src: clip, autoplay: true, loop: true, dimensions: size },
          { id: "a-sound", htmlId: "a-sound", tag: "audio", src: tone, autoplay: true, loop: true },
          { id: "v-noctrl", tag: "video", src: clip, controls: false, loop: true, dimensions: size },
          { id: "a-auto", htmlId: "a-auto", tag: "audio", src: tone, autoplay: true, muted: true, loop: true },
          { id: "a-plain", tag: "audio", src: tone, loop: true },
          { id: "b-toggle", tag: "button", text: "Toggle media box", interactions: [{ id: "i-toggle", trigger: "click", action: "toggle", targetId: "d-box" }] },
          { id: "d-box", tag: "div", children: [{ id: "v-nested", tag: "video", src: clip, autoplay: true, muted: true, loop: true, dimensions: size }] },
        ],
      },
    ],
  };
}

export const ALL_MEDIA = ["v-auto", "v-plain", "v-sound", "a-sound", "v-noctrl", "a-auto", "a-plain", "v-nested"] as const;

/** Authored autoplay but not muted: must never start on its own. */
export const UNMUTED_AUTOPLAY = ["v-sound", "a-sound"] as const;

export async function importMediaDocument(page: Page, document: EditorElementNode) {
  const file = serializeProject({
    metadata: { id: "00000000-0000-4000-8000-000000000222", name: "BC-02.2 media", createdAt: "2026-11-05T00:00:00.000Z", updatedAt: "2026-11-05T00:00:00.000Z" },
    document,
  });
  await page.getByTestId("project-import-input").setInputFiles({ name: "media.layoutry", mimeType: "application/json", buffer: Buffer.from(file) });
  await page.locator('[data-document-surface] [data-node-id="v-nested"]').waitFor({ state: "attached", timeout: 60_000 });
}

export interface MediaState {
  paused: boolean;
  currentTime: number;
  muted: boolean;
  autoplay: boolean;
  readyState: number;
}

export function mediaState(page: Page, nodeId: string): Promise<MediaState> {
  return page
    .locator(`[data-document-surface] [data-node-id="${nodeId}"] :is(video, audio)`)
    .evaluate((media: HTMLMediaElement) => ({
      paused: media.paused,
      currentTime: media.currentTime,
      muted: media.muted,
      autoplay: media.autoplay,
      readyState: media.readyState,
    }));
}

/** Starts playback the way a native Play control would (a user gesture is not needed for muted or already-allowed media). */
export function startPlayback(page: Page, nodeId: string): Promise<string> {
  return page
    .locator(`[data-document-surface] [data-node-id="${nodeId}"] :is(video, audio)`)
    .evaluate((media: HTMLMediaElement) => media.play().then(() => "playing", (error: Error) => error.name));
}

/** Waits until every media element has loaded enough to play. */
export async function waitForMediaLoaded(page: Page, ids: readonly string[]) {
  for (const id of ids) {
    await page.waitForFunction(
      (nodeId) => {
        const media = document.querySelector<HTMLMediaElement>(`[data-document-surface] [data-node-id="${nodeId}"] :is(video, audio)`);
        return !!media && media.readyState >= 3;
      },
      id,
      { timeout: 20_000 },
    );
  }
}
