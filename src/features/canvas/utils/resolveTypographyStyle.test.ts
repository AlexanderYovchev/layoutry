import { describe, expect, it } from "vitest";
import { resolveTypographyStyle } from "./resolveTypographyStyle";
import type { EditorElementNode } from "@/features/editor/types/document";

describe("resolveTypographyStyle", () => {
  it("returns an empty style object for a node with no typography set — the tag's own defaults govern", () => {
    const node: EditorElementNode = { id: "n1", tag: "h1" };
    expect(resolveTypographyStyle(node)).toEqual({});
  });

  it("resolves only the explicitly-set fields, leaving every other field genuinely absent", () => {
    const node: EditorElementNode = { id: "n1", tag: "p", typography: { fontWeight: 700 } };
    const style = resolveTypographyStyle(node);
    expect(style).toEqual({ fontWeight: 700 });
    expect(style.color).toBeUndefined();
    expect(style.fontSize).toBeUndefined();
  });

  it("formats a px font size with its unit suffix", () => {
    const node: EditorElementNode = { id: "n1", tag: "p", typography: { fontSize: { value: 24, unit: "px" } } };
    expect(resolveTypographyStyle(node).fontSize).toBe("24px");
  });

  it("formats a unitless line-height with no suffix at all", () => {
    const node: EditorElementNode = { id: "n1", tag: "p", typography: { lineHeight: { value: 1.5, unit: "unitless" } } };
    expect(resolveTypographyStyle(node).lineHeight).toBe("1.5");
  });

  it("formats a percentage line-height with a % suffix", () => {
    const node: EditorElementNode = { id: "n1", tag: "p", typography: { lineHeight: { value: 150, unit: "%" } } };
    expect(resolveTypographyStyle(node).lineHeight).toBe("150%");
  });

  it("formats a negative letter-spacing value", () => {
    const node: EditorElementNode = { id: "n1", tag: "p", typography: { letterSpacing: { value: -0.5, unit: "px" } } };
    expect(resolveTypographyStyle(node).letterSpacing).toBe("-0.5px");
  });

  it("resolves fontFamily, fontStyle, color, and textAlign verbatim", () => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "p",
      typography: { fontFamily: "Georgia, serif", fontStyle: "italic", color: "#3366ff", textAlign: "center" },
    };
    expect(resolveTypographyStyle(node)).toEqual({
      fontFamily: "Georgia, serif",
      fontStyle: "italic",
      color: "#3366ff",
      textAlign: "center",
    });
  });
});
