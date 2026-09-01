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

  it("flags img/video as supporting an intrinsic aspect ratio; ordinary elements and iframe don't (Checkpoint 1.15 corrected a stale iframe forward declaration — see elementCapabilities.ts's own doc comment)", () => {
    expect(getElementCapabilities("img").supportsIntrinsicAspectRatio).toBe(true);
    expect(getElementCapabilities("video").supportsIntrinsicAspectRatio).toBe(true);
    expect(getElementCapabilities("iframe").supportsIntrinsicAspectRatio).toBe(false);
    expect(getElementCapabilities("div").supportsIntrinsicAspectRatio).toBe(false);
  });

  it("flags img/video as supporting object-fit/object-position; ordinary elements and iframe don't (Checkpoint 5.6 for img/video, Checkpoint 1.15 for the iframe correction — object-fit has no effect on an iframe's own embedded document)", () => {
    expect(getElementCapabilities("img").supportsMediaFit).toBe(true);
    expect(getElementCapabilities("video").supportsMediaFit).toBe(true);
    expect(getElementCapabilities("iframe").supportsMediaFit).toBe(false);
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

  it("flags Input and Textarea as supporting the Form Control section (Checkpoint 1.10, extended to Textarea in 1.12); other tags don't", () => {
    expect(getElementCapabilities("input").supportsFormControl).toBe(true);
    expect(getElementCapabilities("textarea").supportsFormControl).toBe(true);
    for (const tag of ["h1", "p", "button", "a", "li", "div", "img", "form", "label", "section"]) {
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

  it("Input's capabilities key off tag alone, never inputType — the function has no node to read inputType from in the first place, so every variant (email/password/number/search/url/tel/checkbox/radio) is architecturally guaranteed to share Input's one capability set (Checkpoint 1.12 — a deliberate decision, not an oversight: see this checkpoint's own report on why capabilities were kept tag-scoped rather than made inputType-aware for checkbox/radio's genuinely less consistent native styling)", () => {
    expect(getElementCapabilities("input").supportsFormControl).toBe(true);
  });

  it("gives Textarea (Checkpoint 1.12) the same explicit typography/background/form-control overrides as Input — neither a container nor text-bearing (its content is node.value, not node.text)", () => {
    const textarea = getElementCapabilities("textarea");

    expect(textarea.canContainChildren).toBe(false);
    expect(textarea.supportsTypography).toBe(true);
    expect(textarea.supportsBackground).toBe(true);
    expect(textarea.supportsFormControl).toBe(true);
    expect(textarea.supportsBorder).toBe(true);
    expect(textarea.supportsBorderRadius).toBe(true);
    expect(textarea.supportsBoxShadow).toBe(true);
  });

  it("gives Select (Checkpoint 1.13) the same typography/background/form-control overrides as Input/Textarea, plus real container status (it accepts Option children)", () => {
    const select = getElementCapabilities("select");

    expect(select.canContainChildren).toBe(true);
    expect(select.supportsTypography).toBe(true);
    expect(select.supportsBackground).toBe(true);
    expect(select.supportsFormControl).toBe(true);
    expect(select.resizableX).toBe(true);
    expect(select.resizableY).toBe(true);
  });

  it("gives Option (Checkpoint 1.13) the most restricted capability set — not resizable, not a container, and no box-styling controls with nothing to attach to", () => {
    const option = getElementCapabilities("option");

    expect(option.canContainChildren).toBe(false);
    expect(option.resizableX).toBe(false);
    expect(option.resizableY).toBe(false);
    expect(option.supportsTypography).toBe(true);
    expect(option.supportsBackground).toBe(true);
    expect(option.supportsBorder).toBe(false);
    expect(option.supportsBorderRadius).toBe(false);
    expect(option.supportsBoxShadow).toBe(false);
    expect(option.supportsFilters).toBe(false);
    expect(option.supportsDisplay).toBe(false);
    expect(option.supportsPosition).toBe(false);
    expect(option.supportsAspectRatio).toBe(false);
  });

  describe("Table primitives (Checkpoint 1.14)", () => {
    it("Table gets typography and opts out of the generic child Layout section", () => {
      const table = getElementCapabilities("table");

      expect(table.canContainChildren).toBe(true);
      expect(table.supportsTypography).toBe(true);
      expect(table.supportsBackground).toBe(true);
      expect(table.supportsChildLayout).toBe(false);
      // Ordinary box-model capabilities stay at their DEFAULT_CAPABILITIES
      // true — a Table is an ordinary top-level box (see this
      // checkpoint's report, section J).
      expect(table.resizableX).toBe(true);
      expect(table.resizableY).toBe(true);
      expect(table.supportsBorder).toBe(true);
      expect(table.supportsBorderRadius).toBe(true);
      expect(table.supportsBoxShadow).toBe(true);
      expect(table.supportsFilters).toBe(true);
      expect(table.supportsDisplay).toBe(true);
      expect(table.supportsPosition).toBe(true);
      expect(table.supportsAspectRatio).toBe(true);
    });

    it("Thead/Tbody/Tfoot are all identically restricted — not resizable/positionable/sized, no Display or child Layout control, but border/typography/background stay available", () => {
      for (const tag of ["thead", "tbody", "tfoot"]) {
        const caps = getElementCapabilities(tag);
        expect(caps.canContainChildren, tag).toBe(true);
        expect(caps.resizableX, tag).toBe(false);
        expect(caps.resizableY, tag).toBe(false);
        expect(caps.supportsAspectRatio, tag).toBe(false);
        expect(caps.supportsPosition, tag).toBe(false);
        expect(caps.supportsDisplay, tag).toBe(false);
        expect(caps.supportsBorderRadius, tag).toBe(false);
        expect(caps.supportsBoxShadow, tag).toBe(false);
        expect(caps.supportsFilters, tag).toBe(false);
        expect(caps.supportsChildLayout, tag).toBe(false);
        expect(caps.supportsBorder, tag).toBe(true);
        expect(caps.supportsTypography, tag).toBe(true);
        expect(caps.supportsBackground, tag).toBe(true);
      }
    });

    it("Tr shares Thead/Tbody/Tfoot's exact restricted shape", () => {
      const tr = getElementCapabilities("tr");
      expect(tr.canContainChildren).toBe(true);
      expect(tr.resizableX).toBe(false);
      expect(tr.resizableY).toBe(false);
      expect(tr.supportsAspectRatio).toBe(false);
      expect(tr.supportsPosition).toBe(false);
      expect(tr.supportsDisplay).toBe(false);
      expect(tr.supportsBorderRadius).toBe(false);
      expect(tr.supportsBoxShadow).toBe(false);
      expect(tr.supportsFilters).toBe(false);
      expect(tr.supportsChildLayout).toBe(false);
      expect(tr.supportsBorder).toBe(true);
      expect(tr.supportsTypography).toBe(true);
      expect(tr.supportsBackground).toBe(true);
    });

    it("Th/Td are text-bearing leaves — typography/background derive automatically via TEXT_BEARING_TAGS, no explicit override needed for either", () => {
      for (const tag of ["th", "td"]) {
        const caps = getElementCapabilities(tag);
        expect(caps.canContainChildren, tag).toBe(false);
        expect(caps.supportsTypography, tag).toBe(true);
        expect(caps.supportsBackground, tag).toBe(true);
      }
    });

    it("Th/Td are not Canvas-resizable, and opt out of Display/Position (would silently break native table-cell layout), but keep Size/border/border-radius/box-shadow/filters", () => {
      for (const tag of ["th", "td"]) {
        const caps = getElementCapabilities(tag);
        expect(caps.resizableX, tag).toBe(false);
        expect(caps.resizableY, tag).toBe(false);
        expect(caps.supportsDisplay, tag).toBe(false);
        expect(caps.supportsPosition, tag).toBe(false);
        expect(caps.supportsAspectRatio, tag).toBe(true);
        expect(caps.supportsBorder, tag).toBe(true);
        expect(caps.supportsBorderRadius, tag).toBe(true);
        expect(caps.supportsBoxShadow, tag).toBe(true);
        expect(caps.supportsFilters, tag).toBe(true);
      }
    });

    it("Select also opts out of the child Layout section (Checkpoint 1.14 closed this known Checkpoint 1.13 edge case)", () => {
      expect(getElementCapabilities("select").supportsChildLayout).toBe(false);
    });

    it("every ordinary container tag still defaults supportsChildLayout to true — unrelated containers are unaffected", () => {
      for (const tag of ["div", "section", "ul", "ol", "form", "label", "header", "main"]) {
        expect(getElementCapabilities(tag).supportsChildLayout, tag).toBe(true);
      }
    });
  });

  describe("Video + Iframe (Checkpoint 1.15)", () => {
    it("Video is a leaf (not a container), not text-bearing, and does not opt into a child-Layout section", () => {
      const video = getElementCapabilities("video");
      expect(video.canContainChildren).toBe(false);
      expect(video.supportsTypography).toBe(false);
      expect(video.supportsBackground).toBe(false);
    });

    it("Video shares Image's exact media override — resizable/sizing/border/border-radius/box-shadow/filters/display/position all stay at their DEFAULT_CAPABILITIES true", () => {
      const video = getElementCapabilities("video");
      expect(video.resizableX).toBe(true);
      expect(video.resizableY).toBe(true);
      expect(video.supportsIntrinsicAspectRatio).toBe(true);
      expect(video.supportsMediaFit).toBe(true);
      expect(video.supportsBorder).toBe(true);
      expect(video.supportsBorderRadius).toBe(true);
      expect(video.supportsBoxShadow).toBe(true);
      expect(video.supportsFilters).toBe(true);
      expect(video.supportsDisplay).toBe(true);
      expect(video.supportsPosition).toBe(true);
      expect(video.supportsAspectRatio).toBe(true);
    });

    it("Iframe is a leaf, not text-bearing, and does NOT get Image/Video's media-fit override (Checkpoint 1.15 corrected a stale forward declaration)", () => {
      const iframe = getElementCapabilities("iframe");
      expect(iframe.canContainChildren).toBe(false);
      expect(iframe.supportsTypography).toBe(false);
      expect(iframe.supportsBackground).toBe(false);
      expect(iframe.supportsIntrinsicAspectRatio).toBe(false);
      expect(iframe.supportsMediaFit).toBe(false);
    });

    it("Iframe still gets every other useful box-model capability from DEFAULT_CAPABILITIES — sizing/resize/position/border/border-radius/box-shadow/filters/display", () => {
      const iframe = getElementCapabilities("iframe");
      expect(iframe.resizableX).toBe(true);
      expect(iframe.resizableY).toBe(true);
      expect(iframe.supportsAspectRatio).toBe(true);
      expect(iframe.supportsPosition).toBe(true);
      expect(iframe.supportsBorder).toBe(true);
      expect(iframe.supportsBorderRadius).toBe(true);
      expect(iframe.supportsBoxShadow).toBe(true);
      expect(iframe.supportsFilters).toBe(true);
      expect(iframe.supportsDisplay).toBe(true);
    });

    it("neither Video nor Iframe exposes the child-Layout section — both are leaves (canContainChildren already gates it, no override needed for either)", () => {
      expect(getElementCapabilities("video").canContainChildren).toBe(false);
      expect(getElementCapabilities("iframe").canContainChildren).toBe(false);
    });
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
