import { describe, expect, it } from "vitest";
import type { EditorElementNode } from "@/features/editor/types/document";
import { resolveActiveDropIndicator } from "./resolveActiveDropIndicator";

const documentModel: EditorElementNode = {
  id: "root",
  tag: "page",
  children: [
    {
      id: "section-a",
      tag: "section",
      children: [
        { id: "heading-1", tag: "h1", text: "Title" },
        { id: "button-1", tag: "button", text: "Go" },
      ],
    },
    { id: "section-b", tag: "section", children: [] },
  ],
};

describe("resolveActiveDropIndicator", () => {
  it("returns null when nothing is being dragged", () => {
    expect(resolveActiveDropIndicator(null, null, documentModel)).toBeNull();
  });

  it("returns null when hovering nothing", () => {
    const active = {
      data: { current: { kind: "move", nodeId: "button-1" } },
      rect: { current: { translated: { top: 0, height: 20 } } },
    };
    expect(resolveActiveDropIndicator(active, null, documentModel)).toBeNull();
  });

  it("resolves a target and zone for a catalog-insert drag", () => {
    const active = {
      data: { current: { elementType: "heading" } },
      rect: { current: { translated: { top: 140, height: 20 } } }, // center 150 = inside band
    };
    const over = { id: "section-b", rect: { top: 100, height: 100 } };

    expect(resolveActiveDropIndicator(active, over, documentModel)).toEqual({
      targetId: "section-b",
      zone: "inside",
    });
  });

  it("resolves a target and zone for a move drag over a valid target", () => {
    const active = {
      data: { current: { kind: "move", nodeId: "button-1" } },
      rect: { current: { translated: { top: 100, height: 20 } } }, // center 110 = before band
    };
    const over = { id: "heading-1", rect: { top: 100, height: 100 } };

    expect(resolveActiveDropIndicator(active, over, documentModel)).toEqual({
      targetId: "heading-1",
      zone: "before",
    });
  });

  it("suppresses the indicator for an invalid move (self-descendant)", () => {
    const active = {
      data: { current: { kind: "move", nodeId: "section-a" } },
      rect: { current: { translated: { top: 140, height: 20 } } },
    };
    const over = { id: "heading-1", rect: { top: 100, height: 100 } };

    expect(resolveActiveDropIndicator(active, over, documentModel)).toBeNull();
  });

  it("suppresses the indicator when a move targets the document root", () => {
    const active = {
      data: { current: { kind: "move", nodeId: "button-1" } },
      rect: { current: { translated: { top: 100, height: 20 } } },
    };
    const over = { id: "root", rect: { top: 0, height: 500 } };

    expect(resolveActiveDropIndicator(active, over, documentModel)).toBeNull();
  });

  it("does not apply move validation to a catalog-insert drag", () => {
    // A plain insert drag has no nodeId, so it's never subject to
    // isValidMoveTarget even when hovering a target an insert could
    // otherwise reach fine (unlike a move, there's no "self" to worry about).
    const active = {
      data: { current: { elementType: "button" } },
      rect: { current: { translated: { top: 140, height: 20 } } },
    };
    const over = { id: "section-a", rect: { top: 100, height: 100 } };

    expect(resolveActiveDropIndicator(active, over, documentModel)).toEqual({
      targetId: "section-a",
      zone: "inside",
    });
  });
});
