import { describe, expect, it } from "vitest";
import {
  canResizeElement,
  getEffectiveAspectRatioLocked,
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
    for (const tag of ["div", "section", "h1", "h2", "p", "button", "img", "form", "table", "input"]) {
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

  it("marks ul/ol as containers but li as a text-bearing leaf (Checkpoint 1.6)", () => {
    expect(getElementCapabilities("ul").canContainChildren).toBe(true);
    expect(getElementCapabilities("ol").canContainChildren).toBe(true);
    expect(getElementCapabilities("li").canContainChildren).toBe(false);
    expect(getElementCapabilities("li").supportsTypography).toBe(true);
  });

  it("flags img/video/iframe as supporting an intrinsic aspect ratio; ordinary elements don't", () => {
    expect(getElementCapabilities("img").supportsIntrinsicAspectRatio).toBe(true);
    expect(getElementCapabilities("video").supportsIntrinsicAspectRatio).toBe(true);
    expect(getElementCapabilities("iframe").supportsIntrinsicAspectRatio).toBe(true);
    expect(getElementCapabilities("div").supportsIntrinsicAspectRatio).toBe(false);
  });

  it("flags img/video/iframe as supporting object-fit/object-position; ordinary elements don't (Checkpoint 5.6)", () => {
    expect(getElementCapabilities("img").supportsMediaFit).toBe(true);
    expect(getElementCapabilities("video").supportsMediaFit).toBe(true);
    expect(getElementCapabilities("iframe").supportsMediaFit).toBe(true);
    expect(getElementCapabilities("div").supportsMediaFit).toBe(false);
  });

  it("supportsMediaFit and supportsIntrinsicAspectRatio are independent flags, not aliases (Checkpoint 5.6 split them apart — see elementCapabilities.ts's own doc comment)", () => {
    // Both flags happen to be set together on every current media tag —
    // proving true divergence would need a future tag that answers the
    // two questions differently, which doesn't exist yet. What's checked
    // here is that the two are genuinely separate boolean fields on the
    // capability object (a non-media tag has both false independently,
    // not one derived from the other), not that CAPABILITY_OVERRIDES
    // currently diverges them for any real tag.
    const img = getElementCapabilities("img");
    expect(img.supportsIntrinsicAspectRatio).toBe(true);
    expect(img.supportsMediaFit).toBe(true);
    const div = getElementCapabilities("div");
    expect(div.supportsIntrinsicAspectRatio).toBe(false);
    expect(div.supportsMediaFit).toBe(false);
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

  it("flags nearly every tag as supporting a border, including media tags; only page/body opt out", () => {
    for (const tag of ["div", "section", "h1", "p", "button", "img", "video", "iframe", "form", "table", "input"]) {
      expect(getElementCapabilities(tag).supportsBorder, tag).toBe(true);
    }
    expect(getElementCapabilities("page").supportsBorder).toBe(false);
    expect(getElementCapabilities("body").supportsBorder).toBe(false);
  });

  it("flags nearly every tag as supporting border radius, including media tags; only page/body opt out", () => {
    for (const tag of ["div", "section", "h1", "p", "button", "img", "video", "iframe", "form", "table", "input"]) {
      expect(getElementCapabilities(tag).supportsBorderRadius, tag).toBe(true);
    }
    expect(getElementCapabilities("page").supportsBorderRadius).toBe(false);
    expect(getElementCapabilities("body").supportsBorderRadius).toBe(false);
  });

  it("flags nearly every tag as supporting box shadow, including media tags; only page/body opt out", () => {
    for (const tag of ["div", "section", "h1", "p", "button", "img", "video", "iframe", "form", "table", "input"]) {
      expect(getElementCapabilities(tag).supportsBoxShadow, tag).toBe(true);
    }
    expect(getElementCapabilities("page").supportsBoxShadow).toBe(false);
    expect(getElementCapabilities("body").supportsBoxShadow).toBe(false);
  });

  it("flags nearly every tag as supporting filters, including media tags; only page/body opt out", () => {
    for (const tag of ["div", "section", "h1", "p", "button", "img", "video", "iframe", "form", "table", "input"]) {
      expect(getElementCapabilities(tag).supportsFilters, tag).toBe(true);
    }
    expect(getElementCapabilities("page").supportsFilters).toBe(false);
    expect(getElementCapabilities("body").supportsFilters).toBe(false);
  });

  it("flags nearly every tag as supporting display/visibility/overflow/interaction controls; only page/body opt out", () => {
    for (const tag of ["div", "section", "h1", "p", "button", "img", "video", "iframe", "form", "table", "input"]) {
      expect(getElementCapabilities(tag).supportsDisplay, tag).toBe(true);
    }
    expect(getElementCapabilities("page").supportsDisplay).toBe(false);
    expect(getElementCapabilities("body").supportsDisplay).toBe(false);
  });

  it("flags nearly every tag as supporting the Position control; only page/body opt out", () => {
    for (const tag of ["div", "section", "h1", "p", "button", "img", "video", "iframe", "form", "table", "input"]) {
      expect(getElementCapabilities(tag).supportsPosition, tag).toBe(true);
    }
    expect(getElementCapabilities("page").supportsPosition).toBe(false);
    expect(getElementCapabilities("body").supportsPosition).toBe(false);
  });

  it("flags nearly every tag as supporting the Aspect Ratio control; only page/body opt out", () => {
    for (const tag of ["div", "section", "h1", "p", "button", "img", "video", "iframe", "form", "table", "input"]) {
      expect(getElementCapabilities(tag).supportsAspectRatio, tag).toBe(true);
    }
    expect(getElementCapabilities("page").supportsAspectRatio).toBe(false);
    expect(getElementCapabilities("body").supportsAspectRatio).toBe(false);
  });

  it("supportsAspectRatio and supportsIntrinsicAspectRatio are independent flags, not aliases", () => {
    // A media tag gets both true (Checkpoint 5.5 + the pre-existing
    // Checkpoint 3.5.1 flag); most others get supportsAspectRatio true
    // while supportsIntrinsicAspectRatio stays false — proving the two
    // capabilities are genuinely separate, not one repurposed as the other.
    expect(getElementCapabilities("img").supportsAspectRatio).toBe(true);
    expect(getElementCapabilities("img").supportsIntrinsicAspectRatio).toBe(true);
    expect(getElementCapabilities("div").supportsAspectRatio).toBe(true);
    expect(getElementCapabilities("div").supportsIntrinsicAspectRatio).toBe(false);
  });

  it("flags only `a` as supporting a link destination (Checkpoint 1.4); other text-bearing tags don't", () => {
    expect(getElementCapabilities("a").supportsHref).toBe(true);
    for (const tag of ["h1", "p", "button", "li", "blockquote", "div", "img"]) {
      expect(getElementCapabilities(tag).supportsHref, tag).toBe(false);
    }
  });

  it("flags only h1-h6 as supporting a Heading Level control (Checkpoint 1.7); other text-bearing tags don't", () => {
    for (const tag of ["h1", "h2", "h3", "h4", "h5", "h6"]) {
      expect(getElementCapabilities(tag).supportsHeadingLevel, tag).toBe(true);
    }
    for (const tag of ["p", "button", "a", "li", "blockquote", "div", "img"]) {
      expect(getElementCapabilities(tag).supportsHeadingLevel, tag).toBe(false);
    }
  });

  it("gives every h1-h6 tag identical capabilities otherwise — changing level must not alter Inspector availability", () => {
    const h1 = getElementCapabilities("h1");
    const h6 = getElementCapabilities("h6");
    expect(h6).toEqual(h1);
  });

  it("gives the semantic sectioning family (header/nav/main/article/aside/footer) the same structural capabilities as div/section (Checkpoint 1.8)", () => {
    const structuralTags = ["header", "nav", "main", "article", "aside", "footer"];
    const div = getElementCapabilities("div");

    for (const tag of structuralTags) {
      const caps = getElementCapabilities(tag);
      expect(caps.canContainChildren, tag).toBe(true);
      expect(caps.supportsTypography, tag).toBe(false);
      expect(caps.supportsHref, tag).toBe(false);
      expect(caps.supportsHeadingLevel, tag).toBe(false);
      // Every other structural CSS capability matches div's exactly —
      // no CAPABILITY_OVERRIDES entry was needed for any of these six.
      expect(caps).toEqual(div);
    }
  });

  it("Input is a leaf that gets Typography/Background via an explicit override, not TEXT_BEARING_TAGS/canContainChildren (Checkpoint 1.10)", () => {
    const caps = getElementCapabilities("input");

    expect(caps.canContainChildren).toBe(false);
    expect(caps.supportsTypography).toBe(true);
    expect(caps.supportsBackground).toBe(true);
    expect(caps.supportsFormControl).toBe(true);
  });

  it("flags only Input as supporting the Form Control section (Checkpoint 1.10); other tags don't", () => {
    expect(getElementCapabilities("input").supportsFormControl).toBe(true);
    for (const tag of ["h1", "p", "button", "a", "li", "div", "img", "form", "section"]) {
      expect(getElementCapabilities(tag).supportsFormControl, tag).toBe(false);
    }
  });

  it("gives Input every other default structural capability (border/border radius/box shadow/filters/display/position/aspect ratio), same as any ordinary visual tag", () => {
    const caps = getElementCapabilities("input");
    expect(caps.supportsBorder).toBe(true);
    expect(caps.supportsBorderRadius).toBe(true);
    expect(caps.supportsBoxShadow).toBe(true);
    expect(caps.supportsFilters).toBe(true);
    expect(caps.supportsDisplay).toBe(true);
    expect(caps.supportsPosition).toBe(true);
    expect(caps.supportsAspectRatio).toBe(true);
    expect(caps.supportsHref).toBe(false);
    expect(caps.supportsHeadingLevel).toBe(false);
    expect(caps.supportsIntrinsicAspectRatio).toBe(false);
    expect(caps.supportsMediaFit).toBe(false);
  });

  it("gives Label (Checkpoint 1.11) the same structural capabilities as div/section — a real container, no CAPABILITY_OVERRIDES entry needed", () => {
    const label = getElementCapabilities("label");
    const div = getElementCapabilities("div");

    expect(label.canContainChildren).toBe(true);
    expect(label.supportsTypography).toBe(false);
    expect(label.supportsFormControl).toBe(false);
    expect(label).toEqual(div);
  });

  it("Input's capabilities key off tag alone, never inputType — the function has no node to read inputType from in the first place, so every variant (email/password/number/search/url/tel) is architecturally guaranteed to share Input's one capability set", () => {
    expect(getElementCapabilities("input").supportsFormControl).toBe(true);
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

  describe("getEffectiveAspectRatioLocked (Checkpoint 5.7)", () => {
    it("uses the tag's own capability default when unset (img defaults locked)", () => {
      expect(getEffectiveAspectRatioLocked({ tag: "img" })).toBe(true);
    });

    it("uses the tag's own capability default when unset (a generic container defaults unlocked)", () => {
      expect(getEffectiveAspectRatioLocked({ tag: "div" })).toBe(false);
    });

    it("an explicit true override wins over the tag's own false default", () => {
      expect(getEffectiveAspectRatioLocked({ tag: "div", aspectRatioLocked: true })).toBe(true);
    });

    it("an explicit false override wins over the tag's own true default", () => {
      expect(getEffectiveAspectRatioLocked({ tag: "img", aspectRatioLocked: false })).toBe(false);
    });
  });
});
