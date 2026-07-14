import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useViewportWidth } from "./useViewportWidth";

const originalInnerWidth = window.innerWidth;

function setInnerWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
}

describe("useViewportWidth", () => {
  beforeEach(() => {
    // Make the resize-coalescing rAF synchronous and deterministic for
    // tests, regardless of jsdom's own timing for requestAnimationFrame.
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setInnerWidth(originalInnerWidth);
  });

  it("reports the current window width on mount", () => {
    setInnerWidth(1280);

    const { result } = renderHook(() => useViewportWidth());

    expect(result.current).toBe(1280);
  });

  it("updates when the window is resized", () => {
    setInnerWidth(1280);
    const { result } = renderHook(() => useViewportWidth());
    expect(result.current).toBe(1280);

    setInnerWidth(1024);
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(result.current).toBe(1024);
  });
});
