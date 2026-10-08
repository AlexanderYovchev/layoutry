import { describe, expect, it } from "vitest";
import { resolveTransformStyle } from "./resolveTransformStyle";

describe("resolveTransformStyle", () => {
  it("returns {} for a node with no authored Transform", () => {
    expect(resolveTransformStyle({ id: "a", tag: "div" })).toEqual({});
  });

  it("emits only rotate() when only rotateDeg is set", () => {
    expect(resolveTransformStyle({ id: "a", tag: "div", transform: { rotateDeg: 15 } })).toEqual({ transform: "rotate(15deg)" });
  });

  it("emits only scale() when only scale is set", () => {
    expect(resolveTransformStyle({ id: "a", tag: "div", transform: { scale: 1.5 } })).toEqual({ transform: "scale(1.5)" });
  });

  it("emits translate() with both arguments when only translateX is set", () => {
    expect(resolveTransformStyle({ id: "a", tag: "div", transform: { translateX: 20 } })).toEqual({ transform: "translate(20px, 0px)" });
  });

  it("emits translate() with both arguments when only translateY is set", () => {
    expect(resolveTransformStyle({ id: "a", tag: "div", transform: { translateY: 10 } })).toEqual({ transform: "translate(0px, 10px)" });
  });

  it("composes all three in canonical order: translate, rotate, scale", () => {
    expect(
      resolveTransformStyle({ id: "a", tag: "div", transform: { translateX: 20, translateY: 10, rotateDeg: 15, scale: 1.2 } }),
    ).toEqual({ transform: "translate(20px, 10px) rotate(15deg) scale(1.2)" });
  });

  it("supports negative translate/rotate and zero/negative scale", () => {
    expect(resolveTransformStyle({ id: "a", tag: "div", transform: { translateX: -20, rotateDeg: -15, scale: -1 } })).toEqual({
      transform: "translate(-20px, 0px) rotate(-15deg) scale(-1)",
    });
    expect(resolveTransformStyle({ id: "a", tag: "div", transform: { scale: 0 } })).toEqual({ transform: "scale(0)" });
  });
});
