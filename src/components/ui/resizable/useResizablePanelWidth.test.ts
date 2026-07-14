import { act, renderHook } from "@testing-library/react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useResizablePanelWidth } from "./useResizablePanelWidth";

function mockPointerEvent(clientX: number) {
  return {
    clientX,
    pointerId: 1,
    preventDefault: () => {},
    currentTarget: {
      setPointerCapture: () => {},
      releasePointerCapture: () => {},
    },
  } as unknown as ReactPointerEvent<HTMLDivElement>;
}

describe("useResizablePanelWidth", () => {
  const storageKey = "test:panel-width";

  beforeEach(() => {
    window.localStorage.removeItem(storageKey);
  });

  afterEach(() => {
    window.localStorage.removeItem(storageKey);
  });

  it("starts at the default width when nothing is stored", () => {
    const { result } = renderHook(() =>
      useResizablePanelWidth({
        storageKey,
        defaultWidth: 280,
        minWidth: 220,
        maxWidth: 520,
        growDirection: "right",
      }),
    );

    expect(result.current.width).toBe(280);
  });

  it("restores a previously stored width on mount", () => {
    window.localStorage.setItem(storageKey, "340");

    const { result } = renderHook(() =>
      useResizablePanelWidth({
        storageKey,
        defaultWidth: 280,
        minWidth: 220,
        maxWidth: 520,
        growDirection: "right",
      }),
    );

    expect(result.current.width).toBe(340);
  });

  it("grows when dragging right for a right-growing panel and persists on release", () => {
    const { result } = renderHook(() =>
      useResizablePanelWidth({
        storageKey,
        defaultWidth: 280,
        minWidth: 220,
        maxWidth: 520,
        growDirection: "right",
      }),
    );

    act(() => result.current.handlePointerDown(mockPointerEvent(100)));
    act(() => result.current.handlePointerMove(mockPointerEvent(160)));

    expect(result.current.width).toBe(340);
    expect(result.current.isDragging).toBe(true);

    act(() => result.current.handlePointerUp(mockPointerEvent(160)));

    expect(result.current.isDragging).toBe(false);
    expect(window.localStorage.getItem(storageKey)).toBe("340");
  });

  it("shrinks when dragging right for a left-growing panel", () => {
    const { result } = renderHook(() =>
      useResizablePanelWidth({
        storageKey,
        defaultWidth: 300,
        minWidth: 200,
        maxWidth: 520,
        growDirection: "left",
      }),
    );

    act(() => result.current.handlePointerDown(mockPointerEvent(500)));
    act(() => result.current.handlePointerMove(mockPointerEvent(560)));

    expect(result.current.width).toBe(240);
  });

  it("clamps to the minimum and maximum width", () => {
    const { result } = renderHook(() =>
      useResizablePanelWidth({
        storageKey,
        defaultWidth: 280,
        minWidth: 220,
        maxWidth: 320,
        growDirection: "right",
      }),
    );

    act(() => result.current.handlePointerDown(mockPointerEvent(0)));
    act(() => result.current.handlePointerMove(mockPointerEvent(-1000)));
    expect(result.current.width).toBe(220);

    act(() => result.current.handlePointerMove(mockPointerEvent(1000)));
    expect(result.current.width).toBe(320);
  });

  it("restores the default width and persists it on reset", () => {
    const { result } = renderHook(() =>
      useResizablePanelWidth({
        storageKey,
        defaultWidth: 280,
        minWidth: 220,
        maxWidth: 520,
        growDirection: "right",
      }),
    );

    act(() => result.current.handlePointerDown(mockPointerEvent(0)));
    act(() => result.current.handlePointerMove(mockPointerEvent(200)));
    expect(result.current.width).toBe(480);

    act(() => result.current.reset());

    expect(result.current.width).toBe(280);
    expect(window.localStorage.getItem(storageKey)).toBe("280");
  });
});
