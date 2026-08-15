import { describe, expect, it } from "vitest";
import { resolveAspectRatioStyle } from "./resolveAspectRatioStyle";
import type { EditorElementNode } from "@/features/editor/types/document";

describe("resolveAspectRatioStyle", () => {
  it("returns an empty style object for a node with no aspect ratio", () => {
    const node: EditorElementNode = { id: "n1", tag: "div" };
    expect(resolveAspectRatioStyle(node)).toEqual({});
  });

  it("resolves explicit auto", () => {
    const node: EditorElementNode = { id: "n1", tag: "div", aspectRatio: { mode: "auto" } };
    expect(resolveAspectRatioStyle(node)).toEqual({ aspectRatio: "auto" });
  });

  it("resolves 1:1", () => {
    const node: EditorElementNode = { id: "n1", tag: "div", aspectRatio: { mode: "ratio", width: 1, height: 1 } };
    expect(resolveAspectRatioStyle(node)).toEqual({ aspectRatio: "1 / 1" });
  });

  it("resolves 4:3", () => {
    const node: EditorElementNode = { id: "n1", tag: "div", aspectRatio: { mode: "ratio", width: 4, height: 3 } };
    expect(resolveAspectRatioStyle(node)).toEqual({ aspectRatio: "4 / 3" });
  });

  it("resolves 16:9", () => {
    const node: EditorElementNode = { id: "n1", tag: "div", aspectRatio: { mode: "ratio", width: 16, height: 9 } };
    expect(resolveAspectRatioStyle(node)).toEqual({ aspectRatio: "16 / 9" });
  });

  it("resolves 3:4", () => {
    const node: EditorElementNode = { id: "n1", tag: "div", aspectRatio: { mode: "ratio", width: 3, height: 4 } };
    expect(resolveAspectRatioStyle(node)).toEqual({ aspectRatio: "3 / 4" });
  });

  it("resolves an arbitrary custom ratio", () => {
    const node: EditorElementNode = { id: "n1", tag: "div", aspectRatio: { mode: "ratio", width: 3, height: 2 } };
    expect(resolveAspectRatioStyle(node)).toEqual({ aspectRatio: "3 / 2" });
  });

  it("resolves a decimal ratio", () => {
    const node: EditorElementNode = { id: "n1", tag: "div", aspectRatio: { mode: "ratio", width: 2.39, height: 1 } };
    expect(resolveAspectRatioStyle(node)).toEqual({ aspectRatio: "2.39 / 1" });
  });

  it("preserves the exact entered numerator/denominator rather than reducing it", () => {
    const node: EditorElementNode = { id: "n1", tag: "div", aspectRatio: { mode: "ratio", width: 1920, height: 1080 } };
    expect(resolveAspectRatioStyle(node)).toEqual({ aspectRatio: "1920 / 1080" });
  });

  it("never throws on malformed aspect ratio data, and omits it entirely", () => {
    const node = { id: "n1", tag: "div", aspectRatio: { mode: "ratio", width: 0, height: 1 } } as unknown as EditorElementNode;
    expect(() => resolveAspectRatioStyle(node)).not.toThrow();
    expect(resolveAspectRatioStyle(node)).toEqual({});
  });

  it("rejects negative, NaN, Infinity, and non-numeric malformed ratios", () => {
    const negative = { id: "n1", tag: "div", aspectRatio: { mode: "ratio", width: -1, height: 1 } } as unknown as EditorElementNode;
    const nan = { id: "n1", tag: "div", aspectRatio: { mode: "ratio", width: NaN, height: 1 } } as unknown as EditorElementNode;
    const infinite = { id: "n1", tag: "div", aspectRatio: { mode: "ratio", width: Infinity, height: 1 } } as unknown as EditorElementNode;
    const stringy = { id: "n1", tag: "div", aspectRatio: { mode: "ratio", width: "16", height: "9" } } as unknown as EditorElementNode;
    const arr = { id: "n1", tag: "div", aspectRatio: [16, 9] } as unknown as EditorElementNode;

    expect(resolveAspectRatioStyle(negative)).toEqual({});
    expect(resolveAspectRatioStyle(nan)).toEqual({});
    expect(resolveAspectRatioStyle(infinite)).toEqual({});
    expect(resolveAspectRatioStyle(stringy)).toEqual({});
    expect(resolveAspectRatioStyle(arr)).toEqual({});
  });

  it("malformed aspect ratio does not throw and other unrelated Display/Position fields (proven at the element-component level) still resolve independently, since resolveAspectRatioStyle only ever returns its own key", () => {
    const node = {
      id: "n1",
      tag: "div",
      aspectRatio: { mode: "ratio", width: 0, height: 0 },
    } as unknown as EditorElementNode;
    expect(Object.keys(resolveAspectRatioStyle(node))).toHaveLength(0);
  });
});
