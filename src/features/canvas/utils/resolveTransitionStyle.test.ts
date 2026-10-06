import { describe, expect, it } from "vitest";
import { resolveTransitionStyle } from "./resolveTransitionStyle";
import { DEFAULT_TRANSITION_SETTINGS } from "@/features/editor/types/transition";
import type { EditorElementNode } from "@/features/editor/types/document";

function node(transition?: typeof DEFAULT_TRANSITION_SETTINGS): EditorElementNode {
  return { id: "n1", tag: "div", transition };
}

describe("resolveTransitionStyle", () => {
  it("returns no transition CSS in Design, even with an authored transition", () => {
    expect(resolveTransitionStyle(node(DEFAULT_TRANSITION_SETTINGS), false)).toEqual({});
  });

  it("returns no transition CSS in Preview when nothing is authored", () => {
    expect(resolveTransitionStyle(node(undefined), true)).toEqual({});
  });

  it("emits all four CSS longhands in Preview when a transition is authored", () => {
    const style = resolveTransitionStyle(node(DEFAULT_TRANSITION_SETTINGS), true);
    expect(style).toEqual({
      transitionProperty: "opacity",
      transitionDuration: "200ms",
      transitionTimingFunction: "ease",
      transitionDelay: "0ms",
    });
  });

  it("formats duration/delay as millisecond strings for arbitrary values", () => {
    const style = resolveTransitionStyle(node({ property: "box-shadow", durationMs: 1000, timingFunction: "ease-in-out", delayMs: 150 }), true);
    expect(style.transitionDuration).toBe("1000ms");
    expect(style.transitionDelay).toBe("150ms");
    expect(style.transitionProperty).toBe("box-shadow");
    expect(style.transitionTimingFunction).toBe("ease-in-out");
  });

  it("never emits the transition shorthand", () => {
    const style = resolveTransitionStyle(node(DEFAULT_TRANSITION_SETTINGS), true);
    expect(style).not.toHaveProperty("transition");
  });
});
