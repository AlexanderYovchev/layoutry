import { expect, test, type Page } from "@playwright/test";
import type { EditorElementNode } from "../src/features/editor/types/document";
import { exportHtmlCss } from "../src/features/export/utils/exportHtmlCss";
import { serializeProject } from "../src/features/project/utils/serializeProject";
import { gotoApp } from "./support/gotoApp";
import { attackPage, landedPage, nextPage, popupPage, startAttackServer, type AttackServer } from "./support/embedAttackPages";

/*
 * BC-02.3 — B4: an authored iframe must not be able to navigate, read or
 * otherwise take over the web editor, in Design or Preview, whether the
 * framed page is cross-origin or on the editor's own origin (the worst
 * case, simulated with a Playwright route), and whether it arrives
 * directly or through a redirect.
 *
 * "Editor intact" is checked on the editor itself — its URL, a marker
 * set in its window (lost on any reload or navigation) and its document
 * — never only from a console message or the frame's own report.
 */

const EDITOR = "http://localhost:3000";
const SAME_ORIGIN_PREFIX = `${EDITOR}/__bc023`;

let attacker: AttackServer;
let second: AttackServer;

test.beforeAll(async () => {
  attacker = await startAttackServer();
  second = await startAttackServer();
});

test.afterAll(async () => {
  await attacker.close();
  await second.close();
});

type FrameOrigin = "cross-origin" | "same-origin";

function embedUrl(origin: FrameOrigin, path = "/attack.html"): string {
  return origin === "cross-origin" ? `${attacker.origin}${path}` : `${SAME_ORIGIN_PREFIX}${path}`;
}

/** Hostile pages on the editor's own origin, landing (on escape) at the attacker's origin. */
async function routeSameOriginPages(page: Page) {
  await page.route(`${SAME_ORIGIN_PREFIX}/**`, (route) => {
    const url = new URL(route.request().url());
    const urls = { landed: attacker.urls.landed, next: `${SAME_ORIGIN_PREFIX}/next.html`, popup: `${SAME_ORIGIN_PREFIX}/popup.html` };
    const body = url.pathname.endsWith("/attack.html")
      ? attackPage(urls, { autoEscape: url.searchParams.has("auto") })
      : url.pathname.endsWith("/next.html")
        ? nextPage()
        : url.pathname.endsWith("/popup.html")
          ? popupPage(attacker.urls.landed)
          : landedPage();
    return route.fulfill({ status: 200, contentType: "text/html", body });
  });
}

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
          { id: "embed", tag: "iframe", src, title: "Embedded content", dimensions: { preferredWidth: 640, preferredHeight: 160, offsetX: 0, offsetY: 0 } },
        ],
      },
    ],
  };
}

async function openEditorWithEmbed(page: Page, src: string) {
  await routeSameOriginPages(page);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await gotoApp(page);
  const file = serializeProject({
    metadata: { id: "00000000-0000-4000-8000-000000000230", name: "BC-02.3 embed", createdAt: "2026-11-05T00:00:00.000Z", updatedAt: "2026-11-05T00:00:00.000Z" },
    document: embedDocument(src),
  });
  await page.evaluate(() => {
    Reflect.set(window, "__bc023Marker", "intact");
    const reports: string[] = [];
    Reflect.set(window, "__bc023Reports", reports);
    window.addEventListener("message", (event: MessageEvent<unknown>) => {
      const data = event.data;
      if (typeof data === "object" && data !== null && Reflect.get(data, "bc023") === true) reports.push(`${String(Reflect.get(data, "attempt"))}=${String(Reflect.get(data, "outcome"))}`);
    });
  });
  await page.getByTestId("project-import-input").setInputFiles({ name: "embed.layoutry", mimeType: "application/json", buffer: Buffer.from(file) });
  await expect(page.locator('[data-document-surface] [data-node-id="embed"] iframe')).toBeAttached({ timeout: 60_000 });
}

function reports(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const value: unknown = Reflect.get(window, "__bc023Reports");
    return Array.isArray(value) ? value.map(String) : [];
  });
}

async function waitForReport(page: Page, prefix: string) {
  await expect.poll(async () => (await reports(page)).some((entry) => entry.startsWith(prefix)), { message: `frame report ${prefix}` }).toBe(true);
}

async function expectEditorIntact(page: Page) {
  // Give any attempted navigation time to commit.
  await page.waitForTimeout(1_200);
  expect(page.url().startsWith(EDITOR)).toBe(true);
  expect(page.url()).not.toContain("landed");
  expect(await page.evaluate(() => Reflect.get(window, "__bc023Marker"))).toBe("intact");
  await expect(page.locator('[data-document-surface] [data-node-id="host-heading"]')).toHaveText("Embed host");
  await expect(page).not.toHaveTitle(/escaped/);
}

const frame = (page: Page) => page.frameLocator('[data-document-surface] [data-node-id="embed"] iframe');
const enterPreview = (page: Page) => page.getByRole("button", { name: "Enter Preview" }).click();
const exitPreview = (page: Page) => page.getByRole("button", { name: "Exit Preview" }).click();

