import { expect, test } from "@playwright/test";
import {
  copyApp,
  launchLayoutry,
  removeDir,
  windowCount,
  type LaunchedLayoutry,
} from "./support/layoutryApp";

let layoutry: LaunchedLayoutry;

test.beforeAll(async () => {
  layoutry = await launchLayoutry();
});

test.afterAll(async () => {
  await layoutry?.dispose();
});

async function markDocument() {
  await layoutry.page.evaluate(() =>
    Reflect.set(window, "__sameDocument", true),
  );
}

async function isSameDocument() {
  return layoutry.page.evaluate(
    () => Reflect.get(window, "__sameDocument") === true,
  );
}

test("blocks top-level navigation away from app://layoutry/", async () => {
  const { page } = layoutry;
  await markDocument();
  for (const target of [
    "https://example.com/",
    "http://example.com/",
    "file:///C:/Windows/win.ini",
    "layoutry-unregistered-scheme:test",
    "app://other-host/",
  ]) {
    await page.evaluate((url) => {
      try {
        location.href = url;
      } catch {
        // some schemes throw synchronously; that is also a block
      }
    }, target);
    await page.waitForTimeout(500);
    expect(page.url(), target).toBe("app://layoutry/");
    expect(await isSameDocument(), target).toBe(true);
  }

  // An authored form submission cannot navigate the app either.
  await page.evaluate(() => {
    const form = document.createElement("form");
    form.action = "https://example.com/submit";
    form.method = "get";
    document.body.append(form);
    form.submit();
    form.remove();
  });
  await page.waitForTimeout(500);
  expect(page.url()).toBe("app://layoutry/");
  expect(await isSameDocument()).toBe(true);
});

test("blocks every popup and new window", async () => {
  const { app, page } = layoutry;
  const results = await page.evaluate(() => {
    const opened = [
      "https://example.com/",
      "http://example.com/",
      "file:///C:/Windows/win.ini",
      "app://layoutry/",
      "about:blank",
    ].map((url) => window.open(url) === null);

    const link = document.createElement("a");
    link.href = "https://example.com/";
    link.target = "_blank";
    document.body.append(link);
    link.click();
    link.remove();
    return opened;
  });
  expect(results).toEqual([true, true, true, true, true]);
  await page.waitForTimeout(500);
  expect(await windowCount(app)).toBe(1);
});

test("denies browser permission requests", async () => {
  const { page } = layoutry;
  const permissions = await page.evaluate(async () => {
    const outcome = (promise: Promise<unknown>) =>
      promise.then(
        () => "granted",
        (error: unknown) =>
          error instanceof Error ? error.name : String(error),
      );
    return {
      notifications: await Notification.requestPermission(),
      geolocation: await new Promise<string>((resolve) =>
        navigator.geolocation.getCurrentPosition(
          () => resolve("granted"),
          (error) => resolve(`error-${error.code}`),
          { timeout: 5_000 },
        ),
      ),
      camera: await outcome(
        navigator.mediaDevices.getUserMedia({ video: true }),
      ),
      microphone: await outcome(
        navigator.mediaDevices.getUserMedia({ audio: true }),
      ),
      clipboardRead: await outcome(navigator.clipboard.readText()),
    };
  });
  expect(permissions).toEqual({
    notifications: "denied",
    geolocation: "error-1",
    camera: "NotAllowedError",
    microphone: "NotAllowedError",
    clipboardRead: "NotAllowedError",
  });
});

test("gives neither the editor nor authored iframes any Node.js or file access", async () => {
  const { page } = layoutry;
  const nodeGlobals = () =>
    ["require", "process", "module", "Buffer", "global", "__dirname"].map(
      (name) => `${name}:${typeof Reflect.get(globalThis, name)}`,
    );

  const editorGlobals = await page.evaluate(
    (names) =>
      names.map((name) => `${name}:${typeof Reflect.get(globalThis, name)}`),
    ["require", "process", "module", "Buffer", "global", "__dirname"],
  );
  expect(editorGlobals).toEqual([
    "require:undefined",
    "process:undefined",
    "module:undefined",
    "Buffer:undefined",
    "global:undefined",
    "__dirname:undefined",
  ]);

  await page.evaluate(() => {
    const frame = document.createElement("iframe");
    frame.id = "node-probe-frame";
    document.body.append(frame);
  });
  const frameElement = await page.$("#node-probe-frame");
  const contentFrame = await frameElement?.contentFrame();
  expect(contentFrame).toBeTruthy();
  expect(await contentFrame?.evaluate(nodeGlobals)).toEqual(editorGlobals);
  await page.evaluate(() =>
    document.getElementById("node-probe-frame")?.remove(),
  );

  const fileAccess = await page.evaluate(async () => {
    const fetchResult = await fetch("file:///C:/Windows/win.ini").then(
      () => "read",
      () => "blocked",
    );
    const imageResult = await new Promise<string>((resolve) => {
      const image = new Image();
      image.onload = () => resolve("loaded");
      image.onerror = () => resolve("blocked");
      image.src = "file:///C:/Windows/Web/Screen/img100.jpg";
    });
    return { fetchResult, imageResult };
  });
  expect(fileAccess).toEqual({
    fetchResult: "blocked",
    imageResult: "blocked",
  });
});

