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
      mediaFit: { fit: "cover", position: "top", preserveAspectRatio: true },
    };

    const clone = cloneNodeWithFreshIds(source);

    expect(clone.src).toBe(source.src);
    expect(clone.mediaFit).toEqual(source.mediaFit);
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
