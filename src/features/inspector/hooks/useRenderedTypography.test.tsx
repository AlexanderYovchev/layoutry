import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { useRenderedTypography } from "./useRenderedTypography";

/**
 * BC-01.5 — the hook reads computed styles from the Canvas element. jsdom
 * has no Tailwind and does not resolve unitless line-heights, so each test
 * renders a stand-in element with the computed values a browser reports
 * (Chromium reports line-height in px, or "normal").
 */

const initialState = useEditorStore.getState();
let surface: HTMLElement;

function canvasElement(id: string, style: Partial<Record<"fontSize" | "lineHeight" | "letterSpacing", string>>) {
  const element = window.document.createElement("p");
  element.setAttribute("data-node-id", id);
  Object.assign(element.style, style);
  surface.append(element);
  return element;
}

beforeEach(() => {
  surface = window.document.createElement("div");
  surface.setAttribute("data-document-surface", "");
  window.document.body.append(surface);
});

afterEach(() => {
  surface.remove();
  useEditorStore.setState(initialState, true);
});

describe("useRenderedTypography", () => {
  it("reports font size in px, line height as a multiple of the font size, letter spacing in px", () => {
    canvasElement("heading-1", { fontSize: "30px", lineHeight: "36px", letterSpacing: "-0.75px" });
    const { result } = renderHook(() => useRenderedTypography("heading-1"));

    expect(result.current).toEqual({
      fontSizePx: 30,
      lineHeight: { kind: "number", value: 1.2 },
      letterSpacing: { kind: "number", value: -0.75 },
    });
  });

  it("keeps `normal` as `normal` rather than inventing a number", () => {
    canvasElement("option-1", { fontSize: "14px", lineHeight: "normal", letterSpacing: "normal" });
    const { result } = renderHook(() => useRenderedTypography("option-1"));

    expect(result.current?.lineHeight).toEqual({ kind: "normal" });
    expect(result.current?.letterSpacing).toEqual({ kind: "normal" });
  });

  it("rounds the line-height multiple (20px / 14px) and reports an unreadable value as null without losing the font size", () => {
    canvasElement("button-1", { fontSize: "14px", lineHeight: "20px" });
    const { result } = renderHook(() => useRenderedTypography("button-1"));

    expect(result.current?.fontSizePx).toBe(14);
    expect(result.current?.lineHeight).toEqual({ kind: "number", value: 1.429 });
  });

  it("returns null for a node that is not on the Canvas, or when asked not to measure", () => {
    canvasElement("heading-1", { fontSize: "30px" });
    expect(renderHook(() => useRenderedTypography("missing-node")).result.current).toBeNull();
    expect(renderHook(() => useRenderedTypography(null)).result.current).toBeNull();
  });

  it("only reads elements inside the document surface", () => {
    const outside = window.document.createElement("p");
    outside.setAttribute("data-node-id", "outside-1");
    outside.style.fontSize = "99px";
    window.document.body.append(outside);
    try {
      expect(renderHook(() => useRenderedTypography("outside-1")).result.current).toBeNull();
    } finally {
      outside.remove();
    }
  });

  it("re-measures after a document change and never reports one node's values for another", () => {
    const element = canvasElement("heading-1", { fontSize: "30px", lineHeight: "36px" });
    canvasElement("paragraph-1", { fontSize: "16px", lineHeight: "26px" });
    const { result, rerender } = renderHook(({ id }) => useRenderedTypography(id), { initialProps: { id: "heading-1" } });
    expect(result.current?.lineHeight).toEqual({ kind: "number", value: 1.2 });

    element.style.lineHeight = "45px";
    act(() => useEditorStore.getState().setElementTypography("paragraph-1", { color: "#111111" }));
    expect(result.current?.lineHeight).toEqual({ kind: "number", value: 1.5 });

    rerender({ id: "paragraph-1" });
    expect(result.current?.lineHeight).toEqual({ kind: "number", value: 1.625 });
  });
});
