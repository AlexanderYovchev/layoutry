import { describe, expect, it } from "vitest";
import {
  computeContainerChildScaling,
  deriveFlooredContainerOuterSize,
  type ContainerChildSnapshot,
} from "./computeContainerChildScaling";

const children: ContainerChildSnapshot[] = [
  { id: "a", tag: "img", geometry: { x: 16, y: 16, width: 100, height: 80 } },
  { id: "b", tag: "p", geometry: { x: 140, y: 16, width: 120, height: 80 } },
];

describe("computeContainerChildScaling — scale policy", () => {
  it("scales every child's x/y/width/height by the same factor when the container shrinks", () => {
    const result = computeContainerChildScaling(
      children,
      { width: 400, height: 300 },
      { width: 200, height: 150 },
      "scale",
    );

    expect(result.a).toEqual({ x: 8, y: 8, width: 50, height: 40 });
    expect(result.b).toEqual({ x: 70, y: 8, width: 60, height: 40 });
  });

  it("scales up proportionally when the container grows", () => {
    const result = computeContainerChildScaling(
      children,
      { width: 400, height: 300 },
      { width: 800, height: 600 },
      "scale",
    );

    expect(result.a).toEqual({ x: 32, y: 32, width: 200, height: 160 });
  });

  it("computes independent scaleX/scaleY (non-uniform resize)", () => {
    const result = computeContainerChildScaling(
      children,
      { width: 400, height: 300 },
      { width: 200, height: 300 },
      "scale",
    );

    // width halved, height unchanged
    expect(result.a).toEqual({ x: 8, y: 16, width: 50, height: 80 });
  });

  it("is a pure function of the session-start snapshot — repeated calls with the same inputs never drift", () => {
    const first = computeContainerChildScaling(
      children,
      { width: 400, height: 300 },
      { width: 250, height: 200 },
      "scale",
    );
    const second = computeContainerChildScaling(
      children,
      { width: 400, height: 300 },
      { width: 250, height: 200 },
      "scale",
    );
    expect(first).toEqual(second);
  });

  it("falls back to scale factor 1 when the starting bound is zero (avoids divide-by-zero)", () => {
    const result = computeContainerChildScaling(
      children,
      { width: 0, height: 300 },
      { width: 200, height: 150 },
      "scale",
    );
    expect(result.a.width).toBe(100);
  });
});

describe("computeContainerChildScaling — clamp policy", () => {
  it("keeps each child's size/position when the new bounds are large enough", () => {
    const result = computeContainerChildScaling(
      children,
      { width: 400, height: 300 },
      { width: 400, height: 300 },
      "clamp",
    );
    expect(result.a).toEqual(children[0].geometry);
    expect(result.b).toEqual(children[1].geometry);
  });

  it("shrinks/repositions a child that no longer fits the smaller bounds", () => {
    const result = computeContainerChildScaling(
      children,
      { width: 400, height: 300 },
      { width: 100, height: 100 },
      "clamp",
    );
    expect(result.a.x + result.a.width).toBeLessThanOrEqual(100);
    expect(result.a.y + result.a.height).toBeLessThanOrEqual(100);
    expect(result.b.x + result.b.width).toBeLessThanOrEqual(100);
  });

  it("respects each child's own tag minimum (a container child floors higher than a leaf)", () => {
    const mixedChildren: ContainerChildSnapshot[] = [
      { id: "leaf", tag: "img", geometry: { x: 0, y: 0, width: 300, height: 300 } },
      { id: "nested-container", tag: "div", geometry: { x: 0, y: 0, width: 300, height: 300 } },
    ];
    const result = computeContainerChildScaling(
      mixedChildren,
      { width: 400, height: 300 },
      { width: 50, height: 50 },
      "clamp",
    );
    expect(result.leaf.width).toBe(64);
    expect(result["nested-container"].width).toBe(160);
  });
});

describe("deriveFlooredContainerOuterSize", () => {
  const inset = { width: 40, height: 40 }; // e.g. 20px border/padding per side
  const startContentBounds = { width: 400, height: 300 };

  it("passes through a requested size that doesn't cross the minimum scale floor", () => {
    const result = deriveFlooredContainerOuterSize(340, 240, startContentBounds, inset);
    // requested content: 300x200 -> well above 0.25 * (400,300) = (100,75)
    expect(result).toEqual({ width: 340, height: 240 });
  });

  it("floors the outer size so content never scales below 25% of its starting size", () => {
    const result = deriveFlooredContainerOuterSize(50, 50, startContentBounds, inset);
    // requested content: 10x10, way below the (100,75) floor
    expect(result.width - inset.width).toBe(startContentBounds.width * 0.25);
    expect(result.height - inset.height).toBe(startContentBounds.height * 0.25);
  });

  it("never floors a growing resize (only ever intervenes on shrink past the floor)", () => {
    const result = deriveFlooredContainerOuterSize(1000, 900, startContentBounds, inset);
    expect(result).toEqual({ width: 1000, height: 900 });
  });

  it("floors each axis independently for a non-uniform resize", () => {
    // Width shrinks past the floor, height doesn't.
    const result = deriveFlooredContainerOuterSize(50, 240, startContentBounds, inset);
    expect(result.width - inset.width).toBe(startContentBounds.width * 0.25);
    expect(result.height).toBe(240);
  });
});
