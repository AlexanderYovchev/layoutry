import { describe, expect, it } from "vitest";
import type { EditorElementNode } from "@/features/editor/types/document";
import {
  applyFreeContainerChildGeometries,
  convertToFlowLayout,
  convertToFreeLayout,
  setChildResizePolicyForNode,
  setFreeChildGeometry,
} from "./layoutCommands";

function freeTree(): EditorElementNode {
  return {
    id: "root",
    tag: "page",
    children: [
      {
        id: "section-1",
        tag: "section",
        layoutMode: "free",
        childResizePolicy: "scale",
        freeLayout: { x: 10, y: 20, width: 200, height: 150 },
        children: [
          { id: "image-1", tag: "img", freeLayout: { x: 16, y: 16, width: 100, height: 80 } },
          { id: "paragraph-1", tag: "p", freeLayout: { x: 140, y: 16, width: 120, height: 60 } },
        ],
      },
      { id: "section-2", tag: "section", children: [{ id: "image-2", tag: "img" }] },
    ],
  };
}

describe("setFreeChildGeometry", () => {
  it("replaces exactly one node's freeLayout, leaving siblings untouched", () => {
    const root = freeTree();
    const result = setFreeChildGeometry(root, "image-1", { x: 50, y: 60, width: 90, height: 70 });

    const section = result.children?.find((child) => child.id === "section-1");
    const image1 = section?.children?.find((child) => child.id === "image-1");
    const paragraph1 = section?.children?.find((child) => child.id === "paragraph-1");

    expect(image1?.freeLayout).toEqual({ x: 50, y: 60, width: 90, height: 70 });
    expect(paragraph1?.freeLayout).toEqual({ x: 140, y: 16, width: 120, height: 60 });
  });

  it("keeps unrelated branches referentially unchanged", () => {
    const root = freeTree();
    const result = setFreeChildGeometry(root, "image-1", { x: 50, y: 60, width: 90, height: 70 });

    const otherSection = result.children?.find((child) => child.id === "section-2");
    expect(otherSection).toBe(root.children?.find((child) => child.id === "section-2"));
  });

  it("is a no-op (same reference) if the node doesn't exist", () => {
    const root = freeTree();
    const result = setFreeChildGeometry(root, "does-not-exist", { x: 0, y: 0, width: 10, height: 10 });
    expect(result).toBe(root);
  });

  it("floors width/height at the node's own tag minimum, same shape as resizeNode's defensive clamp", () => {
    const root = freeTree();
    // image-1 is a leaf (img) — generic 64x64 floor.
    const result = setFreeChildGeometry(root, "image-1", { x: 0, y: 0, width: 5, height: 5 });
    const image1 = result.children
      ?.find((child) => child.id === "section-1")
      ?.children?.find((child) => child.id === "image-1");
    expect(image1?.freeLayout).toEqual({ x: 0, y: 0, width: 64, height: 64 });
  });

  it("floors a container's width/height at its own (bigger) container minimum", () => {
    const root = freeTree();
    // section-1 is a "section" — 240x160 floor, not the generic 64x64.
    const result = setFreeChildGeometry(root, "section-1", { x: 0, y: 0, width: 5, height: 5 });
    const section = result.children?.find((child) => child.id === "section-1");
    expect(section?.freeLayout).toEqual({ x: 0, y: 0, width: 240, height: 160 });
  });
});

describe("applyFreeContainerChildGeometries", () => {
  it("updates the container's own dimensions and every listed direct child's freeLayout in one pass", () => {
    const root = freeTree();
    const result = applyFreeContainerChildGeometries(
      root,
      "section-1",
      { dimensions: { preferredWidth: 400, preferredHeight: 300, offsetX: 0, offsetY: 0 } },
      {
        "image-1": { x: 32, y: 32, width: 200, height: 160 },
        "paragraph-1": { x: 280, y: 32, width: 240, height: 120 },
      },
    );

    const section = result.children?.find((child) => child.id === "section-1");
    expect(section?.dimensions).toEqual({ preferredWidth: 400, preferredHeight: 300, offsetX: 0, offsetY: 0 });
    expect(section?.children?.find((child) => child.id === "image-1")?.freeLayout).toEqual({
      x: 32,
      y: 32,
      width: 200,
      height: 160,
    });
    expect(section?.children?.find((child) => child.id === "paragraph-1")?.freeLayout).toEqual({
      x: 280,
      y: 32,
      width: 240,
      height: 120,
    });
  });

  it("applies a freeLayout self-update when the container is itself a Free child", () => {
    const root: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [
        {
          id: "outer",
          tag: "div",
          layoutMode: "free",
          children: [
            {
              id: "inner",
              tag: "div",
              layoutMode: "free",
              freeLayout: { x: 10, y: 10, width: 200, height: 150 },
              children: [{ id: "leaf", tag: "p", freeLayout: { x: 5, y: 5, width: 50, height: 30 } }],
            },
          ],
        },
      ],
    };

    const result = applyFreeContainerChildGeometries(
      root,
      "inner",
      { freeLayout: { x: 10, y: 10, width: 100, height: 75 } },
      { leaf: { x: 2, y: 2, width: 25, height: 15 } },
    );

    const inner = result.children?.find((child) => child.id === "outer")?.children?.[0];
    expect(inner?.freeLayout).toEqual({ x: 10, y: 10, width: 100, height: 75 });
    expect(inner?.children?.[0].freeLayout).toEqual({ x: 2, y: 2, width: 25, height: 15 });
  });

  it("leaves a child out of the map entirely unchanged", () => {
    const root = freeTree();
    const result = applyFreeContainerChildGeometries(
      root,
      "section-1",
      {},
      { "image-1": { x: 1, y: 1, width: 64, height: 64 } },
    );
    const section = result.children?.find((child) => child.id === "section-1");
    expect(section?.children?.find((child) => child.id === "paragraph-1")?.freeLayout).toEqual({
      x: 140,
      y: 16,
      width: 120,
      height: 60,
    });
  });

  it("is a no-op (same reference) if containerId doesn't exist", () => {
    const root = freeTree();
    const result = applyFreeContainerChildGeometries(root, "does-not-exist", {}, {});
    expect(result).toBe(root);
  });
});

