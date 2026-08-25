import { describe, expect, it } from "vitest";
import { canContainChildren, canParentAcceptChild } from "./insertionRules";

describe("canContainChildren", () => {
  it("accepts the document root and structural container tags", () => {
    expect(canContainChildren("page")).toBe(true);
    expect(canContainChildren("body")).toBe(true);
    expect(canContainChildren("div")).toBe(true);
    expect(canContainChildren("section")).toBe(true);
  });

  it("accepts ul/ol (Checkpoint 1.6)", () => {
    expect(canContainChildren("ul")).toBe(true);
    expect(canContainChildren("ol")).toBe(true);
  });

  it("rejects leaf/text-bearing tags", () => {
    expect(canContainChildren("button")).toBe(false);
    expect(canContainChildren("h1")).toBe(false);
    expect(canContainChildren("p")).toBe(false);
    expect(canContainChildren("img")).toBe(false);
  });

  it("rejects li — a text-bearing leaf, not a container (Checkpoint 1.6)", () => {
    expect(canContainChildren("li")).toBe(false);
  });
});

describe("canParentAcceptChild (Checkpoint 1.6)", () => {
  it("lets ul/ol accept li", () => {
    expect(canParentAcceptChild("ul", "li")).toBe(true);
    expect(canParentAcceptChild("ol", "li")).toBe(true);
  });

  it("rejects any non-li child inside ul/ol", () => {
    expect(canParentAcceptChild("ul", "h1")).toBe(false);
    expect(canParentAcceptChild("ul", "img")).toBe(false);
    expect(canParentAcceptChild("ol", "div")).toBe(false);
    expect(canParentAcceptChild("ol", "button")).toBe(false);
  });

  it("rejects li everywhere except ul/ol", () => {
    expect(canParentAcceptChild("div", "li")).toBe(false);
    expect(canParentAcceptChild("section", "li")).toBe(false);
    expect(canParentAcceptChild("page", "li")).toBe(false);
    expect(canParentAcceptChild("body", "li")).toBe(false);
    expect(canParentAcceptChild("form", "li")).toBe(false);
  });

  it("preserves every existing unrestricted Container/Section relationship", () => {
    expect(canParentAcceptChild("div", "h1")).toBe(true);
    expect(canParentAcceptChild("div", "p")).toBe(true);
    expect(canParentAcceptChild("div", "img")).toBe(true);
    expect(canParentAcceptChild("div", "a")).toBe(true);
    expect(canParentAcceptChild("div", "button")).toBe(true);
    expect(canParentAcceptChild("div", "div")).toBe(true);
    expect(canParentAcceptChild("section", "div")).toBe(true);
    expect(canParentAcceptChild("page", "section")).toBe(true);
  });

  it("still rejects a non-container parent regardless of child tag", () => {
    expect(canParentAcceptChild("h1", "p")).toBe(false);
    expect(canParentAcceptChild("button", "div")).toBe(false);
  });

  it("lets a whole ul/ol be nested into an ordinary container", () => {
    expect(canParentAcceptChild("div", "ul")).toBe(true);
    expect(canParentAcceptChild("section", "ol")).toBe(true);
  });
});
