import { describe, expect, it } from "vitest";
import { resolveDisplayStyle } from "./resolveDisplayStyle";
import type { EditorElementNode } from "@/features/editor/types/document";

describe("resolveDisplayStyle", () => {
  it("returns an empty style object for a node with no display settings", () => {
    const node: EditorElementNode = { id: "n1", tag: "div" };
    expect(resolveDisplayStyle(node)).toEqual({});
  });

  it("resolves display", () => {
    const node: EditorElementNode = { id: "n1", tag: "div", display: { display: "none" } };
    expect(resolveDisplayStyle(node)).toEqual({ display: "none" });
  });

  it("resolves visibility independently of display", () => {
    const node: EditorElementNode = { id: "n1", tag: "div", display: { visibility: "hidden" } };
    expect(resolveDisplayStyle(node)).toEqual({ visibility: "hidden" });
  });

  it("resolves overflowX and overflowY independently", () => {
    const node: EditorElementNode = { id: "n1", tag: "div", display: { overflowX: "hidden", overflowY: "scroll" } };
    expect(resolveDisplayStyle(node)).toEqual({ overflowX: "hidden", overflowY: "scroll" });
  });

  it("resolves pointerEvents, cursor, and userSelect", () => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "div",
      display: { pointerEvents: "none", cursor: "grab", userSelect: "none" },
    };
    expect(resolveDisplayStyle(node)).toEqual({ pointerEvents: "none", cursor: "grab", userSelect: "none" });
  });

  it("resolves every field at once", () => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "div",
      display: {
        display: "inline-block",
        visibility: "visible",
        overflowX: "auto",
        overflowY: "visible",
        pointerEvents: "auto",
        cursor: "not-allowed",
        userSelect: "all",
      },
    };
    expect(resolveDisplayStyle(node)).toEqual({
      display: "inline-block",
      visibility: "visible",
      overflowX: "auto",
      overflowY: "visible",
      pointerEvents: "auto",
      cursor: "not-allowed",
      userSelect: "all",
    });
  });

  it("returns {} when every field is absent", () => {
    const node: EditorElementNode = { id: "n1", tag: "div", display: {} };
    expect(resolveDisplayStyle(node)).toEqual({});
  });

  it("never throws on malformed display data, and omits only the malformed field", () => {
    const node = {
      id: "n1",
      tag: "div",
      display: { display: "flex", visibility: "hidden", cursor: 42 },
    } as unknown as EditorElementNode;
    expect(() => resolveDisplayStyle(node)).not.toThrow();
    expect(resolveDisplayStyle(node)).toEqual({ visibility: "hidden" });
  });
});
