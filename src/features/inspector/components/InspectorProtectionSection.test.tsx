import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { InspectorProtectionSection } from "./InspectorProtectionSection";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";

const initialState = useEditorStore.getState();

describe("InspectorProtectionSection", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("renders the toggle off by default", () => {
    useEditorStore.setState((state) => ({ document: { ...state.document, children: [{ id: "hero", tag: "div" }] } }));
    render(<InspectorProtectionSection node={{ id: "hero", tag: "div" }} />);
    expect(screen.getByRole("switch", { name: "Lock child styles" })).toHaveAttribute("aria-checked", "false");
  });

  it("reflects an already-locked node as checked", () => {
    render(<InspectorProtectionSection node={{ id: "hero", tag: "div", lockChildStyles: true }} />);
    expect(screen.getByRole("switch", { name: "Lock child styles" })).toHaveAttribute("aria-checked", "true");
  });

  it("clicking the toggle commits lockChildStyles to the document, one history entry", () => {
    useEditorStore.setState((state) => ({ document: { ...state.document, children: [{ id: "hero", tag: "div" }] } }));
    const pastBefore = useEditorStore.getState().past.length;
    render(<InspectorProtectionSection node={{ id: "hero", tag: "div" }} />);

    fireEvent.click(screen.getByRole("switch", { name: "Lock child styles" }));

    expect(useEditorStore.getState().document.children![0].lockChildStyles).toBe(true);
    expect(useEditorStore.getState().past.length).toBe(pastBefore + 1);
  });
});
