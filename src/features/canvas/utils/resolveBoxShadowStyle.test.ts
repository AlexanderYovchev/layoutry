import { describe, expect, it } from "vitest";
import { resolveBoxShadowStyle } from "./resolveBoxShadowStyle";
import type { EditorElementNode } from "@/features/editor/types/document";

describe("resolveBoxShadowStyle", () => {
  it("returns an empty style object for a node with no shadow set", () => {
    const node: EditorElementNode = { id: "n1", tag: "div" };
    expect(resolveBoxShadowStyle(node)).toEqual({});
  });

  it("returns an empty style object for an explicitly empty layer list", () => {
    const node: EditorElementNode = { id: "n1", tag: "div", boxShadow: [] };
    expect(resolveBoxShadowStyle(node)).toEqual({});
  });

  it("resolves a single enabled layer", () => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "div",
      boxShadow: [
        {
          id: "shadow-1",
          enabled: true,
          inset: false,
          offsetX: { value: 0, unit: "px" },
          offsetY: { value: 4, unit: "px" },
          blur: { value: 8, unit: "px" },
          spread: { value: 0, unit: "px" },
          color: "#3366ff",
        },
      ],
    };
    expect(resolveBoxShadowStyle(node)).toEqual({ boxShadow: "0px 4px 8px 0px #3366ff" });
  });

  it("joins multiple enabled layers with a comma, preserving stored order", () => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "div",
      boxShadow: [
        { id: "shadow-1", enabled: true, inset: false, color: "#ff0000" },
        { id: "shadow-2", enabled: true, inset: false, color: "#00ff00" },
      ],
    };
    expect(resolveBoxShadowStyle(node).boxShadow).toBe("0px 0px 0px 0px #ff0000, 0px 0px 0px 0px #00ff00");
  });

  it("filters out disabled layers entirely", () => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "div",
      boxShadow: [
        { id: "shadow-1", enabled: false, inset: false, color: "#ff0000" },
        { id: "shadow-2", enabled: true, inset: false, color: "#00ff00" },
      ],
    };
    expect(resolveBoxShadowStyle(node).boxShadow).toBe("0px 0px 0px 0px #00ff00");
  });

  it("returns an empty style object when every layer is disabled", () => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "div",
      boxShadow: [{ id: "shadow-1", enabled: false, inset: false, color: "#ff0000" }],
    };
    expect(resolveBoxShadowStyle(node)).toEqual({});
  });

  it("prefixes 'inset' for an inset layer", () => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "div",
      boxShadow: [{ id: "shadow-1", enabled: true, inset: true, color: "#000000" }],
    };
    expect(resolveBoxShadowStyle(node).boxShadow).toBe("inset 0px 0px 0px 0px #000000");
  });

  it("never throws on a malformed layer, and omits it while still rendering the other valid layers", () => {
    const node = {
      id: "n1",
      tag: "div",
      boxShadow: [
        { id: "shadow-1", enabled: true, inset: false, blur: { value: -1, unit: "px" } },
        { id: "shadow-2", enabled: true, inset: false, color: "#00ff00" },
      ],
    } as unknown as EditorElementNode;
    expect(() => resolveBoxShadowStyle(node)).not.toThrow();
    expect(resolveBoxShadowStyle(node).boxShadow).toBe("0px 0px 0px 0px #00ff00");
  });
});
