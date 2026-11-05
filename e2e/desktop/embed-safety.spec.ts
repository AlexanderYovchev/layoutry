import { expect, test, type Page } from "@playwright/test";
import type { EditorElementNode } from "../../src/features/editor/types/document";
import { serializeProject } from "../../src/features/project/utils/serializeProject";
import {
  attackPage,
  landedPage,
  nextPage,
  popupPage,
} from "../support/embedAttackPages";
import { launchLayoutry, type LaunchedLayoutry } from "./support/layoutryApp";

/**
 * BC-02.3 — B4 in the real Electron window. The app keeps every security
 * setting it ships with. Only this test instance's main process serves a
 * fake https://embed.test/ origin from memory (the suite is offline), so a
 * hostile embed can be loaded without any network.
 */

const EMBED_ORIGIN = "https://embed.test";
const APP_URL = "app://layoutry/";

let layoutry: LaunchedLayoutry;

test.beforeEach(async () => {
  layoutry = await launchLayoutry();
  const urls = {
    landed: `${EMBED_ORIGIN}/landed.html`,
    next: `${EMBED_ORIGIN}/next.html`,
    popup: `${EMBED_ORIGIN}/popup.html`,
  };
  const pages: Record<string, string> = {
    "/attack.html": attackPage(urls),
    "/attack-auto.html": attackPage(urls, { autoEscape: true }),
    "/landed.html": landedPage(),
    "/next.html": nextPage(),
    "/popup.html": popupPage(urls.landed),
  };
  await layoutry.app.evaluate(({ session }, served) => {
    const origin = "https://embed.test";
    // Replaces launchLayoutry's recorder, which cancels every https request.
    session.defaultSession.webRequest.onBeforeRequest((details, callback) =>
      callback({
        cancel:
          /^(https?|wss?|ftp):/i.test(details.url) &&
          !details.url.startsWith(`${origin}/`),
      }),
    );
    session.defaultSession.protocol.handle("https", (request) => {
      const path = new URL(request.url).pathname;
      const body = request.url.startsWith(`${origin}/`)
        ? served[path]
        : undefined;
      return body === undefined
        ? new Response("not found", { status: 404 })
        : new Response(body, {
            headers: { "content-type": "text/html; charset=utf-8" },
          });
    });
  }, pages);
});

test.afterEach(async () => {
  await layoutry?.dispose();
});

function embedDocument(src: string): EditorElementNode {
  return {
    id: "page-root",
    tag: "page",
    children: [
      {
        id: "host-section",
        tag: "section",
        children: [
          { id: "host-heading", tag: "h2", text: "Embed host" },
          {
            id: "embed",
            tag: "iframe",
            src,
            title: "Embedded content",
            dimensions: {
              preferredWidth: 640,
              preferredHeight: 160,
              offsetX: 0,
              offsetY: 0,
            },
          },
        ],
      },
    ],
  };
}

async function importEmbed(page: Page, src: string) {
  await page.evaluate(() => {
    Reflect.set(window, "__bc023Marker", "intact");
    const reports: string[] = [];
    Reflect.set(window, "__bc023Reports", reports);
    window.addEventListener("message", (event: MessageEvent<unknown>) => {
      const data = event.data;
      if (
        typeof data === "object" &&
        data !== null &&
        Reflect.get(data, "bc023") === true
      )
        reports.push(
          `${String(Reflect.get(data, "attempt"))}=${String(Reflect.get(data, "outcome"))}`,
        );
    });
  });
  const file = serializeProject({
    metadata: {
      id: "00000000-0000-4000-8000-000000000231",
      name: "BC-02.3 embed",
      createdAt: "2026-11-05T00:00:00.000Z",
      updatedAt: "2026-11-05T00:00:00.000Z",
    },
    document: embedDocument(src),
  });
  await page.getByTestId("project-import-input").setInputFiles({
    name: "embed.layoutry",
    mimeType: "application/json",
    buffer: Buffer.from(file),
  });
  await expect(
    page.locator('[data-document-surface] [data-node-id="embed"] iframe'),
  ).toBeAttached({ timeout: 30_000 });
}

function reports(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const value: unknown = Reflect.get(window, "__bc023Reports");
    return Array.isArray(value) ? value.map(String) : [];
  });
}

async function expectAppIntact(page: Page) {
  await page.waitForTimeout(1_200);
  expect(page.url()).toBe(APP_URL);
  expect(await page.evaluate(() => Reflect.get(window, "__bc023Marker"))).toBe(
    "intact",
  );
  await expect(
    page.locator('[data-document-surface] [data-node-id="host-heading"]'),
  ).toHaveText("Embed host");
}

test("a hostile embed cannot navigate, read or open privileged windows from the desktop app", async () => {
  const { app, page } = layoutry;
  await importEmbed(page, `${EMBED_ORIGIN}/attack.html`);
  const iframe = page.locator(
    '[data-document-surface] [data-node-id="embed"] iframe',
  );
  await expect(iframe).toHaveAttribute(
    "sandbox",
    "allow-forms allow-popups allow-scripts allow-same-origin",
  );
  await expect
    .poll(() => reports(page))
    .toContain(`loaded=origin:${EMBED_ORIGIN}`);

  await page.getByRole("button", { name: "Enter Preview" }).click();
  const frame = page.frameLocator(
    '[data-document-surface] [data-node-id="embed"] iframe',
  );
  for (const attempt of [
    "link-top",
    "link-parent",
    "script-top",
    "script-parent",
    "read-parent",
    "popup",
  ]) {
    await frame.locator(`#${attempt}`).click();
    await expectAppIntact(page);
  }
  expect(
    (await reports(page)).find((entry) => entry.startsWith("read-parent=")),
  ).toMatch(/^read-parent=threw:/);
  // No popup or extra window was opened.
  expect(
    await app.evaluate(
      ({ BrowserWindow }) => BrowserWindow.getAllWindows().length,
    ),
  ).toBe(1);
  // No Node.js reaches the embed.
  const embedFrame = page
    .frames()
    .find((candidate) => candidate.url().startsWith(EMBED_ORIGIN));
  expect(
    await embedFrame?.evaluate(() => ({
      require: typeof Reflect.get(window, "require"),
      process: typeof Reflect.get(window, "process"),
      bridge: typeof Reflect.get(window, "layoutryDesktop"),
    })),
  ).toEqual({
    require: "undefined",
    process: "undefined",
    bridge: "undefined",
  });

  // In-frame navigation still works, inside the frame only.
  await frame.locator("#in-frame").click();
  await expect(frame.locator("#next")).toBeVisible();
  await expectAppIntact(page);
  await page.getByRole("button", { name: "Exit Preview" }).click();
  await expect(iframe).toBeVisible();
});

test("an embed that tries to escape as soon as it loads, in Design, cannot", async () => {
  const { page } = layoutry;
  await importEmbed(page, `${EMBED_ORIGIN}/attack-auto.html`);
  await expect
    .poll(async () =>
      (await reports(page)).some((entry) => entry.startsWith("auto-top=")),
    )
    .toBe(true);
  await expectAppIntact(page);
  expect(
    (await reports(page)).find((entry) => entry.startsWith("auto-read=")),
  ).toMatch(/^auto-read=threw:/);
});
