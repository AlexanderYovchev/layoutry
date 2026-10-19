import { describe, expect, it } from "vitest";
import {
  buildResourceCatalogGroups,
  countCatalogCards,
  filterCatalogGroups,
} from "@/components/layout/resourceCatalog";
import { creationToolbarCategories } from "@/components/layout/creationToolbarCategories";

describe("buildResourceCatalogGroups", () => {
  it("builds the Elements library from the HTML, Layout, Media and Forms toolbar categories, excluding Styles", () => {
    const groups = buildResourceCatalogGroups("elements");
    expect(groups.map((group) => group.label)).toEqual([
      "HTML",
      "Layout",
      "Media",
      "Forms",
    ]);
  });

  it("builds the Components library with one group per Components section", () => {
    const components = creationToolbarCategories.find(
      (category) => category.id === "components",
    );
    const groups = buildResourceCatalogGroups("components");
    expect(groups.map((group) => group.label)).toEqual(
      components?.sections.map((section) => section.label),
    );
    expect(groups.every((group) => group.categoryId === "components")).toBe(
      true,
    );
  });

  it("reuses the toolbar's own card objects instead of copying them", () => {
    const html = creationToolbarCategories.find(
      (category) => category.id === "html",
    );
    const [htmlGroup] = buildResourceCatalogGroups("elements");
    expect(htmlGroup.sections[0].cards[0]).toBe(html?.sections[0].cards[0]);
  });
});

describe("filterCatalogGroups", () => {
  const groups = buildResourceCatalogGroups("elements");

  it("returns everything for an empty query and no group filter", () => {
    expect(
      countCatalogCards(
        filterCatalogGroups(groups, { query: "  ", groupId: null }),
      ),
    ).toBe(countCatalogCards(groups));
  });

  it("matches card names case-insensitively", () => {
    const result = filterCatalogGroups(groups, {
      query: "HEADING",
      groupId: null,
    });
    const names = result.flatMap((group) =>
      group.sections.flatMap((section) =>
        section.cards.map((card) => card.name),
      ),
    );
    expect(names).toContain("Heading");
    expect(names).not.toContain("Paragraph");
  });

  it("matches section and category metadata, and requires every term", () => {
    const byCategory = filterCatalogGroups(groups, {
      query: "media",
      groupId: null,
    });
    expect(byCategory.map((group) => group.id)).toContain("media");

    const narrowed = filterCatalogGroups(groups, {
      query: "media video",
      groupId: null,
    });
    const names = narrowed.flatMap((group) =>
      group.sections.flatMap((section) =>
        section.cards.map((card) => card.name),
      ),
    );
    expect(names.length).toBeGreaterThan(0);
    expect(countCatalogCards(narrowed)).toBeLessThan(
      countCatalogCards(byCategory),
    );
  });

  it("restricts results to the selected group", () => {
    const result = filterCatalogGroups(groups, { query: "", groupId: "forms" });
    expect(result.map((group) => group.id)).toEqual(["forms"]);
  });

  it("drops empty sections and groups when nothing matches", () => {
    expect(
      filterCatalogGroups(groups, {
        query: "zzz-no-such-entry",
        groupId: null,
      }),
    ).toEqual([]);
  });
});