for (const origin of ["cross-origin", "same-origin"] as const) {
  test.describe(`${origin} embed`, () => {
    test("renders with the explicit sandbox and loads its page", async ({ page }) => {
      await openEditorWithEmbed(page, embedUrl(origin));
      const iframe = page.locator('[data-document-surface] [data-node-id="embed"] iframe');
      const tokens = (await iframe.getAttribute("sandbox"))?.split(/\s+/).sort();
      const expected = origin === "cross-origin" ? ["allow-forms", "allow-popups", "allow-same-origin", "allow-scripts"] : ["allow-forms", "allow-popups", "allow-scripts"];
      expect(tokens).toEqual(expected);
      await expect(iframe).toHaveAttribute("title", "Embedded content");
      await waitForReport(page, "loaded=");
      // A same-origin page is put in an opaque origin, so it is not the editor's origin.
      const loaded = (await reports(page)).find((entry) => entry.startsWith("loaded="));
      expect(loaded).toBe(origin === "cross-origin" ? `loaded=origin:${attacker.origin}` : "loaded=origin:null");
    });

    test("Design: a page that tries to escape on load cannot, and the embed stays selectable", async ({ page }) => {
      await openEditorWithEmbed(page, embedUrl(origin, "/attack.html?auto=1"));
      await waitForReport(page, "auto-top=");
      await expectEditorIntact(page);
      const read = (await reports(page)).find((entry) => entry.startsWith("auto-read="));
      expect(read).toMatch(/^auto-read=threw:/);
      await page.locator('[data-document-surface] [data-node-id="embed"]').click();
      await expect(page.getByLabel("Source URL", { exact: true })).toBeVisible();
    });

    for (const attempt of ["link-top", "link-parent", "script-top", "script-parent", "read-parent", "popup"] as const) {
      test(`Preview: a click on ${attempt} cannot leave the frame`, async ({ page, context }) => {
        await openEditorWithEmbed(page, embedUrl(origin));
        await enterPreview(page);
        await waitForReport(page, "loaded=");
        const popup = attempt === "popup" ? context.waitForEvent("page", { timeout: 5_000 }).catch(() => null) : null;
        await frame(page).locator(`#${attempt}`).click();
        await expectEditorIntact(page);
        if (attempt === "read-parent") {
          await waitForReport(page, "read-parent=");
          expect((await reports(page)).find((entry) => entry.startsWith("read-parent="))).toMatch(/^read-parent=threw:/);
        }
        const opened = await popup;
        if (opened) {
          // A popup may open (allow-popups) but stays sandboxed: it cannot navigate the editor.
          await opened.waitForLoadState().catch(() => {});
          await expectEditorIntact(page);
          await opened.close();
        }
        await exitPreview(page);
        await expect(page.locator('[data-document-surface] [data-node-id="embed"]')).toBeVisible();
      });
    }

    test("Preview: ordinary in-frame links and forms still work, inside the frame only", async ({ page }) => {
      await openEditorWithEmbed(page, embedUrl(origin));
      await enterPreview(page);
      await waitForReport(page, "loaded=");
      await frame(page).locator("#in-frame").click();
      await expect(frame(page).locator("#next")).toBeVisible();
      await expectEditorIntact(page);
    });
  });
}

test("Preview: a form submit inside a cross-origin embed navigates only the frame", async ({ page }) => {
  await openEditorWithEmbed(page, embedUrl("cross-origin"));
  await enterPreview(page);
  await waitForReport(page, "loaded=");
  await frame(page).locator("#submit").click();
  await expect(frame(page).locator("#next")).toBeVisible();
  await expectEditorIntact(page);
});

test("redirect chain: a cross-origin redirect to another origin is still sandboxed", async ({ page }) => {
  const target = `${second.origin}/attack.html`;
  await openEditorWithEmbed(page, `${attacker.origin}/redirect?to=${encodeURIComponent(target)}`);
  await enterPreview(page);
  await waitForReport(page, `loaded=origin:${second.origin}`);
  for (const attempt of ["link-top", "script-top", "read-parent"]) {
    await frame(page).locator(`#${attempt}`).click();
    await expectEditorIntact(page);
  }
  expect((await reports(page)).find((entry) => entry.startsWith("read-parent="))).toMatch(/^read-parent=threw:/);
});

test("redirect chain back to the editor's own origin: the editor refuses to load in the frame", async ({ page }) => {
  // Without frame-ancestors 'none' this frame would hold the editor's real
  // origin (its sandbox was decided for the cross-origin URL) and could
  // reach the editor around it.
  await openEditorWithEmbed(page, `${attacker.origin}/redirect?to=${encodeURIComponent(`${EDITOR}/`)}`);
  const response = await page.request.get(`${EDITOR}/`);
  expect(response.headers()["content-security-policy"]).toBe("frame-ancestors 'none'");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  await page.waitForTimeout(2_000);
  const framed = page.frames().filter((candidate) => candidate !== page.mainFrame());
  expect(framed.length).toBe(1);
  // Browsers report a refused frame differently (Chromium: chrome-error,
  // WebKit: the requested URL), so check what matters: the editor's page
  // never loaded inside it.
  const inside = await framed[0]?.evaluate(() => ({ editor: document.querySelector("main") !== null, scripts: document.scripts.length })).catch(() => ({ editor: false, scripts: 0 }));
  expect(inside).toEqual({ editor: false, scripts: 0 });
  await expectEditorIntact(page);
});

