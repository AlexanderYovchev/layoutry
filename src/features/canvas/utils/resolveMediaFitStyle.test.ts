import { describe, expect, it } from "vitest";
import { resolveMediaFitStyle } from "./resolveMediaFitStyle";
import type { EditorElementNode } from "@/features/editor/types/document";

describe("resolveMediaFitStyle", () => {
  it("defaults to object-fit: contain, object-position: 50% 50%, filling its box", () => {
    const node: EditorElementNode = { id: "n1", tag: "img" };
    expect(resolveMediaFitStyle(node)).toEqual({
      width: "100%",
      height: "100%",
      maxWidth: "100%",
      maxHeight: "100%",
      objectFit: "contain",
      objectPosition: "50% 50%",
    });
  });

  it("uses the node's explicit objectFit", () => {
    const node: EditorElementNode = { id: "n1", tag: "img", mediaFit: { objectFit: "cover" } };
    expect(resolveMediaFitStyle(node).objectFit).toBe("cover");
  });

  it.each(["fill", "contain", "cover", "none", "scale-down"] as const)("supports objectFit: %s", (objectFit) => {
    const node: EditorElementNode = { id: "n1", tag: "img", mediaFit: { objectFit } };
    expect(resolveMediaFitStyle(node).objectFit).toBe(objectFit);
  });

  it.each([
    { x: 0, y: 0, expected: "0% 0%" },
    { x: 50, y: 0, expected: "50% 0%" },
    { x: 100, y: 0, expected: "100% 0%" },
    { x: 0, y: 50, expected: "0% 50%" },
    { x: 50, y: 50, expected: "50% 50%" },
    { x: 100, y: 50, expected: "100% 50%" },
    { x: 0, y: 100, expected: "0% 100%" },
    { x: 50, y: 100, expected: "50% 100%" },
    { x: 100, y: 100, expected: "100% 100%" },
  ])("renders the $x/$y preset as object-position: $expected", ({ x, y, expected }) => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "img",
      mediaFit: { objectPositionX: { value: x, unit: "%" }, objectPositionY: { value: y, unit: "%" } },
    };
    expect(resolveMediaFitStyle(node).objectPosition).toBe(expected);
  });

  it("renders a custom position", () => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "img",
      mediaFit: { objectPositionX: { value: 37, unit: "%" }, objectPositionY: { value: 68, unit: "%" } },
    };
    expect(resolveMediaFitStyle(node).objectPosition).toBe("37% 68%");
  });

  it("renders a negative and an over-100 position (CSS permits cropping/overflow on purpose)", () => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "img",
      mediaFit: { objectPositionX: { value: -20, unit: "%" }, objectPositionY: { value: 120, unit: "%" } },
    };
    expect(resolveMediaFitStyle(node).objectPosition).toBe("-20% 120%");
  });

  it("a malformed objectFit falls back to the default without suppressing a valid position", () => {
    const node = {
      id: "n1",
      tag: "img",
      mediaFit: { objectFit: "stretch", objectPositionX: { value: 10, unit: "%" }, objectPositionY: { value: 20, unit: "%" } },
    } as unknown as EditorElementNode;
    const style = resolveMediaFitStyle(node);
    expect(style.objectFit).toBe("contain");
    expect(style.objectPosition).toBe("10% 20%");
  });

  it("a malformed X falls back to the default for X only, never suppressing a valid Y", () => {
    const node = {
      id: "n1",
      tag: "img",
      mediaFit: { objectPositionX: "37%", objectPositionY: { value: 68, unit: "%" } },
    } as unknown as EditorElementNode;
    expect(resolveMediaFitStyle(node).objectPosition).toBe("50% 68%");
  });

  it("a malformed Y falls back to the default for Y only, never suppressing a valid X", () => {
    const node = {
      id: "n1",
      tag: "img",
      mediaFit: { objectPositionX: { value: 37, unit: "%" }, objectPositionY: { value: NaN, unit: "%" } },
    } as unknown as EditorElementNode;
    expect(resolveMediaFitStyle(node).objectPosition).toBe("37% 50%");
  });

  it("never throws on entirely malformed media settings", () => {
    const node = { id: "n1", tag: "img", mediaFit: "not-an-object" } as unknown as EditorElementNode;
    expect(() => resolveMediaFitStyle(node)).not.toThrow();
    expect(resolveMediaFitStyle(node)).toEqual({
      width: "100%",
      height: "100%",
      maxWidth: "100%",
      maxHeight: "100%",
      objectFit: "contain",
      objectPosition: "50% 50%",
    });
  });

  it("always fills its outer box regardless of fit settings", () => {
    const node: EditorElementNode = { id: "n1", tag: "img", mediaFit: { objectFit: "fill" } };
    const style = resolveMediaFitStyle(node);
    expect(style.width).toBe("100%");
    expect(style.height).toBe("100%");
  });
});