describe("convertToFreeLayout", () => {
  it("sets layoutMode free, defaults the policy to scale, and assigns each direct child's freeLayout", () => {
    const root: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [
        {
          id: "section-1",
          tag: "section",
          children: [
            { id: "heading-1", tag: "h1" },
            { id: "paragraph-1", tag: "p" },
          ],
        },
      ],
    };

    const result = convertToFreeLayout(root, "section-1", {
      "heading-1": { x: 16, y: 16, width: 240, height: 48 },
      "paragraph-1": { x: 16, y: 80, width: 240, height: 80 },
    });

    const section = result.children?.find((child) => child.id === "section-1");
    expect(section?.layoutMode).toBe("free");
    expect(section?.childResizePolicy).toBe("scale");
    expect(section?.children?.find((child) => child.id === "heading-1")?.freeLayout).toEqual({
      x: 16,
      y: 16,
      width: 240,
      height: 48,
    });
  });

  it("applies selfUpdate.dimensions to the container itself alongside its children's freeLayout", () => {
    const root: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [{ id: "section-1", tag: "section", children: [{ id: "heading-1", tag: "h1" }] }],
    };

    const result = convertToFreeLayout(
      root,
      "section-1",
      { "heading-1": { x: 16, y: 16, width: 240, height: 48 } },
      { dimensions: { preferredWidth: 400, preferredHeight: 300, offsetX: 0, offsetY: 0 } },
    );

    const section = result.children?.find((child) => child.id === "section-1");
    expect(section?.dimensions).toEqual({ preferredWidth: 400, preferredHeight: 300, offsetX: 0, offsetY: 0 });
  });

  it("applies selfUpdate.freeLayout instead when the container is itself a Free child", () => {
    const root: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [{ id: "section-1", tag: "section", children: [] }],
    };

    const result = convertToFreeLayout(root, "section-1", {}, { freeLayout: { x: 20, y: 30, width: 200, height: 150 } });

    const section = result.children?.find((child) => child.id === "section-1");
    expect(section?.freeLayout).toEqual({ x: 20, y: 30, width: 200, height: 150 });
    expect(section?.dimensions).toBeUndefined();
  });

  it("preserves an already-explicit childResizePolicy instead of overwriting it with the scale default", () => {
    const root: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [{ id: "section-1", tag: "section", childResizePolicy: "clamp", children: [] }],
    };

    const result = convertToFreeLayout(root, "section-1", {});
    expect(result.children?.find((child) => child.id === "section-1")?.childResizePolicy).toBe("clamp");
  });

  it("is a no-op for a tag that can't contain children", () => {
    const root: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [{ id: "heading-1", tag: "h1" }],
    };
    const result = convertToFreeLayout(root, "heading-1", {});
    expect(result).toBe(root);
  });

  it("is a no-op (same reference) if containerId doesn't exist", () => {
    const root = freeTree();
    const result = convertToFreeLayout(root, "does-not-exist", {});
    expect(result).toBe(root);
  });

  it("preserves the container's and its children's flowLayout/spacing/flexChild/gridChild across the Flow -> Free trip (Checkpoint 3.5)", () => {
    const root: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [
        {
          id: "section-1",
          tag: "section",
          flowLayout: { display: "flex", flex: { direction: "row", wrap: "nowrap", justifyContent: "center", alignItems: "stretch", rowGap: 8, columnGap: 8 } },
          spacing: { margin: { top: 0, right: 0, bottom: 0, left: 0 }, padding: { top: 16, right: 16, bottom: 16, left: 16 } },
          children: [
            {
              id: "heading-1",
              tag: "h1",
              flexChild: { grow: 1, shrink: 0, basis: "auto", alignSelf: "center" },
              spacing: { margin: { top: 4, right: 0, bottom: 0, left: 0 }, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
            },
          ],
        },
      ],
    };

    const result = convertToFreeLayout(root, "section-1", {
      "heading-1": { x: 16, y: 16, width: 240, height: 48 },
    });

    const section = result.children?.find((child) => child.id === "section-1");
    expect(section?.flowLayout).toEqual(root.children![0].flowLayout);
    expect(section?.spacing).toEqual(root.children![0].spacing);
    const heading = section?.children?.find((child) => child.id === "heading-1");
    expect(heading?.flexChild).toEqual(root.children![0].children![0].flexChild);
    expect(heading?.spacing).toEqual(root.children![0].children![0].spacing);
  });

  it("preserves a child's src and mediaFit across the Flow -> Free trip (Checkpoint 3.5.1)", () => {
    const root: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [
        {
          id: "section-1",
          tag: "section",
          children: [
            {
              id: "image-1",
              tag: "img",
              src: "data:image/svg+xml;utf8,<svg/>",
              mediaFit: { objectFit: "cover", objectPositionX: { value: 50, unit: "%" }, objectPositionY: { value: 0, unit: "%" } },
            },
          ],
        },
      ],
    };

    const result = convertToFreeLayout(root, "section-1", {
      "image-1": { x: 0, y: 0, width: 200, height: 150 },
    });

    const image = result.children?.find((c) => c.id === "section-1")?.children?.find((c) => c.id === "image-1");
    expect(image?.src).toBe(root.children![0].children![0].src);
    expect(image?.mediaFit).toEqual(root.children![0].children![0].mediaFit);
  });
});

