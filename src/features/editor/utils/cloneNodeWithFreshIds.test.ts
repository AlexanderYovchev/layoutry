import { describe, expect, it } from "vitest";
import { cloneNodeWithFreshIds } from "./cloneNodeWithFreshIds";
import type { EditorElementNode } from "@/features/editor/types/document";

describe("cloneNodeWithFreshIds", () => {
  it("gives the cloned root a fresh id, distinct from the source", () => {
    const source: EditorElementNode = { id: "image-1", tag: "img" };

    const clone = cloneNodeWithFreshIds(source);

    expect(clone.id).not.toBe(source.id);
    expect(clone.tag).toBe("img");
  });

  it("gives every descendant a fresh id too, not just the root", () => {
    const source: EditorElementNode = {
      id: "section-1",
      tag: "section",
      children: [
        { id: "heading-1", tag: "h1", text: "Title" },
        { id: "container-1", tag: "div", children: [{ id: "image-1", tag: "img" }] },
      ],
    };

    const clone = cloneNodeWithFreshIds(source);
    const ids = collectIds(clone);
    const sourceIds = collectIds(source);

    expect(ids).toHaveLength(sourceIds.length);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(sourceIds).not.toContain(id);
    }
  });

  it("preserves content, dimensions, and structure", () => {
    const source: EditorElementNode = {
      id: "image-1",
      tag: "img",
      dimensions: { preferredWidth: 300, preferredHeight: 150, offsetX: 0, offsetY: 0 },
      displayName: "Hero Image",
    };

    const clone = cloneNodeWithFreshIds(source);

    expect(clone.dimensions).toEqual(source.dimensions);
    expect(clone.displayName).toBe("Hero Image");
  });

  it("preserves the nested tree shape (children in the same order, same depth)", () => {
    const source: EditorElementNode = {
      id: "container-1",
      tag: "div",
      children: [
        { id: "a", tag: "p", text: "A" },
        { id: "b", tag: "p", text: "B" },
      ],
    };

    const clone = cloneNodeWithFreshIds(source);

    expect(clone.children?.map((child) => child.text)).toEqual(["A", "B"]);
  });

  it("preserves flowLayout, spacing, flexChild, and gridChild (Checkpoint 3.5)", () => {
    const source: EditorElementNode = {
      id: "container-1",
      tag: "div",
      flowLayout: { display: "flex", flex: { direction: "row", wrap: "wrap", justifyContent: "center", alignItems: "stretch", rowGap: 8, columnGap: 8 } },
      spacing: { margin: { top: 4, right: 4, bottom: 4, left: 4 }, padding: { top: 16, right: 16, bottom: 16, left: 16 } },
      children: [
        {
          id: "heading-1",
          tag: "h1",
          flexChild: { grow: 1, shrink: 0, basis: 200, alignSelf: "center" },
          gridChild: { columnStart: 2, columnSpan: 2, rowStart: "auto", rowSpan: 1 },
        },
      ],
    };

    const clone = cloneNodeWithFreshIds(source);

    expect(clone.flowLayout).toEqual(source.flowLayout);
    expect(clone.spacing).toEqual(source.spacing);
    expect(clone.children?.[0].flexChild).toEqual(source.children?.[0].flexChild);
    expect(clone.children?.[0].gridChild).toEqual(source.children?.[0].gridChild);
  });

  it("preserves src and mediaFit (Checkpoint 3.5.1)", () => {
    const source: EditorElementNode = {
      id: "image-1",
      tag: "img",
      src: "data:image/svg+xml;utf8,<svg/>",
      mediaFit: { objectFit: "cover", objectPositionX: { value: 50, unit: "%" }, objectPositionY: { value: 0, unit: "%" } },
    };

    const clone = cloneNodeWithFreshIds(source);

    expect(clone.src).toBe(source.src);
    expect(clone.mediaFit).toEqual(source.mediaFit);
  });

  it("preserves a Link's text and href, with a fresh id (Checkpoint 1.4)", () => {
    const source: EditorElementNode = {
      id: "link-1",
      tag: "a",
      text: "Learn more",
      href: "/about",
      typography: { fontWeight: 700 },
    };

    const clone = cloneNodeWithFreshIds(source);

    expect(clone.id).not.toBe(source.id);
    expect(clone.text).toBe("Learn more");
    expect(clone.href).toBe("/about");
    expect(clone.typography).toEqual({ fontWeight: 700 });
  });

  it("clones an entire list (ul + li children) recursively with fresh ids for every node (Checkpoint 1.6)", () => {
    const source: EditorElementNode = {
      id: "list-1",
      tag: "ul",
      children: [
        { id: "li-1", tag: "li", text: "Alpha" },
        { id: "li-2", tag: "li", text: "Beta" },
        { id: "li-3", tag: "li", text: "Gamma" },
      ],
    };

    const clone = cloneNodeWithFreshIds(source);

    expect(clone.id).not.toBe(source.id);
    expect(clone.tag).toBe("ul");
    expect(clone.children).toHaveLength(3);
    expect(clone.children?.map((c) => c.text)).toEqual(["Alpha", "Beta", "Gamma"]);
    const sourceIds = collectIds(source);
    const cloneIds = collectIds(clone);
    expect(new Set(cloneIds).size).toBe(cloneIds.length);
    for (const id of cloneIds) {
      expect(sourceIds).not.toContain(id);
    }
  });

  it("preserves typography (Checkpoint 4.2)", () => {
    const source: EditorElementNode = {
      id: "heading-1",
      tag: "h1",
      typography: {
        fontFamily: "Georgia, serif",
        fontSize: { value: 32, unit: "px" },
        fontWeight: 700,
        color: "#3366ff",
      },
    };

    const clone = cloneNodeWithFreshIds(source);

    expect(clone.typography).toEqual(source.typography);
  });

  it("preserves background (Checkpoint 4.3)", () => {
    const source: EditorElementNode = {
      id: "container-1",
      tag: "div",
      background: {
        color: "#3366ff",
        image: "https://example.com/hero.jpg",
        size: "custom",
        customSize: { width: { value: 200, unit: "px" }, height: "auto" },
        position: "center",
        repeat: "no-repeat",
        attachment: "fixed",
      },
    };

    const clone = cloneNodeWithFreshIds(source);

    expect(clone.background).toEqual(source.background);
  });

  it("preserves a gradient, including its stop ids verbatim (Checkpoint 4.3.1)", () => {
    const source: EditorElementNode = {
      id: "container-1",
      tag: "div",
      background: {
        sourceType: "gradient",
        gradient: {
          type: "radial",
          shape: "circle",
          position: "top-left",
          stops: [
            { id: "stop-a", color: "#ff0000", position: 0 },
            { id: "stop-b", color: "#00ff00", position: 100 },
          ],
        },
      },
    };

    const clone = cloneNodeWithFreshIds(source);

    // Gradient stop ids are local identities scoped to their own parent
    // gradient (only ever looked up as `gradient.stops.find(s => s.id ===
    // ...)` within the same element) — never looked up globally across
    // the document — so a duplicated element keeping the exact same stop
    // ids as its source is safe: there is no cross-element stop lookup
    // anywhere in this codebase that duplicate ids could collide with.
    // Regenerating them here would add complexity with no real benefit.
    expect(clone.background).toEqual(source.background);
  });

  it("preserves border, independently per side (Checkpoint 4.4)", () => {
    const source: EditorElementNode = {
      id: "container-1",
      tag: "div",
      border: {
        top: { width: { value: 2, unit: "px" }, style: "solid", color: "#3366ff" },
        left: { style: "dashed" },
      },
    };

    const clone = cloneNodeWithFreshIds(source);

    expect(clone.border).toEqual(source.border);
  });

  it("preserves border radius, independently per corner (Checkpoint 4.5)", () => {
    const source: EditorElementNode = {
      id: "container-1",
      tag: "div",
      borderRadius: {
        topLeft: { value: 8, unit: "px" },
        bottomRight: { value: 50, unit: "%" },
      },
    };

    const clone = cloneNodeWithFreshIds(source);

    expect(clone.borderRadius).toEqual(source.borderRadius);
  });

  it("preserves box shadow layers verbatim, including their stop-like ids (Checkpoint 4.6)", () => {
    const source: EditorElementNode = {
      id: "container-1",
      tag: "div",
      boxShadow: [
        { id: "shadow-1", enabled: true, inset: false, offsetY: { value: 4, unit: "px" }, color: "#000000" },
        { id: "shadow-2", enabled: false, inset: true, blur: { value: 8, unit: "px" } },
      ],
    };

    const clone = cloneNodeWithFreshIds(source);

    // Shadow layer ids, like gradient stop ids, are local identities scoped
    // to their own parent node's boxShadow array — never looked up
    // globally — so preserving them verbatim on clone is safe; see this
    // file's gradient stop test above for the identical precedent.
    expect(clone.boxShadow).toEqual(source.boxShadow);
  });

  it("preserves visual effects (Checkpoint 4.7)", () => {
    const source: EditorElementNode = {
      id: "container-1",
      tag: "div",
      filters: { opacity: 80, blur: { value: 4, unit: "px" }, hueRotate: 90 },
    };

    const clone = cloneNodeWithFreshIds(source);

    expect(clone.filters).toEqual(source.filters);
  });

  it("preserves display/visibility/overflow/interaction settings (Checkpoint 4.8)", () => {
    const source: EditorElementNode = {
      id: "container-1",
      tag: "div",
      display: { display: "none", overflowX: "hidden", cursor: "pointer" },
    };

    const clone = cloneNodeWithFreshIds(source);

    expect(clone.display).toEqual(source.display);
  });

  it("preserves sizeConstraints and an explicit resize lock override (Checkpoint 5.7)", () => {
    const source: EditorElementNode = {
      id: "container-1",
      tag: "div",
      sizeConstraints: { minWidth: 100, maxWidth: 800 },
      aspectRatioLocked: true,
      dimensions: { preferredWidth: 320, preferredHeight: 180, offsetX: 0, offsetY: 0 },
    };

    const clone = cloneNodeWithFreshIds(source);

    expect(clone.sizeConstraints).toEqual(source.sizeConstraints);
    expect(clone.aspectRatioLocked).toBe(true);
    expect(clone.dimensions).toEqual(source.dimensions);
  });

  it("does not mutate the source tree", () => {
    const source: EditorElementNode = {
      id: "container-1",
      tag: "div",
      children: [{ id: "heading-1", tag: "h1", text: "Title" }],
    };

    cloneNodeWithFreshIds(source);

    expect(source.id).toBe("container-1");
    expect(source.children?.[0].id).toBe("heading-1");
  });
});

function collectIds(node: EditorElementNode): string[] {
  return [node.id, ...(node.children ?? []).flatMap(collectIds)];
}
