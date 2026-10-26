import { describe, expect, it } from "vitest";
import { fixtureDocument } from "@/features/editor/fixtureDocument";
import {
  createElementNode,
  INSERTABLE_ELEMENT_TYPES,
} from "@/features/editor/factories/elementFactories";
import { canContainChildren } from "@/features/editor/rules/insertionRules";
import {
  isKnownElementTag,
  KNOWN_ELEMENT_TAGS,
} from "@/features/editor/rules/knownElementTags";
import { HEADING_TAGS } from "@/features/editor/types/heading";
import type { EditorElementNode } from "@/features/editor/types/document";

function collectNodes(root: EditorElementNode): EditorElementNode[] {
  const nodes: EditorElementNode[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    nodes.push(node);
    stack.push(...(node.children ?? []));
  }
  return nodes;
}

describe("KNOWN_ELEMENT_TAGS", () => {
  it("covers the registry: there is more than one insertable type to check", () => {
    expect(INSERTABLE_ELEMENT_TYPES.length).toBeGreaterThan(50);
  });

  it.each(INSERTABLE_ELEMENT_TYPES)(
    "knows every tag the %s factory creates",
    (type) => {
      const unknown = collectNodes(createElementNode(type))
        .map((node) => node.tag)
        .filter((tag) => !isKnownElementTag(tag));
      expect(unknown).toEqual([]);
    },
  );

  it("knows every tag in the starter document and every heading level", () => {
    for (const node of collectNodes(fixtureDocument))
      expect(isKnownElementTag(node.tag), node.tag).toBe(true);
    for (const tag of HEADING_TAGS)
      expect(isKnownElementTag(tag), tag).toBe(true);
  });

  it("knows every table section tag the table commands create", () => {
    for (const tag of [
      "table",
      "caption",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "th",
      "td",
    ]) {
      expect(KNOWN_ELEMENT_TAGS.has(tag), tag).toBe(true);
    }
  });

  it("only factories' container tags ever receive children", () => {
    for (const type of INSERTABLE_ELEMENT_TYPES) {
      for (const node of collectNodes(createElementNode(type))) {
        if (node.children && node.children.length > 0) {
          expect(canContainChildren(node.tag), `${type}: ${node.tag}`).toBe(
            true,
          );
        }
      }
    }
  });

  it("rejects tags the editor never produces", () => {
    for (const tag of [
      "script",
      "style",
      "object",
      "embed",
      "PAGE",
      "",
      "custom-element",
    ]) {
      expect(isKnownElementTag(tag), tag).toBe(false);
    }
  });
});
