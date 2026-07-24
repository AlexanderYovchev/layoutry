import { describe, expect, it } from "vitest";
import { canContainChildren } from "./insertionRules";

describe("canContainChildren", () => {
  it("accepts the document root and structural container tags", () => {
    expect(canContainChildren("page")).toBe(true);
    expect(canContainChildren("body")).toBe(true);
    expect(canContainChildren("div")).toBe(true);
    expect(canContainChildren("section")).toBe(true);
  });

  it("rejects leaf/text-bearing tags", () => {
    expect(canContainChildren("button")).toBe(false);
    expect(canContainChildren("h1")).toBe(false);
    expect(canContainChildren("p")).toBe(false);
    expect(canContainChildren("img")).toBe(false);
  });
});
