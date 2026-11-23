import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useSnapPreferenceHydration } from "@/features/editor/hooks/useSnapPreferenceHydration";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { readSnapPreference, SNAP_PREFERENCE_KEY } from "@/features/editor/utils/snapPreference";
import { CanvasControlStrip } from "./CanvasControlStrip";

/** BC-13.3 (D11/D36) — the Canvas control strip and the global Snap preference. */

const initialState = useEditorStore.getState();

describe("CanvasControlStrip", () => {
  beforeEach(() => {
    window.localStorage.removeItem(SNAP_PREFERENCE_KEY);
    useEditorStore.setState(initialState, true);
  });
  afterEach(() => {
    window.localStorage.removeItem(SNAP_PREFERENCE_KEY);
    useEditorStore.setState(initialState, true);
  });

  it("a named, pressed toggle that switches snapping without touching the document or history, and remembers the choice", () => {
    render(<CanvasControlStrip />);
    const toggle = screen.getByRole("button", { name: "Snap" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(toggle).toHaveTextContent("On");
    const document = useEditorStore.getState().document;
    fireEvent.click(toggle);
    expect(useEditorStore.getState().snapEnabled).toBe(false);
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveTextContent("Off");
    expect(useEditorStore.getState().document).toBe(document);
    expect(useEditorStore.getState().past).toHaveLength(0);
    expect(readSnapPreference()).toBe(false);
  });

  it("the info popover explains the threshold, Alt/Option, guides when off and Shift; Escape closes it and returns focus", () => {
    render(<CanvasControlStrip />);
    const info = screen.getByRole("button", { name: "About snapping" });
    expect(info).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(info);
    expect(info).toHaveAttribute("aria-expanded", "true");
    const popover = screen.getByRole("dialog", { name: "About snapping" });
    expect(popover).toHaveTextContent("6 screen pixels");
    expect(popover).toHaveTextContent("Alt (Option on a Mac)");
    expect(popover).toHaveTextContent("still show when snapping is off");
    expect(popover).toHaveTextContent("Shift");
    expect(info.getAttribute("aria-controls")).toBe(popover.id);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "About snapping" })).not.toBeInTheDocument();
    expect(info).toHaveFocus();
  });

  it("an outside press closes the popover", () => {
    render(
      <>
        <CanvasControlStrip />
        <button type="button">elsewhere</button>
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "About snapping" }));
    fireEvent.pointerDown(screen.getByRole("button", { name: "elsewhere" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("is not shown in Preview", () => {
    act(() => useEditorStore.setState({ editorMode: "preview" }));
    render(<CanvasControlStrip />);
    expect(screen.queryByRole("toolbar", { name: "Canvas controls" })).not.toBeInTheDocument();
  });
});

describe("the global Snap preference", () => {
  beforeEach(() => {
    window.localStorage.removeItem(SNAP_PREFERENCE_KEY);
    useEditorStore.setState(initialState, true);
  });
  afterEach(() => {
    window.localStorage.removeItem(SNAP_PREFERENCE_KEY);
    useEditorStore.setState(initialState, true);
  });

  it("a remembered 'off' is applied after mount; missing or invalid values keep the default (on)", () => {
    window.localStorage.setItem(SNAP_PREFERENCE_KEY, "false");
    renderHook(() => useSnapPreferenceHydration());
    expect(useEditorStore.getState().snapEnabled).toBe(false);

    useEditorStore.setState(initialState, true);
    window.localStorage.setItem(SNAP_PREFERENCE_KEY, "maybe");
    renderHook(() => useSnapPreferenceHydration());
    expect(useEditorStore.getState().snapEnabled).toBe(true);
    expect(readSnapPreference()).toBeNull();

    window.localStorage.removeItem(SNAP_PREFERENCE_KEY);
    renderHook(() => useSnapPreferenceHydration());
    expect(useEditorStore.getState().snapEnabled).toBe(true);
  });

  it("is not part of a loaded project: replacing the document keeps the preference", () => {
    useEditorStore.getState().setSnapEnabled(false);
    useEditorStore.getState().replaceDocument({ id: "page-root", tag: "page", children: [] });
    expect(useEditorStore.getState().snapEnabled).toBe(false);
  });
});
