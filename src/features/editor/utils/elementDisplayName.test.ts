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
    expect(getElementDisplayName({ id: "16", tag: "form" })).toBe("Form");
    expect(getElementDisplayName({ id: "17", tag: "label" })).toBe("Label");
    expect(getElementDisplayName({ id: "18", tag: "textarea" })).toBe("Textarea");
    expect(getElementDisplayName({ id: "19", tag: "select" })).toBe("Select");
  });

  it("appends an Option's own text (Checkpoint 1.13) — e.g. 'Option — Bulgaria'", () => {
    expect(getElementDisplayName({ id: "1", tag: "option", text: "Bulgaria" })).toBe("Option — Bulgaria");
    expect(getElementDisplayName({ id: "2", tag: "option", text: "Option 1" })).toBe("Option — Option 1");
  });

  it("shows bare 'Option' for an Option with no text, or text exactly equal to the bare tag name (never the redundant 'Option — Option')", () => {
    expect(getElementDisplayName({ id: "1", tag: "option" })).toBe("Option");
    expect(getElementDisplayName({ id: "2", tag: "option", text: "" })).toBe("Option");
    expect(getElementDisplayName({ id: "3", tag: "option", text: "Option" })).toBe("Option");
  });

  it("resolves Checkbox/Radio to their own short names, not \"Checkbox Input\"/\"Radio Input\" (Checkpoint 1.12)", () => {
    expect(getElementDisplayName({ id: "1", tag: "input", inputType: "checkbox" })).toBe("Checkbox");
    expect(getElementDisplayName({ id: "2", tag: "input", inputType: "radio" })).toBe("Radio");
  });

  it("resolves Input's display name from its inputType, not a single generic name (Checkpoint 1.11)", () => {
    expect(getElementDisplayName({ id: "1", tag: "input", inputType: "text" })).toBe("Text Input");
    expect(getElementDisplayName({ id: "2", tag: "input", inputType: "email" })).toBe("Email Input");
    expect(getElementDisplayName({ id: "3", tag: "input", inputType: "password" })).toBe("Password Input");
    expect(getElementDisplayName({ id: "4", tag: "input", inputType: "number" })).toBe("Number Input");
    expect(getElementDisplayName({ id: "5", tag: "input", inputType: "search" })).toBe("Search Input");
    expect(getElementDisplayName({ id: "6", tag: "input", inputType: "url" })).toBe("URL Input");
    expect(getElementDisplayName({ id: "7", tag: "input", inputType: "tel" })).toBe("Tel Input");
  });

  it("defaults an Input with no explicit inputType to Text Input, matching getInputType's own default", () => {
    expect(getElementDisplayName({ id: "1", tag: "input" })).toBe("Text Input");
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
