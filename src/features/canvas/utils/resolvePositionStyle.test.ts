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

  describe("offsets (Checkpoint 5.2)", () => {
    it.each(["top", "right", "bottom", "left"] as const)("resolves a %s length", (side) => {
      const node: EditorElementNode = { id: "n1", tag: "div", position: { [side]: { value: 10, unit: "px" } } };
      expect(resolvePositionStyle(node)).toEqual({ [side]: "10px" });
    });

    it.each(["top", "right", "bottom", "left"] as const)("resolves a %s of 'auto'", (side) => {
      const node: EditorElementNode = { id: "n1", tag: "div", position: { [side]: "auto" } };
      expect(resolvePositionStyle(node)).toEqual({ [side]: "auto" });
    });

    it("resolves every offset alongside position in one pass", () => {
      const node: EditorElementNode = {
        id: "n1",
        tag: "div",
        position: {
          position: "absolute",
          top: { value: 10, unit: "px" },
          right: "auto",
          bottom: { value: 50, unit: "%" },
          left: { value: -4, unit: "rem" },
        },
      };
      expect(resolvePositionStyle(node)).toEqual({
        position: "absolute",
        top: "10px",
        right: "auto",
        bottom: "50%",
        left: "-4rem",
      });
    });

    it("resolves negative offsets", () => {
      const node: EditorElementNode = { id: "n1", tag: "div", position: { top: { value: -12, unit: "px" } } };
      expect(resolvePositionStyle(node)).toEqual({ top: "-12px" });
    });

    it("resolves offsets even when position is static — CSS itself ignores them there; the Inspector, not this resolver, hides the control", () => {
      const node: EditorElementNode = {
        id: "n1",
        tag: "div",
        position: { position: "static", top: { value: 10, unit: "px" } },
      };
      expect(resolvePositionStyle(node)).toEqual({ position: "static", top: "10px" });
    });

    it("never throws on malformed offset data, and omits only the malformed side", () => {
      const node = {
        id: "n1",
        tag: "div",
        position: { top: { value: "10", unit: "px" }, right: { value: 5, unit: "px" } },
      } as unknown as EditorElementNode;
      expect(() => resolvePositionStyle(node)).not.toThrow();
      expect(resolvePositionStyle(node)).toEqual({ right: "5px" });
    });
  });
});
