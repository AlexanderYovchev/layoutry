import { expect, test } from "@playwright/test";
import {
  extractedExe,
  launchPackaged,
  pageCount,
  type PackagedLayoutry,
} from "./support/packagedApp";
import { listeningPorts, processTree } from "./support/windows";

/**
 * The security rules are unit-tested and verified in dev Electron
 * (e2e/desktop); this re-checks the ones that matter most against the
 * fuse-hardened, ASAR-packed executable a tester actually runs.
 */

let layoutry: PackagedLayoutry;

test.beforeAll(async () => {
  layoutry = await launchPackaged(extractedExe());
});

test.afterAll(async () => {
  await layoutry?.dispose();
});

test("the app opens no local network services of its own", async () => {
  // Only the DevTools port this test passed on the command line may listen;
  // Layoutry itself runs no server (no localhost, no loopback HTTP).
  const pids = processTree(layoutry.pid).map((process) => process.pid);
  expect(listeningPorts(pids)).toEqual([layoutry.devToolsPort]);
});

test("the renderer and its iframes have no Node.js or file access", async () => {
  const { page } = layoutry;
  const probe = () =>
    ["require", "process", "module", "Buffer", "global", "__dirname"].map(
      (name) => `${name}:${typeof Reflect.get(globalThis, name)}`,
    );
  const expected = [
    "require:undefined",
    "process:undefined",
    "module:undefined",
    "Buffer:undefined",
    "global:undefined",
    "__dirname:undefined",
  ];
  expect(await page.evaluate(probe)).toEqual(expected);

  await page.evaluate(() => {
    const frame = document.createElement("iframe");
    frame.id = "packaged-node-probe";
    document.body.append(frame);
  });
  const frame = await (await page.$("#packaged-node-probe"))?.contentFrame();
  expect(await frame?.evaluate(probe)).toEqual(expected);
  await page.evaluate(() =>
    document.getElementById("packaged-node-probe")?.remove(),
  );

  const fileAccess = await page.evaluate(() =>
    fetch("file:///C:/Windows/win.ini").then(
      () => "read",
      () => "blocked",
    ),
  );
  expect(fileAccess).toBe("blocked");
});

test("the app:// protocol serves only the export, from inside app.asar", async () => {
  const { page } = layoutry;
  const statuses = await page.evaluate(async () => {
    const status = async (url: string, init?: RequestInit) =>
      (await fetch(url, init)).status;
    return {
      root: await status("/"),
      head: await status("/", { method: "HEAD" }),
      post: await status("/", { method: "POST", body: "x" }),
      missing: await status("/_next/static/nope.js"),
      encodedTraversal: await status("/..%2Fpackage.json"),
      encodedBackslash: await status("/..%5C..%5Cpackage.json"),
      malformed: await status("/%E0%A4%A"),
      // Inside app.asar but outside out/: never reachable.
      asarManifest: await status("/package.json"),
      asarMainProcess: await status("/desktop-dist/main/main.js"),
      normalizedDots: await status("/%2e%2e/package.json"),
    };
  });
  expect(statuses).toEqual({
    root: 200,
    head: 200,
    post: 405,
    missing: 404,
    encodedTraversal: 400,
    encodedBackslash: 400,
    malformed: 400,
    asarManifest: 404,
    asarMainProcess: 404,
    normalizedDots: 404,
  });
});

test("navigation away from the app, popups and permissions are all denied", async () => {
  const { page, browser } = layoutry;
  await page.evaluate(() => Reflect.set(window, "__sameDocument", true));
  for (const target of [
    "https://example.com/",
    "file:///C:/Windows/win.ini",
    "layoutry-unregistered-scheme:test",
  ]) {
    await page.evaluate((url) => {
      try {
        location.href = url;
      } catch {
        // a synchronous throw is also a block
      }
    }, target);
    await page.waitForTimeout(500);
    expect(page.url(), target).toBe("app://layoutry/");
    expect(
      await page.evaluate(() => Reflect.get(window, "__sameDocument")),
      target,
    ).toBe(true);
  }

  const pagesBefore = pageCount(browser);
  const popups = await page.evaluate(() =>
    [
      "https://example.com/",
      "app://layoutry/",
      "file:///C:/Windows/win.ini",
    ].map((url) => window.open(url) === null),
  );
  expect(popups).toEqual([true, true, true]);
  await page.waitForTimeout(500);
  expect(pageCount(browser)).toBe(pagesBefore);

  const permissions = await page.evaluate(async () => ({
    notifications: await Notification.requestPermission(),
    camera: await navigator.mediaDevices.getUserMedia({ video: true }).then(
      () => "granted",
      (error: unknown) => (error instanceof Error ? error.name : "error"),
    ),
    geolocation: await new Promise<string>((resolve) =>
      navigator.geolocation.getCurrentPosition(
        () => resolve("granted"),
        (error) => resolve(`error-${error.code}`),
        { timeout: 5_000 },
      ),
    ),
  }));
  expect(permissions).toEqual({
    notifications: "denied",
    camera: "NotAllowedError",
    geolocation: "error-1",
  });
});

test("the CSP is delivered and enforced by the packaged protocol", async () => {
  const { page } = layoutry;
  const result = await page.evaluate(async () => {
    const csp = (await fetch("/")).headers.get("content-security-policy");
    const violations: string[] = [];
    const record = (event: SecurityPolicyViolationEvent) =>
      violations.push(event.effectiveDirective);
    document.addEventListener("securitypolicyviolation", record);
    const added: Element[] = [];
    const add = (element: Element) => {
      document.body.append(element);
      added.push(element);
    };
    add(
      Object.assign(document.createElement("script"), {
        src: "https://example.com/x.js",
      }),
    );
    add(
      Object.assign(document.createElement("iframe"), {
        src: "app://layoutry/",
      }),
    );
    add(
      Object.assign(document.createElement("object"), {
        data: "https://example.com/x.swf",
      }),
    );
    add(
      Object.assign(document.createElement("img"), {
        src: "https://example.com/photo.png",
      }),
    );
    const connect = await fetch("https://example.com/").then(
      () => "allowed",
      () => "blocked",
    );
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    document.removeEventListener("securitypolicyviolation", record);
    added.forEach((element) => element.remove());
    return { csp, violations, connect };
  });
  expect(result.csp).toContain("script-src 'self' 'unsafe-inline'");
  expect(result.csp).not.toContain("unsafe-eval");
  expect(result.violations).toEqual(
    expect.arrayContaining([
      "script-src-elem",
      "frame-src",
      "object-src",
      "connect-src",
    ]),
  );
  expect(result.violations).not.toContain("img-src");
  expect(result.connect).toBe("blocked");
});
