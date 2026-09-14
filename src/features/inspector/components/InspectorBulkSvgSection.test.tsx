import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { InspectorBulkSvgSection } from "./InspectorBulkSvgSection";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { getStyleProtection } from "@/features/editor/rules/styleProtection";

const initialState = useEditorStore.getState();
const unprotected = [
  getStyleProtection(initialState.document, "a"),
  getStyleProtection(initialState.document, "b"),
];

describe("InspectorBulkSvgSection", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("shows the shared Primitive as pressed when every node agrees", () => {
    render(
      <InspectorBulkSvgSection
        nodes={[
          { id: "a", tag: "svg", svgKind: "circle" },
          { id: "b", tag: "svg", svgKind: "circle" },
        ]}
        protections={unprotected}
      />,
    );
    expect(screen.getByRole("button", { name: "Circle" })).toHaveAttribute("aria-pressed", "true");
  });

  it("marks no Primitive as pressed when the selection has mixed kinds", () => {
    render(
      <InspectorBulkSvgSection
        nodes={[
          { id: "a", tag: "svg", svgKind: "circle" },
          { id: "b", tag: "svg", svgKind: "star" },
        ]}
        protections={unprotected}
      />,
    );
    const primitiveGroup = screen.getByRole("group", { name: "Primitive" });
    for (const button of within(primitiveGroup).getAllByRole("button")) {
      expect(button).toHaveAttribute("aria-pressed", "false");
    }
  });

  it("selecting a Primitive applies it to every selected node in one history entry", () => {
    useEditorStore.setState((state) => ({
      document: {
        ...state.document,
        children: [
          { id: "a", tag: "svg", svgKind: "circle" as const },
          { id: "b", tag: "svg", svgKind: "star" as const },
        ],
      },
    }));
    const pastBefore = useEditorStore.getState().past.length;
    render(
      <InspectorBulkSvgSection
        nodes={[
          { id: "a", tag: "svg", svgKind: "circle" },
          { id: "b", tag: "svg", svgKind: "star" },
        ]}
        protections={unprotected}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Triangle" }));

    const children = useEditorStore.getState().document.children!;
    expect(children[0].svgKind).toBe("triangle");
    expect(children[1].svgKind).toBe("triangle");
    expect(useEditorStore.getState().past.length).toBe(pastBefore + 1);
  });

  it("bulk Fill blocks the entire mutation atomically when one target is protected", () => {
    useEditorStore.setState((state) => ({
      document: {
        ...state.document,
        children: [
          { id: "free1", tag: "svg" },
          { id: "hero", tag: "div", htmlId: "hero", lockChildStyles: true, children: [{ id: "locked1", tag: "svg" }] },
        ],
      },
    }));
    const documentModel = useEditorStore.getState().document;
    const protections = [getStyleProtection(documentModel, "free1"), getStyleProtection(documentModel, "locked1")];

    render(
      <InspectorBulkSvgSection nodes={[{ id: "free1", tag: "svg" }, { id: "locked1", tag: "svg" }]} protections={protections} />,
    );

    const fillField = screen.getByRole("textbox", { name: "Fill" });
    fireEvent.change(fillField, { target: { value: "#00ff00" } });
    fireEvent.blur(fillField);

    const after = useEditorStore.getState().document;
    expect(after.children![0].svgFill).toBeUndefined();
    expect(after.children![1].children![0].svgFill).toBeUndefined();
  });

  it("Primitive stays interactive even when the selection includes a protected node", () => {
    useEditorStore.setState((state) => ({
      document: {
        ...state.document,
        children: [
          { id: "free1", tag: "svg" },
          { id: "hero", tag: "div", lockChildStyles: true, children: [{ id: "locked1", tag: "svg" }] },
        ],
      },
    }));
    const documentModel = useEditorStore.getState().document;
    const protections = [getStyleProtection(documentModel, "free1"), getStyleProtection(documentModel, "locked1")];

    render(
      <InspectorBulkSvgSection nodes={[{ id: "free1", tag: "svg" }, { id: "locked1", tag: "svg" }]} protections={protections} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Star" }));

    const after = useEditorStore.getState().document;
    expect(after.children![0].svgKind).toBe("star");
    expect(after.children![1].children![0].svgKind).toBe("star");
  });
});
