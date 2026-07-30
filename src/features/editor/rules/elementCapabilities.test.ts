import { describe, expect, it } from "vitest";
import {
  canResizeElement,
  getElementCapabilities,
  isSelectableElement,
} from "./elementCapabilities";

describe("elementCapabilities", () => {
  it("makes the document root non-selectable and non-resizable, but still a valid container", () => {
    const caps = getElementCapabilities("page");

    expect(caps.selectable).toBe(false);
    expect(caps.resizableX).toBe(false);
    expect(caps.resizableY).toBe(false);
    expect(caps.canContainChildren).toBe(true);
  });

  it("makes the body wrapper non-selectable and non-resizable, but still a valid container", () => {
    const caps = getElementCapabilities("body");

    expect(caps.selectable).toBe(false);
    expect(caps.resizableX).toBe(false);
    expect(caps.resizableY).toBe(false);
    expect(caps.canContainChildren).toBe(true);
  });

  it("makes every other known tag selectable and resizable by default — no hardcoded 3-tag allowlist", () => {
    for (const tag of ["div", "section", "h1", "h2", "p", "button", "img", "form", "table"]) {
      const caps = getElementCapabilities(tag);
      expect(caps.selectable, tag).toBe(true);
      expect(caps.resizableX, tag).toBe(true);
      expect(caps.resizableY, tag).toBe(true);
    }
  });

  it("marks container tags as able to contain children (delegates to insertionRules)", () => {
    expect(getElementCapabilities("div").canContainChildren).toBe(true);
    expect(getElementCapabilities("section").canContainChildren).toBe(true);
    expect(getElementCapabilities("h1").canContainChildren).toBe(false);
    expect(getElementCapabilities("img").canContainChildren).toBe(false);
  });

  it("flags img/video/iframe as supporting an intrinsic aspect ratio; ordinary elements don't", () => {
    expect(getElementCapabilities("img").supportsIntrinsicAspectRatio).toBe(true);
    expect(getElementCapabilities("video").supportsIntrinsicAspectRatio).toBe(true);
    expect(getElementCapabilities("iframe").supportsIntrinsicAspectRatio).toBe(true);
    expect(getElementCapabilities("div").supportsIntrinsicAspectRatio).toBe(false);
  });

  it("flags text-bearing tags (including ones with no factory yet) as supporting typography; structural/media tags don't", () => {
    for (const tag of ["h1", "h2", "h3", "h4", "h5", "h6", "p", "button", "a", "li", "blockquote"]) {
      expect(getElementCapabilities(tag).supportsTypography, tag).toBe(true);
    }
    for (const tag of ["div", "section", "img", "page", "body"]) {
      expect(getElementCapabilities(tag).supportsTypography, tag).toBe(false);
    }
  });

  it("flags container and text-bearing tags as supporting a background; media tags don't", () => {
    for (const tag of ["div", "section", "form", "ul", "li", "header", "table", "h1", "p", "button", "a", "blockquote"]) {
      expect(getElementCapabilities(tag).supportsBackground, tag).toBe(true);
    }
    for (const tag of ["img", "video", "iframe"]) {
      expect(getElementCapabilities(tag).supportsBackground, tag).toBe(false);
    }
  });

  it("gives an entirely unknown tag the same sensible defaults as any other element", () => {
    const caps = getElementCapabilities("some-future-tag");

    expect(caps.selectable).toBe(true);
    expect(caps.resizableX).toBe(true);
    expect(caps.resizableY).toBe(true);
    expect(caps.canContainChildren).toBe(false);
  });

  describe("canResizeElement", () => {
    it("is true for a default (universally resizable) tag", () => {
      expect(canResizeElement("h1")).toBe(true);
      expect(canResizeElement("p")).toBe(true);
      expect(canResizeElement("button")).toBe(true);
    });

    it("is false for the document root and body wrapper", () => {
      expect(canResizeElement("page")).toBe(false);
      expect(canResizeElement("body")).toBe(false);
    });
  });

  describe("isSelectableElement", () => {
    it("is true for ordinary content tags", () => {
      expect(isSelectableElement("div")).toBe(true);
      expect(isSelectableElement("h1")).toBe(true);
    });

    it("is false for the document root and body wrapper", () => {
      expect(isSelectableElement("page")).toBe(false);
      expect(isSelectableElement("body")).toBe(false);
    });
  });
});
