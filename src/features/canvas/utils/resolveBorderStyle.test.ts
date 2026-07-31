import { describe, expect, it } from "vitest";
import { resolveBorderStyle } from "./resolveBorderStyle";
import type { EditorElementNode } from "@/features/editor/types/document";

describe("resolveBorderStyle", () => {
  it("returns an empty style object for a node with no border set", () => {
    const node: EditorElementNode = { id: "n1", tag: "div" };
    expect(resolveBorderStyle(node)).toEqual({});
  });

  it("resolves one side's width/style/color as longhand properties", () => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "div",
      border: { top: { width: { value: 2, unit: "px" }, style: "solid", color: "#ff0000" } },
    };
    expect(resolveBorderStyle(node)).toEqual({
      borderTopWidth: "2px",
      borderTopStyle: "solid",
      borderTopColor: "#ff0000",
    });
  });

  it("leaves unset sides and unset fields genuinely absent", () => {
    const node: EditorElementNode = { id: "n1", tag: "div", border: { left: { style: "dashed" } } };
    const style = resolveBorderStyle(node);
    expect(style).toEqual({ borderLeftStyle: "dashed" });
    expect(style.borderLeftWidth).toBeUndefined();
    expect(style.borderTopStyle).toBeUndefined();
  });

  it("resolves all four sides independently when each has different settings", () => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "div",
      border: {
        top: { width: { value: 1, unit: "px" }, style: "solid" },
        right: { width: { value: 2, unit: "px" }, style: "dashed" },
        bottom: { width: { value: 3, unit: "px" }, style: "dotted" },
        left: { width: { value: 4, unit: "px" }, style: "double" },
      },
    };
    expect(resolveBorderStyle(node)).toEqual({
      borderTopWidth: "1px",
      borderTopStyle: "solid",
      borderRightWidth: "2px",
      borderRightStyle: "dashed",
      borderBottomWidth: "3px",
      borderBottomStyle: "dotted",
      borderLeftWidth: "4px",
      borderLeftStyle: "double",
    });
  });

  it("resolves a zero width verbatim — an explicit choice, distinct from being entirely unset", () => {
    const node: EditorElementNode = { id: "n1", tag: "div", border: { top: { width: { value: 0, unit: "px" } } } };
    expect(resolveBorderStyle(node).borderTopWidth).toBe("0px");
  });

  it("resolves rem/em width units via formatCssLength", () => {
    const node: EditorElementNode = { id: "n1", tag: "div", border: { top: { width: { value: 0.5, unit: "rem" } } } };
    expect(resolveBorderStyle(node).borderTopWidth).toBe("0.5rem");
  });

  it("never throws on a malformed side, and omits it entirely", () => {
    const node = {
      id: "n1",
      tag: "div",
      border: { top: { width: { value: -5, unit: "px" } }, left: { style: "wavy" } },
    } as unknown as EditorElementNode;
    expect(() => resolveBorderStyle(node)).not.toThrow();
    expect(resolveBorderStyle(node)).toEqual({});
  });

  it("does not repair a malformed side's valid fields — omits the whole side", () => {
    const node = {
      id: "n1",
      tag: "div",
      border: { top: { width: { value: 2, unit: "px" }, color: "not-a-color" } },
    } as unknown as EditorElementNode;
    expect(resolveBorderStyle(node)).toEqual({});
  });
});
