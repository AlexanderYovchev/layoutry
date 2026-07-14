import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDismissableTransition } from "./useDismissableTransition";

describe("useDismissableTransition", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("mounts immediately and becomes visible on the next frame when opened", () => {
    const { result } = renderHook(
      ({ isOpen }) => useDismissableTransition(isOpen, 200),
      { initialProps: { isOpen: true } },
    );

    expect(result.current.shouldRender).toBe(true);
    expect(result.current.isVisible).toBe(true);
  });

  it("stays mounted and invisible for exitDurationMs after closing, then unmounts", () => {
    const { result, rerender } = renderHook(
      ({ isOpen }) => useDismissableTransition(isOpen, 200),
      { initialProps: { isOpen: true } },
    );

    rerender({ isOpen: false });

    expect(result.current.isVisible).toBe(false);
    expect(result.current.shouldRender).toBe(true);

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.shouldRender).toBe(false);
  });

  it("never renders while closed from the start", () => {
    const { result } = renderHook(
      ({ isOpen }) => useDismissableTransition(isOpen, 200),
      { initialProps: { isOpen: false } },
    );

    expect(result.current.shouldRender).toBe(false);
    expect(result.current.isVisible).toBe(false);
  });
});
