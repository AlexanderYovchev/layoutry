import { describe, expect, it } from "vitest";
import { creationToolbarCategories } from "./creationToolbarCategories";

function allCards() {
  return creationToolbarCategories.flatMap((category) => category.sections.flatMap((section) => section.cards));
}

describe("creationToolbarCategories icon coverage (Checkpoint 1.12.1)", () => {
  it("gives every currently-enabled card a real icon", () => {
    const enabledCardsWithoutIcons = allCards().filter((card) => !card.disabled && !card.icon);
    expect(enabledCardsWithoutIcons).toEqual([]);
  });

  it("never gives a disabled (not-yet-implemented) card an icon", () => {
    const disabledCardsWithIcons = allCards().filter((card) => card.disabled && card.icon);
    expect(disabledCardsWithIcons).toEqual([]);
  });
});

describe("creationToolbarCategories — one primary home per element (Checkpoint 1.15.1)", () => {
  it("never enables the same insertable elementType from two different cards", () => {
    const enabledTypes = allCards()
      .filter((card) => !card.disabled && card.elementType)
      .map((card) => card.elementType);
    const uniqueTypes = new Set(enabledTypes);
    expect(enabledTypes).toHaveLength(uniqueTypes.size);
  });

  function findCategory(label: string) {
    const category = creationToolbarCategories.find((c) => c.label === label);
    if (!category) throw new Error(`Category "${label}" not found`);
    return category;
  }

  function enabledCardNames(categoryLabel: string) {
    return findCategory(categoryLabel)
      .sections.flatMap((section) => section.cards)
      .filter((card) => !card.disabled)
      .map((card) => card.name);
  }

  it("HTML keeps structural/general primitives, and no longer carries Forms' own control cards", () => {
    const htmlNames = enabledCardNames("HTML");
    expect(htmlNames).toEqual(
      expect.arrayContaining(["Container", "Section", "Heading", "Paragraph", "Link", "Unordered List", "Ordered List", "List Item", "Button", "Table"]),
    );
    for (const movedName of ["Form", "Label", "Text Input", "Email Input", "Password Input", "Checkbox", "Radio Button", "Textarea", "Select", "Image", "Video", "Embed"]) {
      expect(htmlNames).not.toContain(movedName);
    }
  });

  it("Forms owns every form-control primitive, with exactly one enabled card per control", () => {
    const formsNames = enabledCardNames("Forms");
    expect(formsNames).toEqual([
      "Form",
      "Label",
      "Text Input",
      "Email Input",
      "Password Input",
      "Number Input",
      "Search Input",
      "URL Input",
      "Tel Input",
      "Textarea",
      "Select",
      "Checkbox",
      "Radio Button",
      "Fieldset",
    ]);
  });

  it("Media owns Image/Video/SVG/Embed, with exactly one enabled card per primitive", () => {
    const mediaNames = enabledCardNames("Media");
    expect(mediaNames).toEqual(["Image", "Video", "SVG", "Embed"]);
  });
});
