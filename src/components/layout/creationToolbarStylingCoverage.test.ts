import { describe, expect, it } from "vitest";
import { creationToolbarCategories } from "@/components/layout/creationToolbarCategories";
import {
  createElementNode,
  isInsertableElementType,
} from "@/features/editor/factories/elementFactories";
import { getStylingCapabilities } from "@/features/editor/rules/stylingRegistry";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * BC-17.2: the styling registry must cover every element type the
 * Resource Panel can insert. The count is read from the source, not
 * hard-coded from the architecture reports (they state 82).
 */
const cards = creationToolbarCategories.flatMap((category) =>
  category.sections.flatMap((section) => section.cards),
);
const enabledTypes = [
  ...new Set(
    cards.flatMap((card) => (card.elementType ? [card.elementType] : [])),
  ),
];

function subtree(root: EditorElementNode): EditorElementNode[] {
  return [root, ...(root.children ?? []).flatMap(subtree)];
}

describe("Resource Panel element types and the styling registry", () => {
  it("has the inventory the architecture states: 111 cards, 82 enabled element types, 29 placeholders", () => {
    expect(cards.length).toBe(111);
    expect(enabledTypes.length).toBe(82);
    expect(cards.filter((card) => card.disabled).length).toBe(29);
  });

  it.each(enabledTypes)(
    "resolves a styling profile for every node %s inserts",
    (type) => {
      if (!isInsertableElementType(type))
        throw new Error(`${type} has no factory`);
      for (const node of subtree(createElementNode(type)))
        expect(
          getStylingCapabilities(node),
          `${type}: ${node.tag}`,
        ).toBeDefined();
    },
  );
});
