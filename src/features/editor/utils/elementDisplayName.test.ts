import { describe, expect, it } from "vitest";
import {
  getElementDisplayName,
  shouldShowTagBadge,
} from "./elementDisplayName";

describe("getElementDisplayName", () => {
  it("maps known tags to friendly names", () => {
    expect(getElementDisplayName({ id: "1", tag: "div" })).toBe("Container");
    expect(getElementDisplayName({ id: "2", tag: "h1" })).toBe("Heading");
    expect(getElementDisplayName({ id: "3", tag: "p" })).toBe("Paragraph");
    expect(getElementDisplayName({ id: "4", tag: "img" })).toBe("Image");
    expect(getElementDisplayName({ id: "5", tag: "section" })).toBe("Section");
    expect(getElementDisplayName({ id: "6", tag: "a" })).toBe("Link");
    expect(getElementDisplayName({ id: "7", tag: "ul" })).toBe("Unordered List");
    expect(getElementDisplayName({ id: "8", tag: "ol" })).toBe("Ordered List");
    expect(getElementDisplayName({ id: "9", tag: "li" })).toBe("List Item");
    expect(getElementDisplayName({ id: "10", tag: "header" })).toBe("Header");
    expect(getElementDisplayName({ id: "11", tag: "nav" })).toBe("Navigation");
    expect(getElementDisplayName({ id: "12", tag: "main" })).toBe("Main");
    expect(getElementDisplayName({ id: "13", tag: "article" })).toBe("Article");
    expect(getElementDisplayName({ id: "14", tag: "aside" })).toBe("Aside");
    expect(getElementDisplayName({ id: "15", tag: "footer" })).toBe("Footer");
  });

  it("prefers an explicit displayName over the tag mapping", () => {
    expect(
      getElementDisplayName({
        id: "5",
        tag: "button",
        displayName: "Primary Button",
      }),
    ).toBe("Primary Button");
  });

  it("falls back to the raw tag for unrecognized elements", () => {
    expect(getElementDisplayName({ id: "6", tag: "custom-widget" })).toBe(
      "custom-widget",
    );
  });
});

describe("shouldShowTagBadge", () => {
  it("hides the tag badge when the display name is just the tag itself", () => {
    expect(shouldShowTagBadge({ id: "1", tag: "section" })).toBe(false);
    expect(shouldShowTagBadge({ id: "2", tag: "page" })).toBe(false);
  });

  it("shows the tag badge when the display name adds real information", () => {
    expect(shouldShowTagBadge({ id: "3", tag: "h1" })).toBe(true);
    expect(shouldShowTagBadge({ id: "4", tag: "p" })).toBe(true);
    expect(
      shouldShowTagBadge({
        id: "5",
        tag: "button",
        displayName: "Primary Button",
      }),
    ).toBe(true);
  });
});
