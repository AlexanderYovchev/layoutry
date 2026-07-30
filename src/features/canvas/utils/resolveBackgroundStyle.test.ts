import { describe, expect, it } from "vitest";
import { resolveBackgroundStyle } from "./resolveBackgroundStyle";
import type { EditorElementNode } from "@/features/editor/types/document";

describe("resolveBackgroundStyle", () => {
  it("returns an empty style object for a node with no background set", () => {
    const node: EditorElementNode = { id: "n1", tag: "div" };
    expect(resolveBackgroundStyle(node)).toEqual({});
  });

  it("resolves only the explicitly-set fields, leaving every other field genuinely absent", () => {
    const node: EditorElementNode = { id: "n1", tag: "div", background: { color: "#ff0000" } };
    const style = resolveBackgroundStyle(node);
    expect(style).toEqual({ backgroundColor: "#ff0000" });
    expect(style.backgroundImage).toBeUndefined();
  });

  it("wraps an image URL in a CSS url() value", () => {
    const node: EditorElementNode = { id: "n1", tag: "div", background: { image: "https://example.com/hero.jpg" } };
    expect(resolveBackgroundStyle(node).backgroundImage).toBe('url("https://example.com/hero.jpg")');
  });

  it("escapes a quote character in an image URL rather than letting it break out of the generated CSS string", () => {
    const node: EditorElementNode = { id: "n1", tag: "div", background: { image: 'evil".jpg' } };
    expect(resolveBackgroundStyle(node).backgroundImage).toBe('url("evil\\".jpg")');
  });

  it("resolves cover and contain size presets verbatim", () => {
    expect(resolveBackgroundStyle({ id: "n1", tag: "div", background: { size: "cover" } }).backgroundSize).toBe("cover");
    expect(resolveBackgroundStyle({ id: "n1", tag: "div", background: { size: "contain" } }).backgroundSize).toBe("contain");
  });

  it("resolves an explicit auto size distinctly from an unset size", () => {
    expect(resolveBackgroundStyle({ id: "n1", tag: "div", background: { size: "auto" } }).backgroundSize).toBe("auto");
    expect(resolveBackgroundStyle({ id: "n1", tag: "div" }).backgroundSize).toBeUndefined();
  });

  it("resolves a custom size from both axes, including a mixed auto/length pair", () => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "div",
      background: { size: "custom", customSize: { width: { value: 200, unit: "px" }, height: "auto" } },
    };
    expect(resolveBackgroundStyle(node).backgroundSize).toBe("200px auto");
  });

  it("resolves every nine-point position to its CSS keyword pair", () => {
    const cases: Array<[string, string]> = [
      ["top-left", "left top"],
      ["top-center", "center top"],
      ["top-right", "right top"],
      ["center-left", "left center"],
      ["center", "center"],
      ["center-right", "right center"],
      ["bottom-left", "left bottom"],
      ["bottom-center", "center bottom"],
      ["bottom-right", "right bottom"],
    ];
    for (const [position, css] of cases) {
      const node: EditorElementNode = { id: "n1", tag: "div", background: { position: position as never } };
      expect(resolveBackgroundStyle(node).backgroundPosition, position).toBe(css);
    }
  });

  it("resolves repeat and attachment verbatim", () => {
    expect(resolveBackgroundStyle({ id: "n1", tag: "div", background: { repeat: "repeat-x" } }).backgroundRepeat).toBe("repeat-x");
    expect(resolveBackgroundStyle({ id: "n1", tag: "div", background: { attachment: "fixed" } }).backgroundAttachment).toBe("fixed");
  });
});