describe("convertToFlowLayout", () => {
  it("sets layoutMode flow and clears every direct child's freeLayout", () => {
    const root = freeTree();
    const result = convertToFlowLayout(root, "section-1");

    const section = result.children?.find((child) => child.id === "section-1");
    expect(section?.layoutMode).toBe("flow");
    expect(section?.children?.every((child) => child.freeLayout === undefined)).toBe(true);
  });

  it("seeds dimensions from the former freeLayout's width/height when a child has none of its own", () => {
    const root = freeTree();
    const result = convertToFlowLayout(root, "section-1");

    const image1 = result.children?.find((child) => child.id === "section-1")?.children?.[0];
    expect(image1?.dimensions).toEqual({ preferredWidth: 100, preferredHeight: 80, offsetX: 0, offsetY: 0 });
  });

  it("does not overwrite a child's pre-existing dimensions", () => {
    const root = freeTree();
    root.children![0].children![0].dimensions = {
      preferredWidth: 999,
      preferredHeight: 999,
      offsetX: 0,
      offsetY: 0,
    };

    const result = convertToFlowLayout(root, "section-1");
    const image1 = result.children?.find((child) => child.id === "section-1")?.children?.[0];
    expect(image1?.dimensions).toEqual({ preferredWidth: 999, preferredHeight: 999, offsetX: 0, offsetY: 0 });
  });

  it("preserves document order (children array is untouched)", () => {
    const root = freeTree();
    const result = convertToFlowLayout(root, "section-1");
    const section = result.children?.find((child) => child.id === "section-1");
    expect(section?.children?.map((child) => child.id)).toEqual(["image-1", "paragraph-1"]);
  });

  it("preserves the container's and its children's flowLayout/spacing across the Free -> Flow trip (Checkpoint 3.5)", () => {
    const root = freeTree();
    root.children![0].flowLayout = { display: "grid", grid: { columns: 3, rows: "auto", rowGap: 16, columnGap: 16 } };
    root.children![0].spacing = {
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      padding: { top: 24, right: 24, bottom: 24, left: 24 },
    };
    root.children![0].children![0].gridChild = { columnStart: 1, columnSpan: 2, rowStart: "auto", rowSpan: 1 };

    const result = convertToFlowLayout(root, "section-1");

    const section = result.children?.find((child) => child.id === "section-1");
    expect(section?.flowLayout).toEqual(root.children![0].flowLayout);
    expect(section?.spacing).toEqual(root.children![0].spacing);
    expect(section?.children?.[0].gridChild).toEqual(root.children![0].children![0].gridChild);
  });

  it("preserves a child's src and mediaFit across the Free -> Flow trip (Checkpoint 3.5.1)", () => {
    const root = freeTree();
    root.children![0].children![0].src = "data:image/svg+xml;utf8,<svg/>";
    root.children![0].children![0].mediaFit = { objectFit: "cover", objectPositionX: { value: 50, unit: "%" }, objectPositionY: { value: 0, unit: "%" } };

    const result = convertToFlowLayout(root, "section-1");

    const image = result.children?.find((c) => c.id === "section-1")?.children?.[0];
    expect(image?.src).toBe(root.children![0].children![0].src);
    expect(image?.mediaFit).toEqual(root.children![0].children![0].mediaFit);
  });
});

describe("setChildResizePolicyForNode", () => {
  it("sets exactly one container's childResizePolicy", () => {
    const root = freeTree();
    const result = setChildResizePolicyForNode(root, "section-1", "clamp");
    expect(result.children?.find((child) => child.id === "section-1")?.childResizePolicy).toBe("clamp");
  });

  it("is a no-op (same reference) if containerId doesn't exist", () => {
    const root = freeTree();
    const result = setChildResizePolicyForNode(root, "does-not-exist", "clamp");
    expect(result).toBe(root);
  });
});
