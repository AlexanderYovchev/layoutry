import { describe, expect, it } from "vitest";
import { resolveBorderRadiusStyle } from "./resolveBorderRadiusStyle";
import type { EditorElementNode } from "@/features/editor/types/document";

describe("resolveBorderRadiusStyle", () => {
  it("returns an empty style object for a node with no radius set", () => {
    const node: EditorElementNode = { id: "n1", tag: "div" };
    expect(resolveBorderRadiusStyle(node)).toEqual({});
  });

  it("resolves one corner as a longhand property", () => {
    const node: EditorElementNode = { id: "n1", tag: "div", borderRadius: { topLeft: { value: 8, unit: "px" } } };
    expect(resolveBorderRadiusStyle(node)).toEqual({ borderTopLeftRadius: "8px" });
  });

  it("leaves unset corners genuinely absent", () => {
    const node: EditorElementNode = { id: "n1", tag: "div", borderRadius: { bottomRight: { value: 4, unit: "px" } } };
    const style = resolveBorderRadiusStyle(node);
    expect(style).toEqual({ borderBottomRightRadius: "4px" });
    expect(style.borderTopLeftRadius).toBeUndefined();
  });

  it("resolves all four corners independently with different values", () => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "div",
      borderRadius: {
        topLeft: { value: 1, unit: "px" },
        topRight: { value: 2, unit: "px" },
        bottomRight: { value: 3, unit: "px" },
        bottomLeft: { value: 4, unit: "px" },
      },
    };
    expect(resolveBorderRadiusStyle(node)).toEqual({
      borderTopLeftRadius: "1px",
      borderTopRightRadius: "2px",
      borderBottomRightRadius: "3px",
      borderBottomLeftRadius: "4px",
    });
  });

  it("resolves a zero radius verbatim — a valid, explicit square-corner choice", () => {
    const node: EditorElementNode = { id: "n1", tag: "div", borderRadius: { topLeft: { value: 0, unit: "px" } } };
    expect(resolveBorderRadiusStyle(node).borderTopLeftRadius).toBe("0px");
  });

  it("resolves a percentage radius verbatim", () => {
    const node: EditorElementNode = { id: "n1", tag: "div", borderRadius: { topLeft: { value: 50, unit: "%" } } };
    expect(resolveBorderRadiusStyle(node).borderTopLeftRadius).toBe("50%");
  });

  it("resolves rem/em units via formatCssLength", () => {
    const node: EditorElementNode = { id: "n1", tag: "div", borderRadius: { topLeft: { value: 0.5, unit: "rem" } } };
    expect(resolveBorderRadiusStyle(node).borderTopLeftRadius).toBe("0.5rem");
  });

  it("never throws on malformed radius data, and omits the malformed corner entirely", () => {
    const node = {
      id: "n1",
      tag: "div",
      borderRadius: { topLeft: { value: -5, unit: "px" }, topRight: "8px" },
    } as unknown as EditorElementNode;
    expect(() => resolveBorderRadiusStyle(node)).not.toThrow();
    expect(resolveBorderRadiusStyle(node)).toEqual({});
  });
});