test("compatibility: a well-behaved cross-origin widget keeps storage, requests and messaging, exactly as an unsandboxed frame would", async ({ page }) => {
  await openEditorWithEmbed(page, `${attacker.origin}/widget.html?embed`);
  await enterPreview(page);
  // Control: the same page in a plain, unsandboxed iframe on the same host page.
  await page.evaluate((src) => {
    const control = document.createElement("iframe");
    control.src = src;
    control.style.cssText = "position:fixed;right:0;bottom:0;width:10px;height:10px";
    document.body.append(control);
  }, `${attacker.origin}/widget.html?control`);
  await waitForReport(page, "widget=?embed|");
  await waitForReport(page, "widget=?control|");
  const all = await reports(page);
  const embedded = all.find((entry) => entry.startsWith("widget=?embed|"))?.split("|")[1];
  const control = all.find((entry) => entry.startsWith("widget=?control|"))?.split("|")[1];
  expect(embedded).toContain("storage:ok");
  expect(embedded).toContain("fetch:ok");
  expect(embedded).toContain("media-query:ok");
  expect(embedded).toBe(control);
  await expectEditorIntact(page);
});

test("repeated Preview sessions keep the same iframe and frame count, and record no history", async ({ page }) => {
  await openEditorWithEmbed(page, embedUrl("cross-origin"));
  await waitForReport(page, "loaded=");
  await page.locator('[data-document-surface] [data-node-id="embed"] iframe').evaluate((element) => Reflect.set(element, "__bc023Same", true));
  const frames = page.frames().length;
  for (let session = 0; session < 5; session++) {
    await enterPreview(page);
    await exitPreview(page);
  }
  expect(await page.locator('[data-document-surface] [data-node-id="embed"] iframe').evaluate((element) => Reflect.get(element, "__bc023Same"))).toBe(true);
  expect(page.frames().length).toBe(frames);
  expect((await reports(page)).filter((entry) => entry.startsWith("loaded=")).length).toBe(1);
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  await expectEditorIntact(page);
});

for (const src of ["data:text/html,<script>parent.postMessage({bc023:true,attempt:'loaded',outcome:'data'},'*')</script>", "about:blank", "blob:http://localhost:3000/00000000-0000-4000-8000-000000000000", "file:///C:/Windows/win.ini"]) {
  test(`a ${src.split(":")[0]}: embed source is not loaded; the element stays and explains why`, async ({ page }) => {
    await openEditorWithEmbed(page, src);
    const iframe = page.locator('[data-document-surface] [data-node-id="embed"] iframe');
    await expect(iframe).not.toHaveAttribute("src", /.+/);
    await expect(page.locator('[data-canvas-overlay="media-guide"]')).toContainText("http or https");
    await enterPreview(page);
    await expect(iframe).toBeAttached();
    await expect(iframe).toHaveAttribute("title", "Embedded content");
    await page.waitForTimeout(500);
    expect(await reports(page)).toEqual([]);
    await expectEditorIntact(page);
  });
}

test("exported page: the same sandbox keeps a hostile embed inside its frame", async ({ page }) => {
  const result = exportHtmlCss(embedDocument(`${attacker.origin}/attack.html`), { mode: "standalone", title: "Embed" });
  expect(result.ok).toBe(true);
  const html = result.files.find((file) => file.path.endsWith(".html"))?.content ?? "";
  expect(html).toContain('sandbox="allow-forms allow-popups allow-scripts allow-same-origin"');
  const host = second.host("/export-host.html", html);
  await page.goto(host);
  const exported = page.frameLocator("iframe");
  await expect(exported.locator("#link-top")).toBeVisible();
  for (const attempt of ["link-top", "script-top"]) {
    await exported.locator(`#${attempt}`).click();
    await page.waitForTimeout(1_200);
    expect(page.url()).toBe(host);
  }
  await exported.locator("#in-frame").click();
  await expect(exported.locator("#next")).toBeVisible();
});

test("control: the same exported page WITHOUT the sandbox is taken over (the attack page is real)", async ({ page }) => {
  const result = exportHtmlCss(embedDocument(`${attacker.origin}/attack.html`), { mode: "standalone", title: "Embed" });
  const html = (result.files.find((file) => file.path.endsWith(".html"))?.content ?? "").replace(/ sandbox="[^"]*"/, "");
  expect(html).not.toContain("sandbox=");
  const host = second.host("/export-host-unsandboxed.html", html);
  await page.goto(host);
  await page.frameLocator("iframe").locator("#link-top").click();
  await page.waitForURL(attacker.urls.landed);
});
