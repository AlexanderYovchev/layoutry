import { describe, expect, it } from "vitest";
import { resolveShapeStyle } from "./resolveShapeStyle";
import type { EditorElementNode } from "@/features/editor/types/document";

function node(overrides: Partial<EditorElementNode> = {}): EditorElementNode {
  return { id: "n1", tag: "div", ...overrides };
}

describe("resolveShapeStyle", () => {
  it("emits no clip-path at all for an unset shape (plain rectangle)", () => {
    expect(resolveShapeStyle(node())).toEqual({});
  });

  it("emits no clip-path for the explicit \"none\" preset either", () => {
    expect(resolveShapeStyle(node({ shape: "none" }))).toEqual({});
  });

  it("emits the centrally-mapped clip-path for a real preset", () => {
    expect(resolveShapeStyle(node({ shape: "hexagon" }))).toEqual({
      clipPath: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
    });
  });

  it("never throws on malformed loaded-document data, and falls back to no clip-path", () => {
    const malformed = { id: "n1", tag: "div", shape: "not-a-real-shape" } as unknown as EditorElementNode;
    expect(() => resolveShapeStyle(malformed)).not.toThrow();
    expect(resolveShapeStyle(malformed)).toEqual({});
  });
});
