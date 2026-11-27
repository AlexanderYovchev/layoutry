// @vitest-environment node
import { describe, expect, it } from "vitest";
import { hyphenateStyleName, serializeStyleObject } from "@/features/export/utils/serializeStyleObject";

describe("serializeStyleObject", () => {
  it("applies React's px rule: non-zero numbers get px, zero and unitless properties do not", () => {
    expect(serializeStyleObject({ width: 120.5, marginTop: 0, opacity: 0.4, zIndex: 3, flexGrow: 1, lineHeight: 1.5, fontWeight: 600 })).toEqual([
      ["width", "120.5px"],
      ["margin-top", "0"],
      ["opacity", "0.4"],
      ["z-index", "3"],
      ["flex-grow", "1"],
      ["line-height", "1.5"],
      ["font-weight", "600"],
    ]);
  });

  it("never rounds authored numbers", () => {
    expect(serializeStyleObject({ left: 13.333333, top: -0.1 })).toEqual([
      ["left", "13.333333px"],
      ["top", "-0.1px"],
    ]);
  });

  it("skips empty, null, undefined and boolean values, and trims strings", () => {
    expect(serializeStyleObject({ color: "", width: undefined, display: "  flex " })).toEqual([["display", "flex"]]);
  });

  it("preserves key order, so a later shorthand still overrides an earlier longhand", () => {
    expect(serializeStyleObject({ marginLeft: 10, margin: "auto" }).map(([property]) => property)).toEqual(["margin-left", "margin"]);
  });

  it("hyphenates like React, including the ms- vendor prefix", () => {
    expect(hyphenateStyleName("borderTopLeftRadius")).toBe("border-top-left-radius");
    expect(hyphenateStyleName("msTransform")).toBe("-ms-transform");
    expect(hyphenateStyleName("--custom")).toBe("--custom");
  });
});
