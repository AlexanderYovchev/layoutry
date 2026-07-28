import { describe, expect, it } from "vitest";
import { resolveMediaFitStyle } from "./resolveMediaFitStyle";
import type { EditorElementNode } from "@/features/editor/types/document";

describe("resolveMediaFitStyle", () => {
  it("defaults to object-fit: contain, centered, filling its box", () => {
    const node: EditorElementNode = { id: "n1", tag: "img" };
    expect(resolveMediaFitStyle(node)).toEqual({
      width: "100%",
      height: "100%",
      maxWidth: "100%",
      maxHeight: "100%",
      objectFit: "contain",
      objectPosition: "center",
    });
  });

  it("uses the node's explicit fit and position", () => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "img",
      mediaFit: { fit: "cover", position: "top", preserveAspectRatio: true },
    };
    const style = resolveMediaFitStyle(node);
    expect(style.objectFit).toBe("cover");
    expect(style.objectPosition).toBe("top");
  });

  it("forces object-fit: fill when preserveAspectRatio is false, regardless of the chosen fit", () => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "img",
      mediaFit: { fit: "contain", position: "center", preserveAspectRatio: false },
    };
    expect(resolveMediaFitStyle(node).objectFit).toBe("fill");
  });

  it("always fills its outer box regardless of fit settings", () => {
    const node: EditorElementNode = { id: "n1", tag: "img", mediaFit: { fit: "fill", position: "left", preserveAspectRatio: true } };
    const style = resolveMediaFitStyle(node);
    expect(style.width).toBe("100%");
    expect(style.height).toBe("100%");
  });
});
