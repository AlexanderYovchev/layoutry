import { describe, expect, it } from "vitest";
import { measureFreeContainerBounds } from "./measureFreeContainerBounds";

function stubClientSize(el: HTMLElement, width: number, height: number) {
  Object.defineProperty(el, "clientWidth", { value: width, configurable: true });
  Object.defineProperty(el, "clientHeight", { value: height, configurable: true });
}

describe("measureFreeContainerBounds", () => {
  it("returns clientWidth/clientHeight unchanged when there is no padding", () => {
    const el = document.createElement("div");
    stubClientSize(el, 400, 300);

    expect(measureFreeContainerBounds(el)).toEqual({ width: 400, height: 300 });
  });

  it("subtracts padding from clientWidth/clientHeight, which already include it", () => {
    const el = document.createElement("div");
    el.style.paddingLeft = "16px";
    el.style.paddingRight = "16px";
    el.style.paddingTop = "8px";
    el.style.paddingBottom = "8px";
    stubClientSize(el, 400, 300);

    expect(measureFreeContainerBounds(el)).toEqual({ width: 368, height: 284 });
  });

  it("never returns a negative size when padding exceeds the client box", () => {
    const el = document.createElement("div");
    el.style.paddingLeft = "300px";
    el.style.paddingRight = "300px";
    stubClientSize(el, 400, 300);

    expect(measureFreeContainerBounds(el).width).toBe(0);
  });
});
