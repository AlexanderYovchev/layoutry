import { describe, expect, it } from "vitest";
import { resolvePositionStyle } from "./resolvePositionStyle";
import type { EditorElementNode } from "@/features/editor/types/document";

describe("resolvePositionStyle", () => {
  it("returns an empty style object for a node with no position settings", () => {
    const node: EditorElementNode = { id: "n1", tag: "div" };
    expect(resolvePositionStyle(node)).toEqual({});
  });

  it.each(["static", "relative", "absolute", "fixed", "sticky"] as const)("resolves position: %s", (value) => {
    const node: EditorElementNode = { id: "n1", tag: "div", position: { position: value } };
    expect(resolvePositionStyle(node)).toEqual({ position: value });
  });

  it("returns {} when the settings object is present but empty", () => {
    const node: EditorElementNode = { id: "n1", tag: "div", position: {} };
    expect(resolvePositionStyle(node)).toEqual({});
  });

  it("never throws on malformed position data, and omits the malformed field", () => {
    const node = { id: "n1", tag: "div", position: { position: "fixed-ish" } } as unknown as EditorElementNode;
    expect(() => resolvePositionStyle(node)).not.toThrow();
    expect(resolvePositionStyle(node)).toEqual({});
  });
});
