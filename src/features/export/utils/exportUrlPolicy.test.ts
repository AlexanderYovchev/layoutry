// @vitest-environment node
import { describe, expect, it } from "vitest";
import { checkExportUrl } from "@/features/export/utils/exportUrlPolicy";

describe("checkExportUrl", () => {
  it.each(["https://example.com/a", "http://example.com", "mailto:hi@example.com", "tel:+15551234", "#section", "/about", "page.html", "//cdn.example.com/x"])(
    "allows %s as a link",
    (url) => {
      expect(checkExportUrl(url, "link").ok).toBe(true);
    },
  );

  it.each(["javascript:alert(1)", "JaVaScRiPt:alert(1)", " javascript:alert(1)", "java\tscript:alert(1)", "java\nscript:alert(1)", "\u0001javascript:alert(1)", "vbscript:msgbox(1)", "data:text/html,<script>alert(1)</script>"])(
    "refuses %j as a link",
    (url) => {
      expect(checkExportUrl(url, "link")).toMatchObject({ ok: false, reason: "unsafe" });
    },
  );

  it("allows only image data as an image and only audio/video data as media", () => {
    expect(checkExportUrl("data:image/png;base64,AAAA", "image")).toMatchObject({ ok: true, kind: "data" });
    expect(checkExportUrl("data:image/svg+xml;utf8,<svg/>", "image")).toMatchObject({ ok: true, kind: "data" });
    expect(checkExportUrl("data:video/mp4;base64,AAAA", "image").ok).toBe(false);
    expect(checkExportUrl("data:video/mp4;base64,AAAA", "media")).toMatchObject({ ok: true, kind: "data" });
    expect(checkExportUrl("data:text/html,x", "media").ok).toBe(false);
  });

  it("never lets a frame load data: or script URLs", () => {
    expect(checkExportUrl("data:text/html,<p>x</p>", "frame").ok).toBe(false);
    expect(checkExportUrl("data:image/png;base64,AAAA", "frame").ok).toBe(false);
    expect(checkExportUrl("https://www.youtube.com/embed/x", "frame").ok).toBe(true);
  });

  it("classifies session-only URLs as non-portable", () => {
    expect(checkExportUrl("blob:https://app/123", "image")).toMatchObject({ ok: false, reason: "non-portable", scheme: "blob" });
    expect(checkExportUrl("file:///C:/photo.png", "image")).toMatchObject({ ok: false, reason: "non-portable", scheme: "file" });
  });

  it("returns allowed URLs exactly as authored and classifies them", () => {
    expect(checkExportUrl("images/a b.png", "image")).toEqual({ ok: true, url: "images/a b.png", kind: "relative" });
    expect(checkExportUrl("https://example.com/i.png", "image")).toEqual({ ok: true, url: "https://example.com/i.png", kind: "remote" });
    expect(checkExportUrl("   ", "image")).toEqual({ ok: false, reason: "empty" });
  });
});
