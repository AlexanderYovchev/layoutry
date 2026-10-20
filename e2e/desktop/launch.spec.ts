import { expect, test } from "@playwright/test";
import path from "node:path";
import {
  EXPORT_ROOT,
  launchLayoutry,
  nonAppRequests,
  type LaunchedLayoutry,
} from "./support/layoutryApp";

let layoutry: LaunchedLayoutry;

test.beforeAll(async () => {
  layoutry = await launchLayoutry();
});

test.afterAll(async () => {
  await layoutry?.dispose();
});

test("opens one hardened Layoutry window on app://layoutry/", async () => {
  const { app, page } = layoutry;
  await expect(page).toHaveTitle("Layoutry");
  expect(page.url()).toBe("app://layoutry/");

  const shell = await app.evaluate(
    ({ app: electronApp, BrowserWindow, Menu }) => {
      const windows = BrowserWindow.getAllWindows();
      const window = windows[0];
      // devTools: false makes this a no-op.
      window.webContents.openDevTools();
      const renderers = electronApp
        .getAppMetrics()
        .filter((metric) => metric.type === "Tab");
      return {
        windows: windows.length,
        title: window.getTitle(),
        visible: window.isVisible(),
        resizable: window.isResizable(),
        minimumSize: window.getMinimumSize(),
        applicationMenu: Menu.getApplicationMenu(),
        devToolsOpened: window.webContents.isDevToolsOpened(),
        renderers: renderers.length,
        allRenderersSandboxed: renderers.every(
          (metric) => metric.sandboxed === true,
        ),
      };
    },
  );
  expect(shell).toEqual({
    windows: 1,
    title: "Layoutry",
    visible: true,
    resizable: true,
    minimumSize: [900, 600],
    applicationMenu: null,
    devToolsOpened: false,
    renderers: expect.any(Number),
    allRenderersSandboxed: true,
  });
  expect(shell.renderers).toBeGreaterThan(0);

  // webviewTag: false — <webview> is an inert element without Electron's
  // WebView API, and no custom element is registered for it.
  expect(
    await page.evaluate(() => ({
      registered: customElements.get("webview") !== undefined,
      hasWebViewApi:
        "getWebContentsId" in document.createElement("webview") ||
        "loadURL" in document.createElement("webview"),
    })),
  ).toEqual({ registered: false, hasWebViewApi: false });
});

test("loads entirely offline from the bundled export, with no CSP violations or console errors", async () => {
  const { app, page } = layoutry;
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(String(error)));

  // An in-app reload (app:// is the one allowed navigation target) so the
  // whole load — HTML, chunks, CSS, fonts, hydration — happens under the
  // listeners above and the request recorder installed at launch.
  await page.evaluate(() => {
    document.addEventListener("securitypolicyviolation", (event) =>
      console.error(`CSP ${event.effectiveDirective} ${event.blockedURI}`),
    );
    location.assign("app://layoutry/");
  });
  await page.waitForLoadState("load");
  await expect(
    page.locator("[data-document-surface] h1").first(),
  ).toBeVisible();

  const resources = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .concat(location.href),
  );
  expect(resources.length).toBeGreaterThan(5);
  expect(resources.filter((url) => !url.startsWith("app://layoutry/"))).toEqual(
    [],
  );

  // The only non-app:// requests are the protocol handler reading its own
  // export directory from disk — never the network.
  const exportPrefix =
    `file:///${EXPORT_ROOT.split(path.sep).join("/")}/`.toLowerCase();
  const nonApp = await nonAppRequests(app);
  expect(
    nonApp.filter(
      (url) => !decodeURI(url).toLowerCase().startsWith(exportPrefix),
    ),
  ).toEqual([]);

  expect(consoleErrors).toEqual([]);
});

