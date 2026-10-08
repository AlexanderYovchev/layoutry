import { describe, expect, it } from "vitest";
import {
  canResizeElement,
  getEffectiveAspectRatioLocked,
  getElementCapabilities,
  intersectElementCapabilities,
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

  it("flags ONLY the narrow container/layout-primitive allowlist as shape-capable (Checkpoint 1.15.4)", () => {
    for (const tag of ["div", "section", "header", "nav", "main", "article", "aside", "footer", "form", "label"]) {
      expect(getElementCapabilities(tag).supportsShape, tag).toBe(true);
    }
    for (const tag of [
      "h1",
      "p",
      "button",
      "a",
      "img",
      "video",
      "iframe",
      "input",
      "textarea",
      "select",
      "option",
      "table",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "th",
      "td",
      "ul",
      "ol",
      "page",
      "body",
    ]) {
      expect(getElementCapabilities(tag).supportsShape, tag).toBe(false);
    }
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

  describe("Audio (Checkpoint 1.15.6.12.3)", () => {
    it("Audio is a leaf (not a container) and not text-bearing", () => {
      const audio = getElementCapabilities("audio");
      expect(audio.canContainChildren).toBe(false);
      expect(audio.supportsTypography).toBe(false);
    });

    it("Audio gets NO supportsIntrinsicAspectRatio/supportsMediaFit — unlike Video/Image, no visual replaced content exists for object-fit, and no ratio worth resize-locking", () => {
      const audio = getElementCapabilities("audio");
      expect(audio.supportsIntrinsicAspectRatio).toBe(false);
      expect(audio.supportsMediaFit).toBe(false);
    });

    it("Audio DOES get supportsBackground — unlike Video/Image/Iframe — verified live: a native audio control bar keeps a fixed ~54px height regardless of wrapper height, so a resized wrapper can genuinely reveal background behind it", () => {
      expect(getElementCapabilities("audio").supportsBackground).toBe(true);
      for (const tag of ["img", "video", "iframe"]) {
        expect(getElementCapabilities(tag).supportsBackground, tag).toBe(false);
      }
    });

    it("Audio still gets every other useful box-model capability from DEFAULT_CAPABILITIES — resize/sizing/position/border/border-radius/box-shadow/filters/display", () => {
      const audio = getElementCapabilities("audio");
      expect(audio.resizableX).toBe(true);
      expect(audio.resizableY).toBe(true);
      expect(audio.supportsAspectRatio).toBe(true);
      expect(audio.supportsPosition).toBe(true);
      expect(audio.supportsBorder).toBe(true);
      expect(audio.supportsBorderRadius).toBe(true);
      expect(audio.supportsBoxShadow).toBe(true);
      expect(audio.supportsFilters).toBe(true);
      expect(audio.supportsDisplay).toBe(true);
      expect(audio.selectable).toBe(true);
    });

    it("Audio does not expose the child-Layout section — a leaf (canContainChildren already gates it, no override needed)", () => {
      expect(getElementCapabilities("audio").canContainChildren).toBe(false);
    });
  });

  describe("Progress (Checkpoint 1.15.6.12.4)", () => {
    it("Progress is a leaf (not a container) and not text-bearing", () => {
      const progress = getElementCapabilities("progress");
      expect(progress.canContainChildren).toBe(false);
      expect(progress.supportsTypography).toBe(false);
    });

    it("Progress needs ZERO CAPABILITY_OVERRIDES entries — every DEFAULT_CAPABILITIES default is already correct, verified live (border/border-radius/box-shadow/opacity all visibly take effect; background does not, matching the default-false already in place for a non-container/non-text-bearing tag)", () => {
      const progress = getElementCapabilities("progress");
      const defaultLeaf = getElementCapabilities("some-made-up-unregistered-tag");
      // Every flag matches an ordinary unlisted leaf tag's own defaults exactly.
      expect(progress).toEqual({ ...defaultLeaf, canContainChildren: false });
    });

    it("Progress gets NO supportsIntrinsicAspectRatio/supportsMediaFit — not a fittable replaced element the way img/video are", () => {
      const progress = getElementCapabilities("progress");
      expect(progress.supportsIntrinsicAspectRatio).toBe(false);
      expect(progress.supportsMediaFit).toBe(false);
    });

    it("Progress gets NO supportsBackground — confirmed live: the native track/fill pseudo-elements fully occlude an authored background", () => {
      expect(getElementCapabilities("progress").supportsBackground).toBe(false);
    });

    it("Progress gets every ordinary box-model capability from DEFAULT_CAPABILITIES — resize/sizing/border/border-radius/box-shadow/filters/display/position, all verified live", () => {
      const progress = getElementCapabilities("progress");
      expect(progress.resizableX).toBe(true);
      expect(progress.resizableY).toBe(true);
      expect(progress.supportsAspectRatio).toBe(true);
      expect(progress.supportsPosition).toBe(true);
      expect(progress.supportsBorder).toBe(true);
      expect(progress.supportsBorderRadius).toBe(true);
      expect(progress.supportsBoxShadow).toBe(true);
      expect(progress.supportsFilters).toBe(true);
      expect(progress.supportsDisplay).toBe(true);
      expect(progress.selectable).toBe(true);
    });

    it("Progress does not expose the child-Layout section — a leaf (canContainChildren already gates it, no override needed)", () => {
      expect(getElementCapabilities("progress").canContainChildren).toBe(false);
    });
  });

  describe("SVG Foundation (Checkpoint 1.15.5)", () => {
    it("SVG is a leaf, not text-bearing, and does not opt into a child-Layout section", () => {
      const svg = getElementCapabilities("svg");
      expect(svg.canContainChildren).toBe(false);
      expect(svg.supportsTypography).toBe(false);
    });

    it("SVG gets supportsSvgSettings — no other tag does", () => {
      expect(getElementCapabilities("svg").supportsSvgSettings).toBe(true);
      for (const tag of ["div", "section", "img", "video", "iframe", "p", "button"]) {
        expect(getElementCapabilities(tag).supportsSvgSettings, tag).toBe(false);
      }
    });

    it("SVG gets an explicit supportsBackground grant (not a container, not text-bearing)", () => {
      expect(getElementCapabilities("svg").supportsBackground).toBe(true);
    });

    it("SVG does NOT get Image/Video's own media-fit override — viewBox governs internal content fit instead", () => {
      const svg = getElementCapabilities("svg");
      expect(svg.supportsMediaFit).toBe(false);
      expect(svg.supportsIntrinsicAspectRatio).toBe(false);
    });

    it("SVG is NOT shape-capable (Checkpoint 1.15.4's clip-path Shape and SVG Foundation stay independent)", () => {
      expect(getElementCapabilities("svg").supportsShape).toBe(false);
    });

    it("SVG still gets every other useful box-model capability from DEFAULT_CAPABILITIES — sizing/resize/position/border/border-radius/box-shadow/filters/display", () => {
      const svg = getElementCapabilities("svg");
      expect(svg.resizableX).toBe(true);
      expect(svg.resizableY).toBe(true);
      expect(svg.supportsAspectRatio).toBe(true);
      expect(svg.supportsPosition).toBe(true);
      expect(svg.supportsBorder).toBe(true);
      expect(svg.supportsBorderRadius).toBe(true);
      expect(svg.supportsBoxShadow).toBe(true);
      expect(svg.supportsFilters).toBe(true);
      expect(svg.supportsDisplay).toBe(true);
    });
  });

  describe("Dialog Foundation (Checkpoint 1.15.6.9)", () => {
    it("Dialog is childable (a genuine container, via CONTAINER_TAGS) and not text-bearing", () => {
      const dialog = getElementCapabilities("dialog");
      expect(dialog.canContainChildren).toBe(true);
      expect(dialog.supportsTypography).toBe(false);
    });

    it("Dialog gets an implicit supportsBackground grant, the same generic container rule every other container tag already gets — no explicit override needed", () => {
      expect(getElementCapabilities("dialog").supportsBackground).toBe(true);
    });

    it("Dialog opts OUT of the generic child-Layout section — its own box never gets Flow/Flex/Grid authority (DialogElement's own content Container owns that one level down)", () => {
      expect(getElementCapabilities("dialog").supportsChildLayout).toBe(false);
    });

    it("Dialog opts OUT of Display/Visibility — an authored display:none would fight showModal()'s own top-layer state (this checkpoint's own 'Critical Conflict' finding)", () => {
      expect(getElementCapabilities("dialog").supportsDisplay).toBe(false);
    });

    it("Dialog is NOT shape-capable and does not own Style Protection locking — a Modal composition's own root Container already owns both, the same way Dropdown's root does", () => {
      expect(getElementCapabilities("dialog").supportsShape).toBe(false);
    });

    it("Dialog still gets every other ordinary box-model capability from DEFAULT_CAPABILITIES — sizing/resize/position/border/border-radius/box-shadow/filters", () => {
      const dialog = getElementCapabilities("dialog");
      expect(dialog.resizableX).toBe(true);
      expect(dialog.resizableY).toBe(true);
      expect(dialog.selectable).toBe(true);
      expect(dialog.supportsAspectRatio).toBe(true);
      expect(dialog.supportsPosition).toBe(true);
      expect(dialog.supportsBorder).toBe(true);
      expect(dialog.supportsBorderRadius).toBe(true);
      expect(dialog.supportsBoxShadow).toBe(true);
      expect(dialog.supportsFilters).toBe(true);
    });
  });

  describe("Divider, Fieldset & Legend Foundation (Checkpoint 1.15.6.12.1)", () => {
    it("hr is neither childable nor text-bearing — a genuine leaf, zero CAPABILITY_OVERRIDES entry needed", () => {
      const hr = getElementCapabilities("hr");
      expect(hr.canContainChildren).toBe(false);
      expect(hr.supportsTypography).toBe(false);
      expect(hr.supportsBackground).toBe(false);
    });

    it("hr still gets every ordinary box-model capability from DEFAULT_CAPABILITIES — sizing/resize/position/border/border-radius/box-shadow/filters/display", () => {
      const hr = getElementCapabilities("hr");
      expect(hr.resizableX).toBe(true);
      expect(hr.resizableY).toBe(true);
      expect(hr.selectable).toBe(true);
      expect(hr.supportsAspectRatio).toBe(true);
      expect(hr.supportsPosition).toBe(true);
      expect(hr.supportsBorder).toBe(true);
      expect(hr.supportsBorderRadius).toBe(true);
      expect(hr.supportsBoxShadow).toBe(true);
      expect(hr.supportsFilters).toBe(true);
      expect(hr.supportsDisplay).toBe(true);
    });

    it("fieldset is childable (via CONTAINER_TAGS) and gets the same implicit supportsBackground/supportsChildLayout grants every other structural container gets — zero CAPABILITY_OVERRIDES entry needed", () => {
      const fieldset = getElementCapabilities("fieldset");
      expect(fieldset.canContainChildren).toBe(true);
      expect(fieldset.supportsTypography).toBe(false);
      expect(fieldset.supportsBackground).toBe(true);
      expect(fieldset.supportsChildLayout).toBe(true);
    });

    it("legend is text-bearing (via TEXT_BEARING_TAGS), gaining supportsTypography/supportsBackground purely from that membership — the same derivation th/td/li already use, zero CAPABILITY_OVERRIDES entry needed", () => {
      const legend = getElementCapabilities("legend");
      expect(legend.canContainChildren).toBe(false);
      expect(legend.supportsTypography).toBe(true);
      expect(legend.supportsBackground).toBe(true);
    });
  });

  describe("Figure, Figcaption & Table Caption Foundation (Checkpoint 1.15.6.12.2)", () => {
    it("figure is childable (via CONTAINER_TAGS) and gets the same implicit supportsBackground/supportsChildLayout grants every other structural container gets — zero CAPABILITY_OVERRIDES entry needed", () => {
      const figure = getElementCapabilities("figure");
      expect(figure.canContainChildren).toBe(true);
      expect(figure.supportsTypography).toBe(false);
      expect(figure.supportsBackground).toBe(true);
      expect(figure.supportsChildLayout).toBe(true);
    });

    it("figure was deliberately NOT added to the Shape (clip-path) allowlist — matches Fieldset's own precedent, not automatically widened", () => {
      expect(getElementCapabilities("figure").supportsShape).toBe(false);
    });

    it("figcaption is text-bearing (via TEXT_BEARING_TAGS), gaining supportsTypography/supportsBackground purely from that membership — zero CAPABILITY_OVERRIDES entry needed", () => {
      const figcaption = getElementCapabilities("figcaption");
      expect(figcaption.canContainChildren).toBe(false);
      expect(figcaption.supportsTypography).toBe(true);
      expect(figcaption.supportsBackground).toBe(true);
    });

    it("caption is text-bearing (via TEXT_BEARING_TAGS) — typography/background granted generically, same as th/td/legend", () => {
      const caption = getElementCapabilities("caption");
      expect(caption.canContainChildren).toBe(false);
      expect(caption.supportsTypography).toBe(true);
      expect(caption.supportsBackground).toBe(true);
    });

    it("caption opts OUT of Display/Position — the same 'would silently pull it out of native table layout' reason Th/Td's own overrides already document", () => {
      const caption = getElementCapabilities("caption");
      expect(caption.supportsDisplay).toBe(false);
      expect(caption.supportsPosition).toBe(false);
    });

    it("caption still gets border/border-radius/box-shadow/filters/sizing and, unlike Th/Td, remains independently resizable — it doesn't share width with a sibling column", () => {
      const caption = getElementCapabilities("caption");
      expect(caption.supportsBorder).toBe(true);
      expect(caption.supportsBorderRadius).toBe(true);
      expect(caption.supportsBoxShadow).toBe(true);
      expect(caption.supportsFilters).toBe(true);
      expect(caption.supportsAspectRatio).toBe(true);
      expect(caption.resizableX).toBe(true);
      expect(caption.resizableY).toBe(true);
    });
  });

  describe("CSS Transition Foundation (Checkpoint 1.15.6.14.1)", () => {
    it("defaults to true for an ordinary box tag", () => {
      expect(getElementCapabilities("div").supportsTransition).toBe(true);
      expect(getElementCapabilities("p").supportsTransition).toBe(true);
    });

    it("is false for page/body — structural, non-selectable, no styling at all", () => {
      expect(getElementCapabilities("page").supportsTransition).toBe(false);
      expect(getElementCapabilities("body").supportsTransition).toBe(false);
    });

    it("is false for option — no rendered box outside an open native dropdown", () => {
      expect(getElementCapabilities("option").supportsTransition).toBe(false);
    });

    it("is false for thead/tbody/tfoot/tr — native-table-computed row-group geometry, same reason as their own supportsDisplay override", () => {
      for (const tag of ["thead", "tbody", "tfoot", "tr"]) {
        expect(getElementCapabilities(tag).supportsTransition, tag).toBe(false);
      }
    });

    it("stays true for th/td/caption/table — an ordinary box concern despite their other table-layout restrictions", () => {
      for (const tag of ["th", "td", "caption", "table"]) {
        expect(getElementCapabilities(tag).supportsTransition, tag).toBe(true);
      }
    });

    it("stays true for img/video/audio/svg/dialog/progress — no narrower restriction applies to any of them", () => {
      for (const tag of ["img", "video", "audio", "svg", "dialog", "progress"]) {
        expect(getElementCapabilities(tag).supportsTransition, tag).toBe(true);
      }
    });

    it("intersects to false for a mixed selection where any tag disallows it", () => {
      expect(intersectElementCapabilities(["div", "option"]).supportsTransition).toBe(false);
    });

    it("intersects to true when every selected tag allows it", () => {
      expect(intersectElementCapabilities(["div", "p", "img"]).supportsTransition).toBe(true);
    });
  });

  describe("CSS Transform Foundation (Checkpoint 1.15.6.14.3)", () => {
    it("defaults to true for an ordinary box tag", () => {
      expect(getElementCapabilities("div").supportsTransform).toBe(true);
      expect(getElementCapabilities("p").supportsTransform).toBe(true);
    });

    it("is false for page/body — same as supportsTransition", () => {
      expect(getElementCapabilities("page").supportsTransform).toBe(false);
      expect(getElementCapabilities("body").supportsTransform).toBe(false);
    });

    it("is false for option — no rendered box outside an open native dropdown", () => {
      expect(getElementCapabilities("option").supportsTransform).toBe(false);
    });

    it("is false for thead/tbody/tfoot/tr — native-table-computed row-group geometry", () => {
      for (const tag of ["thead", "tbody", "tfoot", "tr"]) {
        expect(getElementCapabilities(tag).supportsTransform, tag).toBe(false);
      }
    });

    it("stays true for th/td/caption/table/img/video/audio/svg/dialog/progress", () => {
      for (const tag of ["th", "td", "caption", "table", "img", "video", "audio", "svg", "dialog", "progress"]) {
        expect(getElementCapabilities(tag).supportsTransform, tag).toBe(true);
      }
    });

    it("intersects to false for a mixed selection where any tag disallows it", () => {
      expect(intersectElementCapabilities(["div", "option"]).supportsTransform).toBe(false);
    });

    it("intersects to true when every selected tag allows it", () => {
      expect(intersectElementCapabilities(["div", "p", "img"]).supportsTransform).toBe(true);
    });

    it("supportsTransform and supportsTransition are independent flags (both happen to share the same current true/false set, but neither derives from the other)", () => {
      for (const tag of ["div", "page", "body", "option", "thead", "tbody", "tfoot", "tr", "th", "td", "table", "svg", "dialog"]) {
        expect(getElementCapabilities(tag).supportsTransform, tag).toBe(getElementCapabilities(tag).supportsTransition);
      }
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

describe("intersectElementCapabilities (Checkpoint 1.15.2 — multi-selection capability gating)", () => {
  it("returns the same capabilities for a single tag as getElementCapabilities itself", () => {
    expect(intersectElementCapabilities(["p"])).toEqual(getElementCapabilities("p"));
  });

  it("Paragraph + Heading: both text-bearing — Typography stays true", () => {
    expect(intersectElementCapabilities(["p", "h1"]).supportsTypography).toBe(true);
  });

  it("Paragraph + Image: Image doesn't support Typography — false for the pair", () => {
    expect(intersectElementCapabilities(["p", "img"]).supportsTypography).toBe(false);
  });

  it("Image + Video: both support Media Fit — true for the pair", () => {
    expect(intersectElementCapabilities(["img", "video"]).supportsMediaFit).toBe(true);
  });

  it("Image + Iframe: Iframe doesn't support Media Fit — false for the pair", () => {
    expect(intersectElementCapabilities(["img", "iframe"]).supportsMediaFit).toBe(false);
  });

  it("Audio + Video (Checkpoint 1.15.6.12.3): Audio never supports Media Fit, so the intersection correctly hides it even though Video alone does", () => {
    const result = intersectElementCapabilities(["audio", "video"]);
    expect(result.supportsMediaFit).toBe(false);
    expect(result.supportsIntrinsicAspectRatio).toBe(false);
  });

  it("Audio + Video: both support Background/Border/Position/Display/resize — true for the pair", () => {
    const result = intersectElementCapabilities(["audio", "video"]);
    expect(result.supportsBorder).toBe(true);
    expect(result.supportsPosition).toBe(true);
    expect(result.supportsDisplay).toBe(true);
    expect(result.resizableX).toBe(true);
    expect(result.resizableY).toBe(true);
  });

  it("Audio + Image: Image doesn't support Background the way Audio does — false for the pair", () => {
    expect(intersectElementCapabilities(["audio", "img"]).supportsBackground).toBe(false);
  });

  it("every boolean flag is a true logical AND across three or more tags", () => {
    const result = intersectElementCapabilities(["p", "h1", "img"]);
    expect(result.supportsTypography).toBe(false); // img breaks it
    expect(result.supportsBorder).toBe(true); // all three support border
  });

  it("throws for an empty tag list", () => {
    expect(() => intersectElementCapabilities([])).toThrow();
  });

  describe("Shape (Checkpoint 1.15.4, section 44)", () => {
    it("Container (div) + Section: both shape-capable — stays true", () => {
      expect(intersectElementCapabilities(["div", "section"]).supportsShape).toBe(true);
    });

    it("Container + Paragraph: Paragraph isn't shape-capable — false for the pair", () => {
      expect(intersectElementCapabilities(["div", "p"]).supportsShape).toBe(false);
    });

    it("Header + Footer: both shape-capable — stays true", () => {
      expect(intersectElementCapabilities(["header", "footer"]).supportsShape).toBe(true);
    });
  });
});
