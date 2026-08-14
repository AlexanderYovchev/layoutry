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

  it("resolves overflowX/overflowY independently when only one axis is set", () => {
    expect(resolveDisplayStyle({ id: "n1", tag: "div", display: { overflowX: "clip" } })).toEqual({ overflowX: "clip" });
    expect(resolveDisplayStyle({ id: "n1", tag: "div", display: { overflowY: "auto" } })).toEqual({ overflowY: "auto" });
  });

  describe("Overflow shorthand/longhand precedence (Checkpoint 5.4)", () => {
    it("resolves the unified overflow shorthand when present", () => {
      const node: EditorElementNode = { id: "n1", tag: "div", display: { overflow: "hidden" } };
      expect(resolveDisplayStyle(node)).toEqual({ overflow: "hidden" });
    });

    it("supports the new clip value on the shorthand and both axes", () => {
      expect(resolveDisplayStyle({ id: "n1", tag: "div", display: { overflow: "clip" } })).toEqual({ overflow: "clip" });
      expect(resolveDisplayStyle({ id: "n1", tag: "div", display: { overflowX: "clip" } })).toEqual({ overflowX: "clip" });
    });

    it("a valid unified overflow always wins over overflowX/overflowY, which are omitted entirely", () => {
      const node = {
        id: "n1",
        tag: "div",
        display: { overflow: "scroll", overflowX: "hidden", overflowY: "auto" },
      } as unknown as EditorElementNode;
      expect(resolveDisplayStyle(node)).toEqual({ overflow: "scroll" });
    });

    it("falls back to overflowX/overflowY when the unified overflow value is malformed", () => {
      const node = {
        id: "n1",
        tag: "div",
        display: { overflow: "not-a-value", overflowX: "hidden", overflowY: "auto" },
      } as unknown as EditorElementNode;
      expect(resolveDisplayStyle(node)).toEqual({ overflowX: "hidden", overflowY: "auto" });
    });

    it("malformed overflowX does not suppress a valid overflowY, or vice versa", () => {
      const malformedX = {
        id: "n1",
        tag: "div",
        display: { overflowX: 42, overflowY: "auto" },
      } as unknown as EditorElementNode;
      expect(resolveDisplayStyle(malformedX)).toEqual({ overflowY: "auto" });

      const malformedY = {
        id: "n1",
        tag: "div",
        display: { overflowX: "hidden", overflowY: null },
      } as unknown as EditorElementNode;
      expect(resolveDisplayStyle(malformedY)).toEqual({ overflowX: "hidden" });
    });

    it("a malformed overflow (all three variants) never suppresses unrelated Display fields", () => {
      const node = {
        id: "n1",
        tag: "div",
        display: { overflow: 42, overflowX: {}, overflowY: [], cursor: "pointer", visibility: "hidden" },
      } as unknown as EditorElementNode;
      expect(resolveDisplayStyle(node)).toEqual({ cursor: "pointer", visibility: "hidden" });
    });
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