test("enforces the desktop CSP while allowing authored remote media and iframes", async () => {
  const { page } = layoutry;
  const consoleErrors: string[] = [];
  const listener = (message: { type(): string; text(): string }) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  };
  page.on("console", listener);

  const result = await page.evaluate(async () => {
    const violations: string[] = [];
    const record = (event: SecurityPolicyViolationEvent) =>
      violations.push(`${event.effectiveDirective} ${event.blockedURI}`);
    document.addEventListener("securitypolicyviolation", record);
    const added: Element[] = [];
    const add = <T extends Element>(element: T) => {
      document.body.append(element);
      added.push(element);
      return element;
    };

    // Allowed: authored remote media and iframes (they simply fail offline).
    add(
      Object.assign(document.createElement("img"), {
        src: "https://example.com/photo.png",
      }),
    );
    add(
      Object.assign(document.createElement("video"), {
        src: "https://example.com/clip.mp4",
      }),
    );
    add(
      Object.assign(document.createElement("audio"), {
        src: "http://example.com/sound.mp3",
      }),
    );
    add(
      Object.assign(document.createElement("iframe"), {
        src: "https://example.com/embed",
      }),
    );

    // Blocked.
    add(
      Object.assign(document.createElement("script"), {
        src: "https://example.com/evil.js",
      }),
    );
    add(
      Object.assign(document.createElement("iframe"), {
        src: "app://layoutry/",
      }),
    );
    add(
      Object.assign(document.createElement("iframe"), {
        src: "file:///C:/Windows/win.ini",
      }),
    );
    add(
      Object.assign(document.createElement("object"), {
        data: "https://example.com/plugin.swf",
      }),
    );
    add(
      Object.assign(document.createElement("embed"), {
        src: "https://example.com/plugin.swf",
      }),
    );
    const connect = await fetch("https://example.com/api").then(
      () => "allowed",
      () => "blocked",
    );
    // React-style inline style attributes must apply.
    const styled = add(document.createElement("div"));
    styled.setAttribute("style", "width: 123px; height: 7px;");

    await new Promise((resolve) => setTimeout(resolve, 1_500));
    const styledWidth = getComputedStyle(styled).width;
    document.removeEventListener("securitypolicyviolation", record);
    added.forEach((element) => element.remove());
    return { violations, connect, styledWidth };
  });
  page.off("console", listener);

  const blockedDirectives = result.violations.map(
    (violation) => violation.split(" ")[0],
  );
  expect(blockedDirectives).toEqual(
    expect.arrayContaining([
      "script-src-elem",
      "frame-src",
      "object-src",
      "connect-src",
    ]),
  );
  expect(result.violations.join("\n")).not.toMatch(/img-src|media-src/);
  expect(result.violations.filter((v) => v.startsWith("frame-src"))).toEqual([
    "frame-src app",
  ]);
  expect(result.connect).toBe("blocked");
  expect(result.styledWidth).toBe("123px");
  // file: frames are refused by Chromium itself before CSP is consulted.
  expect(consoleErrors.join("\n")).toContain(
    "Not allowed to load local resource",
  );
});

/**
 * Code injected through Playwright/DevTools is exempt from CSP's eval
 * check (and so is a <script> it creates), so the eval and inline-script
 * rules can only be proven by the page's own script. A probe page is added
 * to a temporary copy of the app's export — never to the real build — and
 * reports its findings through document.title.
 */
test("page scripts may run inline but can never eval", async () => {
  const probe = `<!doctype html><title>pending</title><script>
    var results = ["inline:ran"];
    try { eval("1"); results.push("eval:allowed"); } catch (error) { results.push("eval:blocked"); }
    try { new Function("return 1")(); results.push("function:allowed"); } catch (error) { results.push("function:blocked"); }
    document.title = results.join(",");
  </script>`;
  const { root, appDir } = await copyApp("layoutry-csp-probe", {
    "csp-probe.html": probe,
  });
  const probed = await launchLayoutry({ appPath: appDir });
  try {
    const { page } = probed;
    // app:// to app:// navigation is the one kind the window allows.
    await page.evaluate(() => location.assign("app://layoutry/csp-probe.html"));
    await page.waitForURL("app://layoutry/csp-probe.html");
    await expect(page).not.toHaveTitle("pending");
    expect((await page.title()).split(",")).toEqual([
      "inline:ran",
      "eval:blocked",
      "function:blocked",
    ]);
  } finally {
    await probed.dispose();
    await removeDir(root);
  }
});
