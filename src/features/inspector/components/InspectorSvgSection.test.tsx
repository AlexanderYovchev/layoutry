import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { InspectorSvgSection } from "./InspectorSvgSection";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { getStyleProtection } from "@/features/editor/rules/styleProtection";

const initialState = useEditorStore.getState();
const unprotected = getStyleProtection(initialState.document, "does-not-exist");

describe("InspectorSvgSection", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("shows Rectangle as pressed for an unset Primitive", () => {
    render(<InspectorSvgSection node={{ id: "a", tag: "svg" }} protection={unprotected} />);
    expect(screen.getByRole("button", { name: "Rectangle" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the stored Primitive as pressed", () => {
    render(<InspectorSvgSection node={{ id: "a", tag: "svg", svgKind: "star" }} protection={unprotected} />);
    expect(screen.getByRole("button", { name: "Star" })).toHaveAttribute("aria-pressed", "true");
  });

  it("clicking a Primitive commits it to the document, one history entry", () => {
    useEditorStore.setState((state) => ({ document: { ...state.document, children: [{ id: "a", tag: "svg" }] } }));
    const pastBefore = useEditorStore.getState().past.length;
    render(<InspectorSvgSection node={{ id: "a", tag: "svg" }} protection={unprotected} />);

    fireEvent.click(screen.getByRole("button", { name: "Circle" }));

    expect(useEditorStore.getState().document.children![0].svgKind).toBe("circle");
    expect(useEditorStore.getState().past.length).toBe(pastBefore + 1);
  });

  it("commits a valid Fill color and rejects an invalid one", () => {
    useEditorStore.setState((state) => ({ document: { ...state.document, children: [{ id: "a", tag: "svg" }] } }));
    render(<InspectorSvgSection node={{ id: "a", tag: "svg" }} protection={unprotected} />);

    const fillField = screen.getByRole("textbox", { name: "Fill" });
    fireEvent.change(fillField, { target: { value: "#ff0000" } });
    fireEvent.blur(fillField);
    expect(useEditorStore.getState().document.children![0].svgFill).toBe("#ff0000");

    fireEvent.change(fillField, { target: { value: "not-a-color" } });
    fireEvent.blur(fillField);
    expect(useEditorStore.getState().document.children![0].svgFill).toBe("#ff0000");
    expect(screen.getByText("Enter a hex color (#RRGGBB) or an rgb()/rgba() value.")).toBeInTheDocument();
  });

  it("Stroke starts as None (unset), and committing a valid color writes it to the document", () => {
    useEditorStore.setState((state) => ({ document: { ...state.document, children: [{ id: "a", tag: "svg" }] } }));
    render(<InspectorSvgSection node={{ id: "a", tag: "svg" }} protection={unprotected} />);

    const strokeField = screen.getByRole("textbox", { name: "Stroke" });
    expect(strokeField).toHaveValue("");
    fireEvent.change(strokeField, { target: { value: "#000000" } });
    fireEvent.blur(strokeField);
    expect(useEditorStore.getState().document.children![0].svgStroke).toBe("#000000");
  });

  it("resetting an already-set Stroke clears it back to None without touching Stroke Width", () => {
    useEditorStore.setState((state) => ({
      document: { ...state.document, children: [{ id: "a", tag: "svg", svgStroke: "#000000", svgStrokeWidth: 4 }] },
    }));
    render(<InspectorSvgSection node={{ id: "a", tag: "svg", svgStroke: "#000000", svgStrokeWidth: 4 }} protection={unprotected} />);

    fireEvent.click(screen.getByRole("button", { name: "Reset stroke" }));

    expect(useEditorStore.getState().document.children![0].svgStroke).toBeUndefined();
    expect(useEditorStore.getState().document.children![0].svgStrokeWidth).toBe(4);
  });

  it("Fill/Stroke/Stroke Width are inert for a protected node, but Primitive and ViewBox stay interactive", () => {
    useEditorStore.setState((state) => ({
      document: {
        ...state.document,
        children: [
          { id: "hero", tag: "div", htmlId: "hero", lockChildStyles: true, children: [{ id: "svg1", tag: "svg" }] },
        ],
      },
    }));
    const protection = getStyleProtection(useEditorStore.getState().document, "svg1");
    expect(protection.protected).toBe(true);

    render(<InspectorSvgSection node={{ id: "svg1", tag: "svg" }} protection={protection} />);

    const fillField = screen.getByRole("textbox", { name: "Fill" });
    expect(fillField.closest("[inert]")).not.toBeNull();

    // Primitive is NOT inside the protected group.
    expect(screen.getByRole("button", { name: "Circle" }).closest("[inert]")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Star" }));
    expect(useEditorStore.getState().document.children![0].children![0].svgKind).toBe("star");
  });

  it("shows the helper copy explaining Primitive/ViewBox stay editable under protection", () => {
    render(<InspectorSvgSection node={{ id: "a", tag: "svg" }} protection={unprotected} />);
    expect(
      screen.getByText("Primitive and ViewBox are vector content, so they stay editable even when child styles are locked."),
    ).toBeInTheDocument();
  });
});
