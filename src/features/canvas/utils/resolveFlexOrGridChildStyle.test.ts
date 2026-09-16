import { describe, expect, it } from "vitest";
import { resolveFlexOrGridChildStyle } from "./resolveFlexOrGridChildStyle";
import type { EditorElementNode } from "@/features/editor/types/document";

describe("resolveFlexOrGridChildStyle", () => {
  it("returns undefined when the parent is Block", () => {
    const node: EditorElementNode = { id: "n1", tag: "p" };
    expect(resolveFlexOrGridChildStyle(node, "block")).toBeUndefined();
  });

  it("returns undefined when the parent is Grid but this is checked against Flex-only settings (no confusion between the two)", () => {
    const node: EditorElementNode = { id: "n1", tag: "p", flexChild: { grow: 1, shrink: 1, basis: "auto", alignSelf: "auto" } };
    expect(resolveFlexOrGridChildStyle(node, "block")).toBeUndefined();
  });

  it("resolves flex-item CSS from flexChild settings when the parent is Flex", () => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "p",
      flexChild: { grow: 1, shrink: 0, basis: 200, alignSelf: "center" },
    };
    expect(resolveFlexOrGridChildStyle(node, "flex")).toEqual({
      flexGrow: 1,
      flexShrink: 0,
      flexBasis: 200,
      alignSelf: "center",
      minWidth: 0,
      minHeight: 0,
    });
  });

  it("uses Flex-child defaults (grow:0, shrink:1, basis:auto, alignSelf:auto) when unset", () => {
    const node: EditorElementNode = { id: "n1", tag: "p" };
    expect(resolveFlexOrGridChildStyle(node, "flex")).toEqual({
      flexGrow: 0,
      flexShrink: 1,
      flexBasis: "auto",
      alignSelf: "auto",
      minWidth: 0,
      minHeight: 0,
    });
  });

  it("always zeroes min-width/min-height for a Flex child — the default min-width:auto is what lets flex items ignore flexShrink and overflow a narrowed container", () => {
    const node: EditorElementNode = { id: "n1", tag: "button" };
    const style = resolveFlexOrGridChildStyle(node, "flex");
    expect(style?.minWidth).toBe(0);
    expect(style?.minHeight).toBe(0);
  });

  it("resolves grid-item placement from gridChild settings when the parent is Grid", () => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "p",
      gridChild: { columnStart: 2, columnSpan: 2, rowStart: 1, rowSpan: 1 },
    };
    expect(resolveFlexOrGridChildStyle(node, "grid")).toEqual({
      gridColumn: "2 / span 2",
      gridRow: "1 / span 1",
      minWidth: 0,
      minHeight: 0,
      width: "100%",
      height: "100%",
    });
  });

  it("uses 'span N' (no explicit start) when columnStart/rowStart are auto", () => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "p",
      gridChild: { columnStart: "auto", columnSpan: 2, rowStart: "auto", rowSpan: 1 },
    };
    expect(resolveFlexOrGridChildStyle(node, "grid")).toEqual({
      gridColumn: "span 2",
      gridRow: "span 1",
      minWidth: 0,
      minHeight: 0,
      width: "100%",
      height: "100%",
    });
  });

  it("uses Grid-child defaults (auto start, span 1) when unset", () => {
    const node: EditorElementNode = { id: "n1", tag: "p" };
    expect(resolveFlexOrGridChildStyle(node, "grid")).toEqual({
      gridColumn: "span 1",
      gridRow: "span 1",
      minWidth: 0,
      minHeight: 0,
      width: "100%",
      height: "100%",
    });
  });

  it("always fills its grid track (width/height: 100%) — verified live that a <button> otherwise keeps shrink-to-fit sizing and overflows a track smaller than its own content, even with min-width/min-height:0", () => {
    const node: EditorElementNode = { id: "n1", tag: "button" };
    const style = resolveFlexOrGridChildStyle(node, "grid");
    expect(style?.width).toBe("100%");
    expect(style?.height).toBe("100%");
  });

  describe("Resize Semantics (Checkpoint 1.15.6.1) — a manual resize is authored intent, not silently reverted", () => {
    it("keeps flexShrink:0 for a resized Flex child instead of reasserting the container's default shrink:1 — this was the actual root cause of the reported Nav > Button resize bug once Nav uses Flex", () => {
      const node: EditorElementNode = { id: "n1", tag: "button", dimensions: { preferredWidth: 120, preferredHeight: 40, offsetX: 0, offsetY: 0 } };
      const style = resolveFlexOrGridChildStyle(node, "flex");
      expect(style?.flexShrink).toBe(0);
    });

    it("lets an explicit flexChild.shrink authored via the Inspector win over the resize-implied 0", () => {
      const node: EditorElementNode = {
        id: "n1",
        tag: "button",
        dimensions: { preferredWidth: 120, preferredHeight: 40, offsetX: 0, offsetY: 0 },
        flexChild: { grow: 0, shrink: 1, basis: "auto", alignSelf: "auto" },
      };
      const style = resolveFlexOrGridChildStyle(node, "flex");
      expect(style?.flexShrink).toBe(1);
    });

    it("still uses the container's default shrink:1 for a never-resized Flex child (unchanged prior behavior)", () => {
      const node: EditorElementNode = { id: "n1", tag: "button" };
      const style = resolveFlexOrGridChildStyle(node, "flex");
      expect(style?.flexShrink).toBe(1);
    });

    it("does not force width/height: 100% for a resized Grid child — an explicit resize wins over the default track-fill", () => {
      const node: EditorElementNode = { id: "n1", tag: "button", dimensions: { preferredWidth: 80, preferredHeight: 30, offsetX: 0, offsetY: 0 } };
      const style = resolveFlexOrGridChildStyle(node, "grid");
      expect(style?.width).toBeUndefined();
      expect(style?.height).toBeUndefined();
      expect(style?.minWidth).toBe(0);
      expect(style?.minHeight).toBe(0);
    });

    it("still fills the track by default for a never-resized Grid child (unchanged prior behavior)", () => {
      const node: EditorElementNode = { id: "n1", tag: "button" };
      const style = resolveFlexOrGridChildStyle(node, "grid");
      expect(style?.width).toBe("100%");
      expect(style?.height).toBe("100%");
    });
  });
});
