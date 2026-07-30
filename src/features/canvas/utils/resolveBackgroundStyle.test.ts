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

  it("resolves cover and contain size presets verbatim, while Image is the active source", () => {
    expect(resolveBackgroundStyle({ id: "n1", tag: "div", background: { image: "hero.jpg", size: "cover" } }).backgroundSize).toBe("cover");
    expect(resolveBackgroundStyle({ id: "n1", tag: "div", background: { image: "hero.jpg", size: "contain" } }).backgroundSize).toBe("contain");
  });

  it("resolves an explicit auto size distinctly from an unset size", () => {
    expect(resolveBackgroundStyle({ id: "n1", tag: "div", background: { image: "hero.jpg", size: "auto" } }).backgroundSize).toBe("auto");
    expect(resolveBackgroundStyle({ id: "n1", tag: "div" }).backgroundSize).toBeUndefined();
  });

  it("resolves a custom size from both axes, including a mixed auto/length pair", () => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "div",
      background: { image: "hero.jpg", size: "custom", customSize: { width: { value: 200, unit: "px" }, height: "auto" } },
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
      const node: EditorElementNode = { id: "n1", tag: "div", background: { image: "hero.jpg", position: position as never } };
      expect(resolveBackgroundStyle(node).backgroundPosition, position).toBe(css);
    }
  });

  it("resolves repeat and attachment verbatim", () => {
    expect(resolveBackgroundStyle({ id: "n1", tag: "div", background: { image: "hero.jpg", repeat: "repeat-x" } }).backgroundRepeat).toBe("repeat-x");
    expect(resolveBackgroundStyle({ id: "n1", tag: "div", background: { image: "hero.jpg", attachment: "fixed" } }).backgroundAttachment).toBe("fixed");
  });

  it("falls back to treating a stored image as active when sourceType is absent (Checkpoint 4.3 document compatibility)", () => {
    const node: EditorElementNode = { id: "n1", tag: "div", background: { image: "hero.jpg" } };
    expect(resolveBackgroundStyle(node).backgroundImage).toBe('url("hero.jpg")');
  });

  it("does not render a stored image while Gradient is the explicit active source", () => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "div",
      background: {
        sourceType: "gradient",
        image: "hero.jpg",
        size: "cover",
        repeat: "repeat",
        gradient: { type: "linear", angle: 90, stops: [{ id: "a", color: "#000000", position: 0 }, { id: "b", color: "#ffffff", position: 100 }] },
      },
    };
    const style = resolveBackgroundStyle(node);
    expect(style.backgroundImage).toBe("linear-gradient(90deg, #000000 0%, #ffffff 100%)");
    expect(style.backgroundSize).toBeUndefined();
    expect(style.backgroundRepeat).toBeUndefined();
  });

  it("does not render a stored gradient while Image is the active source, and Background Color stays independent of either", () => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "div",
      background: {
        sourceType: "image",
        color: "#3366ff",
        image: "hero.jpg",
        gradient: { type: "linear", angle: 45, stops: [{ id: "a", color: "#000000", position: 0 }, { id: "b", color: "#ffffff", position: 100 }] },
      },
    };
    const style = resolveBackgroundStyle(node);
    expect(style.backgroundColor).toBe("#3366ff");
    expect(style.backgroundImage).toBe('url("hero.jpg")');
  });

  it("does not implicitly activate a stored gradient with no explicit sourceType (unlike image, gradient has no legacy-document fallback)", () => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "div",
      background: {
        gradient: { type: "linear", angle: 90, stops: [{ id: "a", color: "#000000", position: 0 }, { id: "b", color: "#ffffff", position: 100 }] },
      },
    };
    expect(resolveBackgroundStyle(node).backgroundImage).toBeUndefined();
  });
});
