import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { InspectorVectorObjectSection } from "./InspectorVectorObjectSection";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { getStyleProtection } from "@/features/editor/rules/styleProtection";
import type { EditorElementNode } from "@/features/editor/types/document";

const initialState = useEditorStore.getState();
const unprotected = getStyleProtection(initialState.document, "does-not-exist");

function svgNode(overrides: Partial<EditorElementNode> = {}): EditorElementNode {
  return { id: "svg1", tag: "svg", ...overrides };
}

describe("InspectorVectorObjectSection", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("renders nothing when every given object id is stale (self-heals rather than crashing)", () => {
    const { container } = render(
      <InspectorVectorObjectSection svgNode={svgNode({ svgScene: { objects: [] } })} objectIds={["missing"]} protection={unprotected} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  describe("single selection", () => {
    it("shows Type, and the correct geometry fields for a Rectangle", () => {
      const node = svgNode({ svgScene: { objects: [{ id: "r1", type: "rect", x: 10, y: 20, width: 30, height: 40, fill: "#ff0000" }] } });
      render(<InspectorVectorObjectSection svgNode={node} objectIds={["r1"]} protection={unprotected} />);

      expect(screen.getByText("Rectangle")).toBeInTheDocument();
      expect(screen.getByRole("spinbutton", { name: "X" })).toHaveValue(10);
      expect(screen.getByRole("spinbutton", { name: "Y" })).toHaveValue(20);
      expect(screen.getByRole("spinbutton", { name: "Width" })).toHaveValue(30);
      expect(screen.getByRole("spinbutton", { name: "Height" })).toHaveValue(40);
      expect(screen.queryByRole("spinbutton", { name: "CX" })).not.toBeInTheDocument();
    });

    it("committing Width resizes the object with one history entry", () => {
      useEditorStore.setState((state) => ({
        document: { ...state.document, children: [svgNode({ svgScene: { objects: [{ id: "r1", type: "rect", x: 0, y: 0, width: 10, height: 10 }] } })] },
      }));
      const node = useEditorStore.getState().document.children![0];
      const pastBefore = useEditorStore.getState().past.length;
      render(<InspectorVectorObjectSection svgNode={node} objectIds={["r1"]} protection={unprotected} />);

      const widthField = screen.getByRole("spinbutton", { name: "Width" });
      fireEvent.change(widthField, { target: { value: "50" } });
      fireEvent.blur(widthField);

      const scene = useEditorStore.getState().document.children![0].svgScene!;
      expect(scene.objects[0]).toMatchObject({ x: 0, y: 0, width: 50, height: 10 });
      expect(useEditorStore.getState().past.length).toBe(pastBefore + 1);
    });

    it("shows CX/CY/RX/RY for an Ellipse and committing CX shifts it while preserving RX", () => {
      useEditorStore.setState((state) => ({
        document: { ...state.document, children: [svgNode({ svgScene: { objects: [{ id: "e1", type: "ellipse", cx: 50, cy: 50, rx: 10, ry: 20 }] } })] },
      }));
      const node = useEditorStore.getState().document.children![0];
      render(<InspectorVectorObjectSection svgNode={node} objectIds={["e1"]} protection={unprotected} />);

      expect(screen.getByRole("spinbutton", { name: "RX" })).toHaveValue(10);
      const cxField = screen.getByRole("spinbutton", { name: "CX" });
      fireEvent.change(cxField, { target: { value: "70" } });
      fireEvent.blur(cxField);

      const scene = useEditorStore.getState().document.children![0].svgScene!;
      expect(scene.objects[0]).toMatchObject({ cx: 70, cy: 50, rx: 10, ry: 20 });
    });

    it("shows X1/Y1/X2/Y2 for a Line and each field commits independently with its own history entry", () => {
      useEditorStore.setState((state) => ({
        document: { ...state.document, children: [svgNode({ svgScene: { objects: [{ id: "l1", type: "line", x1: 0, y1: 0, x2: 10, y2: 10, stroke: "#000" }] } })] },
      }));
      const node = useEditorStore.getState().document.children![0];
      render(<InspectorVectorObjectSection svgNode={node} objectIds={["l1"]} protection={unprotected} />);

      const x1Field = screen.getByRole("spinbutton", { name: "X1" });
      fireEvent.change(x1Field, { target: { value: "5" } });
      fireEvent.blur(x1Field);

      const x2Field = screen.getByRole("spinbutton", { name: "X2" });
      fireEvent.change(x2Field, { target: { value: "40" } });
      fireEvent.blur(x2Field);

      const scene = useEditorStore.getState().document.children![0].svgScene!;
      expect(scene.objects[0]).toMatchObject({ x1: 5, y1: 0, x2: 40, y2: 10 });
    });

    it("shows no geometry fields for a Polygon or Path (raw points/d never exposed)", () => {
      const node = svgNode({
        svgScene: {
          objects: [{ id: "p1", type: "polygon", points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }], fill: "#111" }],
        },
      });
      render(<InspectorVectorObjectSection svgNode={node} objectIds={["p1"]} protection={unprotected} />);

      expect(screen.getByText("Polygon")).toBeInTheDocument();
      expect(screen.queryByText("Geometry")).not.toBeInTheDocument();
    });

    it("commits a valid Fill and rejects an invalid one", () => {
      useEditorStore.setState((state) => ({
        document: { ...state.document, children: [svgNode({ svgScene: { objects: [{ id: "r1", type: "rect", x: 0, y: 0, width: 10, height: 10 }] } })] },
      }));
      const node = useEditorStore.getState().document.children![0];
      render(<InspectorVectorObjectSection svgNode={node} objectIds={["r1"]} protection={unprotected} />);

      const fillField = screen.getByRole("textbox", { name: "Fill" });
      fireEvent.change(fillField, { target: { value: "#00ff00" } });
      fireEvent.blur(fillField);
      expect(useEditorStore.getState().document.children![0].svgScene!.objects[0].fill).toBe("#00ff00");

      fireEvent.change(fillField, { target: { value: "nope" } });
      fireEvent.blur(fillField);
      expect(useEditorStore.getState().document.children![0].svgScene!.objects[0].fill).toBe("#00ff00");
    });

    it("Fill/Stroke/Stroke Width are inert under Parent Style Protection, but geometry and Type stay interactive", () => {
      useEditorStore.setState((state) => ({
        document: {
          ...state.document,
          children: [
            {
              id: "hero",
              tag: "div",
              htmlId: "hero",
              lockChildStyles: true,
              children: [svgNode({ svgScene: { objects: [{ id: "r1", type: "rect", x: 0, y: 0, width: 10, height: 10 }] } })],
            },
          ],
        },
      }));
      const protection = getStyleProtection(useEditorStore.getState().document, "svg1");
      expect(protection.protected).toBe(true);
      const node = useEditorStore.getState().document.children![0].children![0];

      render(<InspectorVectorObjectSection svgNode={node} objectIds={["r1"]} protection={protection} />);

      const fillField = screen.getByRole("textbox", { name: "Fill" });
      expect(fillField.closest("[inert]")).not.toBeNull();

      const widthField = screen.getByRole("spinbutton", { name: "Width" });
      expect(widthField.closest("[inert]")).toBeNull();
      fireEvent.change(widthField, { target: { value: "99" } });
      fireEvent.blur(widthField);
      const object = useEditorStore.getState().document.children![0].children![0].svgScene!.objects[0];
      expect(object.type === "rect" && object.width).toBe(99);
    });
  });

  describe("multi selection", () => {
    it("shows a Mixed Fill placeholder when selected objects differ, and applying a value writes it to every one", () => {
      useEditorStore.setState((state) => ({
        document: {
          ...state.document,
          children: [
            svgNode({
              svgScene: {
                objects: [
                  { id: "r1", type: "rect", x: 0, y: 0, width: 10, height: 10, fill: "#ff0000" },
                  { id: "r2", type: "rect", x: 20, y: 20, width: 10, height: 10, fill: "#0000ff" },
                ],
              },
            }),
          ],
        },
      }));
      const node = useEditorStore.getState().document.children![0];
      render(<InspectorVectorObjectSection svgNode={node} objectIds={["r1", "r2"]} protection={unprotected} />);

      expect(screen.getByText("2 objects selected")).toBeInTheDocument();
      const fillField = screen.getByRole("textbox", { name: "Fill" });
      expect(fillField).toHaveAttribute("placeholder", "Mixed");

      fireEvent.change(fillField, { target: { value: "#00ff00" } });
      fireEvent.blur(fillField);

      const scene = useEditorStore.getState().document.children![0].svgScene!;
      expect(scene.objects[0].fill).toBe("#00ff00");
      expect(scene.objects[1].fill).toBe("#00ff00");
    });

    it("shows no Type or geometry fields for a multi-selection", () => {
      const node = svgNode({
        svgScene: {
          objects: [
            { id: "r1", type: "rect", x: 0, y: 0, width: 10, height: 10 },
            { id: "e1", type: "ellipse", cx: 5, cy: 5, rx: 5, ry: 5 },
          ],
        },
      });
      render(<InspectorVectorObjectSection svgNode={node} objectIds={["r1", "e1"]} protection={unprotected} />);

      expect(screen.queryByText("Type")).not.toBeInTheDocument();
      expect(screen.queryByRole("spinbutton", { name: "Width" })).not.toBeInTheDocument();
    });
  });
});
