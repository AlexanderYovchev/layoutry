import http from "node:http";
import type { AddressInfo } from "node:net";
import type { Page } from "@playwright/test";
import { createDropdownButtonNode } from "../../src/features/editor/factories/buttonCompositions";
import { createDismissibleAlertNode, createManualToastNode, createPopoverNode } from "../../src/features/editor/factories/feedbackCompositions";
import { createBasicTabsNode, createCollapsibleNode, createDrawerNode, createModalNode } from "../../src/features/editor/factories/interactionCompositions";
import type { EditorElementNode } from "../../src/features/editor/types/document";
import { serializeProject } from "../../src/features/project/utils/serializeProject";
import { CLIP_FILE, TONE_FILE, clipBytes, toneBytes } from "./previewMedia";

/*
 * BC-02.5 — shared fixtures for the Preview/Export parity specs (B5 hidden
 * media, B6 aria-expanded, B7 reduced motion). Local media only, served
 * from loopback with byte ranges; the exported page is served from the
 * same server so it is a real page on a real origin.
 */

export interface ParityServer {
  base: string;
  host: (path: string, html: string) => string;
  close: () => Promise<void>;
}

export async function startParityServer(): Promise<ParityServer> {
  const files = new Map<string, { body: Buffer; type: string }>([
    [`/${CLIP_FILE}`, { body: clipBytes(), type: "video/webm" }],
    [`/${TONE_FILE}`, { body: toneBytes(), type: "audio/wav" }],
  ]);
  const server = http.createServer((request, response) => {
    const file = files.get(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
    if (!file) {
      response.writeHead(404).end();
      return;
    }
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Accept-Ranges", "bytes");
    response.setHeader("Content-Type", file.type);
    response.setHeader("Cache-Control", "no-store");
    const range = /bytes=(\d+)-(\d*)/.exec(request.headers.range ?? "");
    if (range) {
      const start = Number(range[1]);
      const end = range[2] ? Number(range[2]) : file.body.length - 1;
      response.writeHead(206, { "Content-Range": `bytes ${start}-${end}/${file.body.length}`, "Content-Length": end - start + 1 });
      response.end(file.body.subarray(start, end + 1));
      return;
    }
    response.writeHead(200, { "Content-Length": file.body.length });
    response.end(file.body);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  return {
    base,
    host: (path, html) => {
      files.set(path, { body: Buffer.from(html), type: "text/html; charset=utf-8" });
      return `${base.slice(0, -1)}${path}`;
    },
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

const size = { preferredWidth: 200, preferredHeight: 112, offsetX: 0, offsetY: 0 };

/**
 * Media inside interaction targets (B5):
 * - "Toggle panel" toggles a visible panel holding a plain looping video,
 *   a muted autoplay video, and audio nested three levels deep;
 * - "Toggle hidden" toggles an initially hidden panel holding a muted
 *   autoplay video and a plain video.
 */
export function hiddenMediaDocument(base: string): EditorElementNode {
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
          { id: "b-panel", tag: "button", text: "Toggle panel", htmlId: "b-panel", interactions: [{ id: "i-panel", trigger: "click", action: "toggle", targetId: "d-panel" }] },
          {
            id: "d-panel",
            tag: "div",
            children: [
              { id: "v-loop", htmlId: "v-loop", tag: "video", src: clip, loop: true, dimensions: size },
              { id: "v-auto", htmlId: "v-auto", tag: "video", src: clip, autoplay: true, muted: true, loop: true, dimensions: size },
              { id: "deep-1", tag: "div", children: [{ id: "deep-2", tag: "div", children: [{ id: "a-deep", htmlId: "a-deep", tag: "audio", src: tone, loop: true }] }] },
            ],
          },
          { id: "b-hidden", tag: "button", text: "Toggle hidden", htmlId: "b-hidden", interactions: [{ id: "i-hidden", trigger: "click", action: "toggle", targetId: "d-hidden" }] },
          {
            id: "d-hidden",
            tag: "div",
            initialPreviewVisibility: "hidden",
            children: [
              { id: "v-hidden-auto", htmlId: "v-hidden-auto", tag: "video", src: clip, autoplay: true, muted: true, loop: true, dimensions: size },
              { id: "v-hidden-plain", htmlId: "v-hidden-plain", tag: "video", src: clip, loop: true, dimensions: size },
            ],
          },
        ],
      },
    ],
  };
}

function walk(node: EditorElementNode, visit: (node: EditorElementNode) => void) {
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
}

/** Every built-in interactive composition, each trigger given an html id (t-1, t-2, ...) so the same trigger can be found in Preview and on the exported page. */
export function componentsDocument(): { document: EditorElementNode; triggerIds: string[] } {
  const children = [createDropdownButtonNode(), createCollapsibleNode(), createPopoverNode(), createDrawerNode(), createModalNode(), createBasicTabsNode(), createManualToastNode(), createDismissibleAlertNode()];
  const document: EditorElementNode = { id: "page-root", tag: "page", children: [{ id: "components", tag: "section", children }] };
  const triggerIds: string[] = [];
  walk(document, (node) => {
    if ((node.interactions?.length ?? 0) > 0 && (node.tag === "button" || node.tag === "a")) {
      node.htmlId = `t-${triggerIds.length + 1}`;
      triggerIds.push(node.htmlId);
    }
  });
  return { document, triggerIds };
}

/** A box with an authored 500 ms opacity transition after a 200 ms delay, toggled by a button (B7). */
export function motionDocument(): EditorElementNode {
  return {
    id: "page-root",
    tag: "page",
    children: [
      {
        id: "motion-section",
        tag: "section",
        children: [
          { id: "b-motion", tag: "button", text: "Toggle box", htmlId: "b-motion", interactions: [{ id: "i-motion", trigger: "click", action: "toggle", targetId: "d-motion" }] },
          { id: "d-motion", tag: "div", htmlId: "d-motion", transition: { property: "opacity", durationMs: 500, timingFunction: "ease", delayMs: 200 }, children: [{ id: "p-motion", tag: "p", text: "Animated box" }] },
        ],
      },
    ],
  };
}

export async function importDocument(page: Page, document: EditorElementNode, waitForNodeId: string) {
  const file = serializeProject({
    metadata: { id: "00000000-0000-4000-8000-000000000250", name: "BC-02.5 parity", createdAt: "2026-11-05T00:00:00.000Z", updatedAt: "2026-11-05T00:00:00.000Z" },
    document,
  });
  await page.getByTestId("project-import-input").setInputFiles({ name: "parity.layoutry", mimeType: "application/json", buffer: Buffer.from(file) });
  await page.locator(`[data-document-surface] [data-node-id="${waitForNodeId}"]`).waitFor({ state: "attached", timeout: 60_000 });
}
