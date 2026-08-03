import { describe, expect, it } from "vitest";
import { ancestorEstablishesStackingContext, establishesStackingContext } from "./stackingContext";
import type { EditorElementNode } from "@/features/editor/types/document";

function node(overrides: Partial<EditorElementNode> = {}): EditorElementNode {
  return { id: "n1", tag: "div", ...overrides };
}

describe("establishesStackingContext", () => {
  it("is false for a node with no position/filter settings at all", () => {
    expect(establishesStackingContext(node())).toBe(false);
  });

  it("is false for position: static, even with a numeric z-index", () => {
    expect(establishesStackingContext(node({ position: { position: "static", zIndex: 5 } }))).toBe(false);
  });

  it("is false for an unset position with a numeric z-index", () => {
    expect(establishesStackingContext(node({ position: { zIndex: 5 } }))).toBe(false);
  });

  it.each(["fixed", "sticky"] as const)("is true for position: %s regardless of z-index", (value) => {
    expect(establishesStackingContext(node({ position: { position: value } }))).toBe(true);
    expect(establishesStackingContext(node({ position: { position: value, zIndex: "auto" } }))).toBe(true);
  });

  it.each(["relative", "absolute"] as const)("is true for position: %s with an explicit numeric z-index", (value) => {
    expect(establishesStackingContext(node({ position: { position: value, zIndex: 1 } }))).toBe(true);
  });

  it.each(["relative", "absolute"] as const)("is false for position: %s with z-index auto or absent", (value) => {
    expect(establishesStackingContext(node({ position: { position: value } }))).toBe(false);
    expect(establishesStackingContext(node({ position: { position: value, zIndex: "auto" } }))).toBe(false);
  });

  it("is true for opacity below 100", () => {
    expect(establishesStackingContext(node({ filters: { opacity: 99 } }))).toBe(true);
  });

  it("is false for opacity at 100", () => {
    expect(establishesStackingContext(node({ filters: { opacity: 100 } }))).toBe(false);
  });

  it.each(["blur", "brightness", "contrast", "saturate", "grayscale", "hueRotate", "invert", "sepia"] as const)(
    "is true when %s is set",
    (field) => {
      const value = field === "blur" ? { value: 4, unit: "px" as const } : 50;
      expect(establishesStackingContext(node({ filters: { [field]: value } }))).toBe(true);
    },
  );
});

describe("ancestorEstablishesStackingContext", () => {
  it("is false when no ancestor establishes a stacking context", () => {
    const tree: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [{ id: "child", tag: "div" }],
    };
    expect(ancestorEstablishesStackingContext(tree, "child")).toBe(false);
  });

  it("is true when an ancestor several levels up has opacity below 100", () => {
    const tree: EditorElementNode = {
      id: "root",
      tag: "page",
      filters: { opacity: 50 },
      children: [
        {
          id: "mid",
          tag: "div",
          children: [{ id: "leaf", tag: "div" }],
        },
      ],
    };
    expect(ancestorEstablishesStackingContext(tree, "leaf")).toBe(true);
  });

  it("does not consider the node itself, only ancestors", () => {
    const tree: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [{ id: "child", tag: "div", filters: { opacity: 50 } }],
    };
    expect(ancestorEstablishesStackingContext(tree, "child")).toBe(false);
  });

  it("is false for the root itself (no ancestors)", () => {
    const tree: EditorElementNode = { id: "root", tag: "page", filters: { opacity: 50 } };
    expect(ancestorEstablishesStackingContext(tree, "root")).toBe(false);
  });
});
