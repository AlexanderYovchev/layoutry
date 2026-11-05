import { describe, expect, it } from "vitest";
import { EXPORTED_PAGE_ORIGIN, resolveIframeSourcePolicy } from "./iframeSandbox";

const EDITOR = "http://localhost:3000";
const DESKTOP = "app://layoutry";
const STRICT = "allow-forms allow-popups allow-scripts";
const CROSS = `${STRICT} allow-same-origin`;
const NEVER = ["allow-top-navigation", "allow-top-navigation-by-user-activation", "allow-top-navigation-to-custom-protocols", "allow-popups-to-escape-sandbox", "allow-modals", "allow-downloads"];

describe("resolveIframeSourcePolicy (BC-02.3)", () => {
  it.each([
    ["https://www.example.com/embed", CROSS],
    ["http://example.com/embed", CROSS],
    ["//example.com/embed", CROSS],
    ["http://127.0.0.1:3000/", CROSS],
    ["http://localhost:3001/", CROSS],
    ["https://localhost:3000/", CROSS],
  ])("frames %s from another origin, keeping its own origin", (src, sandbox) => {
    expect(resolveIframeSourcePolicy(src, EDITOR)).toEqual({ src, refused: false, sandbox });
  });

  it.each(["/", "/embed.html", "embed.html", "./a/b", "?q=1", "#top", "http://localhost:3000/x", "//localhost:3000/x", "HTTP://LOCALHOST:3000/"])(
    "frames the same-origin URL %s WITHOUT allow-same-origin (it would otherwise reach into the editor)",
    (src) => {
      expect(resolveIframeSourcePolicy(src, EDITOR)).toEqual({ src, refused: false, sandbox: STRICT });
    },
  );

  it.each([
    "data:text/html,<script>top.location='https://evil.test'</script>",
    "DATA:text/html;base64,PHNjcmlwdD4=",
    "blob:http://localhost:3000/00000000-0000-4000-8000-000000000000",
    "file:///C:/Windows/win.ini",
    "about:blank",
    "about:srcdoc",
    "javascript:alert(1)",
    " JavaScript:alert(1)",
    "java\tscript:alert(1)",
    "\u0000javascript:alert(1)",
    "vbscript:msgbox(1)",
    "ftp://example.com/file",
    "app://layoutry/",
    "chrome://settings",
    "http://",
    "https://[bad",
  ])("refuses %j: no src is rendered, and the sandbox stays strict", (src) => {
    expect(resolveIframeSourcePolicy(src, EDITOR)).toEqual({ src: undefined, refused: true, sandbox: STRICT });
  });

  it("treats an unset or blank source as empty, not refused", () => {
    expect(resolveIframeSourcePolicy(undefined, EDITOR)).toEqual({ src: undefined, refused: false, sandbox: STRICT });
    expect(resolveIframeSourcePolicy("   ", EDITOR)).toEqual({ src: undefined, refused: false, sandbox: STRICT });
  });

  it("in the desktop app (app://layoutry) frames web URLs and refuses app:// ones, matching the desktop CSP's frame-src http: https:", () => {
    expect(resolveIframeSourcePolicy("https://example.com/embed", DESKTOP)).toEqual({ src: "https://example.com/embed", refused: false, sandbox: CROSS });
    expect(resolveIframeSourcePolicy("/index.html", DESKTOP).refused).toBe(true);
    expect(resolveIframeSourcePolicy("app://layoutry/index.html", DESKTOP).refused).toBe(true);
  });

  it("for an exported page treats relative URLs as same-origin and absolute ones as another origin", () => {
    expect(resolveIframeSourcePolicy("widget.html", EXPORTED_PAGE_ORIGIN).sandbox).toBe(STRICT);
    expect(resolveIframeSourcePolicy("/widget.html", EXPORTED_PAGE_ORIGIN).sandbox).toBe(STRICT);
    expect(resolveIframeSourcePolicy("https://maps.example.com/embed", EXPORTED_PAGE_ORIGIN).sandbox).toBe(CROSS);
    expect(resolveIframeSourcePolicy("//player.example.com/v/1", EXPORTED_PAGE_ORIGIN).sandbox).toBe(CROSS);
  });

  it("returns the authored source unchanged", () => {
    const src = "https://example.com/embed?a=1&b=two#frag";
    expect(resolveIframeSourcePolicy(src, EDITOR).src).toBe(src);
  });

  it("never grants top navigation, sandbox escape, modals or downloads, for any input", () => {
    const inputs = [undefined, "", "https://a.example/", "/", "data:,x", "//b.example/", "http://localhost:3000/"];
    for (const host of [EDITOR, DESKTOP, EXPORTED_PAGE_ORIGIN]) {
      for (const src of inputs) {
        const tokens = resolveIframeSourcePolicy(src, host).sandbox.split(" ");
        for (const token of NEVER) expect(tokens).not.toContain(token);
        expect(tokens).toContain("allow-scripts");
      }
    }
  });
});