test("hydrates the editor with its CSS and local Inter font", async () => {
  const { page } = layoutry;
  await expect(
    page.getByRole("complementary", { name: "Resource panel" }),
  ).toBeVisible();
  await expect(page.getByRole("main", { name: "Workspace" })).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "Inspector panel" }),
  ).toBeVisible();
  await expect(page.locator("[data-document-surface]").first()).toBeVisible();

  const styling = await page.evaluate(async () => {
    await document.fonts.ready;
    return {
      styleSheets: document.styleSheets.length,
      bodyFont: getComputedStyle(document.body).fontFamily,
      interFaces: Array.from(document.fonts)
        .filter(
          (face) => face.family.includes("Inter") && face.status === "loaded",
        )
        .map((face) => face.family),
      interAvailable: document.fonts.check('16px "Inter"'),
    };
  });
  expect(styling.styleSheets).toBeGreaterThan(0);
  expect(styling.bodyFont).toMatch(/^Inter\b/);
  expect(styling.interFaces.length).toBeGreaterThan(0);
  expect(styling.interAvailable).toBe(true);

  // Hydrated: a Canvas click reaches React and updates the Inspector.
  await page.locator("[data-document-surface] h1").first().click();
  await expect(
    page
      .getByRole("complementary", { name: "Inspector panel" })
      .getByText("heading-1"),
  ).toBeVisible();
});

test("serves the export over app:// with strict, predictable responses", async () => {
  const { page } = layoutry;
  const results = await page.evaluate(async () => {
    const scriptPath = new URL(
      document.querySelector<HTMLScriptElement>("script[src]")?.src ?? "/",
    ).pathname;
    // @font-face urls are relative to their stylesheet, not the page.
    const fontPath = Array.from(document.styleSheets)
      .flatMap((sheet) =>
        Array.from(sheet.cssRules).map((rule) => {
          const url = rule.cssText.match(/url\("?([^")]+\.woff2)"?\)/)?.[1];
          return url
            ? new URL(url, sheet.href ?? document.baseURI).pathname
            : null;
        }),
      )
      .find((url): url is string => typeof url === "string");

    async function probe(url: string, init?: RequestInit) {
      const response = await fetch(url, init);
      return {
        status: response.status,
        type: response.headers.get("content-type"),
        csp: response.headers.get("content-security-policy") !== null,
        bodyLength: (await response.text()).length,
      };
    }
    return {
      root: await probe("/"),
      script: await probe(scriptPath),
      scriptWithQuery: await probe(`${scriptPath}?v=1#frag`),
      font: fontPath ? await probe(fontPath) : null,
      head: await probe("/", { method: "HEAD" }),
      post: await probe("/", { method: "POST", body: "x" }),
      missing: await probe("/_next/static/does-not-exist.js"),
      encodedTraversal: await probe("/..%2Fpackage.json"),
      encodedBackslash: await probe("/..%5Cpackage.json"),
      malformed: await probe("/%E0%A4%A"),
      normalizedDots: await probe("/%2e%2e/%2e%2e/package.json"),
      sourceFile: await probe("/src/app/page.tsx"),
      desktopMain: await probe("/desktop-dist/main/main.js"),
      packageJson: await probe("/package.json"),
    };
  });

  expect(results.root).toMatchObject({
    status: 200,
    type: "text/html; charset=utf-8",
    csp: true,
  });
  expect(results.script).toMatchObject({
    status: 200,
    type: "text/javascript; charset=utf-8",
  });
  expect(results.scriptWithQuery.status).toBe(200);
  expect(results.scriptWithQuery.bodyLength).toBe(results.script.bodyLength);
  expect(results.font).toMatchObject({ status: 200, type: "font/woff2" });
  expect(results.head).toMatchObject({ status: 200, bodyLength: 0 });
  expect(results.post.status).toBe(405);
  expect(results.missing.status).toBe(404);
  expect(results.encodedTraversal.status).toBe(400);
  expect(results.encodedBackslash.status).toBe(400);
  expect(results.malformed.status).toBe(400);
  // Dot segments are normalized by the URL parser to /package.json inside
  // the export, which does not exist there — the repository's does.
  expect(results.normalizedDots.status).toBe(404);
  expect(results.sourceFile.status).toBe(404);
  expect(results.desktopMain.status).toBe(404);
  expect(results.packageJson.status).toBe(404);
});
