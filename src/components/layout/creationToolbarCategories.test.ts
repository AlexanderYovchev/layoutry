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

  it("Media owns Image/Video/Audio/SVG/Embed, with exactly one enabled card per primitive", () => {
    const mediaNames = enabledCardNames("Media");
    expect(mediaNames).toEqual(["Image", "Video", "Audio Player", "SVG", "Embed"]);
  });

  it("Checkpoint 1.15.6.13.1 — Components -> Data Display contains exactly 6 enabled compositions, Progress Bar now joining the existing five", () => {
    const dataDisplayNames = findCategory("Components")
      .sections.find((section) => section.label === "Data Display")!
      .cards.filter((card) => !card.disabled)
      .map((card) => card.name);
    expect(dataDisplayNames).toEqual(["Badge", "Avatar", "Avatar with Text", "Stat Card", "Metadata Row", "Progress Bar"]);
  });

  it("Checkpoint 1.15.6.13.1 — the raw Progress primitive (HTML -> Content) and the Progress Bar composition (Components -> Data Display) are two separate, non-duplicate cards", () => {
    const htmlNames = enabledCardNames("HTML");
    const dataDisplayNames = findCategory("Components")
      .sections.find((section) => section.label === "Data Display")!
      .cards.filter((card) => !card.disabled)
      .map((card) => card.name);
    expect(htmlNames).toContain("Progress");
    expect(htmlNames).not.toContain("Progress Bar");
    expect(dataDisplayNames).toContain("Progress Bar");
    expect(dataDisplayNames).not.toContain("Progress");
  });

  it("Checkpoint 1.15.6.13.1 — total enabled Components compositions is exactly 41 (the prior closure audit's manual tally of 39 undercounted Feedback & Overlays by one — it actually has 9 cards, not 8 — so the real pre-checkpoint baseline was 40; Progress Bar brings it to 41)", () => {
    const enabledComponentsCount = findCategory("Components")
      .sections.flatMap((section) => section.cards)
      .filter((card) => !card.disabled).length;
    expect(enabledComponentsCount).toBe(41);
  });
});
