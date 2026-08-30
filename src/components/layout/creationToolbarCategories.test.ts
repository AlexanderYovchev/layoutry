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
