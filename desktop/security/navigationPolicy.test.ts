// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  isAllowedSubframeNavigation,
  isAllowedTopLevelNavigation,
  isAppUrl,
} from "./navigationPolicy";

describe("isAppUrl", () => {
  it("accepts only the bundled app origin", () => {
    expect(isAppUrl("app://layoutry/")).toBe(true);
    expect(isAppUrl("app://layoutry/_next/static/a.js")).toBe(true);
    expect(isAppUrl("app://other/")).toBe(false);
    expect(isAppUrl("app://layoutry:1/")).toBe(false);
    expect(isAppUrl("app://u:p@layoutry/")).toBe(false);
    expect(isAppUrl("not a url")).toBe(false);
  });
});

describe("isAllowedTopLevelNavigation", () => {
  it("allows the app itself", () => {
    expect(isAllowedTopLevelNavigation("app://layoutry/")).toBe(true);
  });

  it.each([
    "https://example.com",
    "http://example.com",
    "file:///C:/Windows/win.ini",
    "javascript:alert(1)",
    "data:text/html,<h1>x</h1>",
    "mailto:someone@example.com",
    "ms-settings:privacy",
    "about:blank",
    "app://evil/",
    "",
  ])("denies %j", (url) => {
    expect(isAllowedTopLevelNavigation(url)).toBe(false);
  });
});

describe("isAllowedSubframeNavigation", () => {
  it.each(["https://example.com/embed", "http://example.com", "about:blank"])(
    "allows %j",
    (url) => {
      expect(isAllowedSubframeNavigation(url)).toBe(true);
    },
  );

  it.each([
    "file:///C:/Users/secret.txt",
    "app://layoutry/",
    "javascript:alert(1)",
    "data:text/html,x",
    "ms-settings:privacy",
    "about:srcdoc",
  ])("denies %j", (url) => {
    expect(isAllowedSubframeNavigation(url)).toBe(false);
  });
});
