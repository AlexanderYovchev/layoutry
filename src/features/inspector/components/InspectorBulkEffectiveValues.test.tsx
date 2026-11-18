import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { InspectorBulkBackgroundSection } from "./InspectorBulkBackgroundSection";
import { InspectorBulkBorderRadiusSection } from "./InspectorBulkBorderRadiusSection";
import { InspectorBulkBorderSection } from "./InspectorBulkBorderSection";
import { InspectorBulkDisplaySection } from "./InspectorBulkDisplaySection";
import { InspectorBulkTypographySection } from "./InspectorBulkTypographySection";

/**
 * BC-10.3 — the multi-selection sections compare EFFECTIVE values, read
 * from the rendered Canvas elements. jsdom has no stylesheet cascade, so a
 * stand-in Canvas gives each element its "rendered" values as inline
 * styles (what Chromium computes from the real recipes is covered by
 * e2e/multi-selection-effective-values.spec.ts).
 */

const initialState = useEditorStore.getState();
const store = () => useEditorStore.getState();

/** "font-size: 32px; color: red" → { fontSize: "32px", color: "red" }. */
function toReactStyle(css: string): Record<string, string> {
  const entries = css
    .split(";")
    .filter((rule) => rule.trim() !== "")
    .map((rule): [string, string] => {
      const [key = "", value = ""] = rule.split(":");
      return [key.trim().replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase()), value.trim()];
    });
  return Object.fromEntries(entries);
}

/** A stand-in Canvas: one element per id, with the given computed styles. */
function Canvas({ styles }: { styles: Record<string, string> }) {
  return (
    <div data-document-surface="">
      {Object.entries(styles).map(([id, style]) => (
        <div key={id} data-node-id={id} style={toReactStyle(style)} />
      ))}
    </div>
  );
}

/** jsdom doesn't expand the border-radius shorthand (browsers do), so the stand-in Canvas spells the corners out. */
const CORNERS = (all: string, topRight = all) =>
  `border-top-left-radius: ${all}; border-top-right-radius: ${topRight}; border-bottom-right-radius: ${all}; border-bottom-left-radius: ${all}`;

const h1: EditorElementNode = { id: "h", tag: "h1", text: "Title" };
const p: EditorElementNode = { id: "p", tag: "p", text: "Text" };

const field = (name: string) => screen.getByRole("spinbutton", { name }) as HTMLInputElement;
const text = (name: string) => screen.getByRole("textbox", { name }) as HTMLInputElement;

describe("effective values in the multi-selection sections (BC-10.3)", () => {
  beforeEach(() => {
    useEditorStore.setState(initialState, true);
    store().replaceDocument({ id: "page-root", tag: "page", children: [h1, p] });
  });
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("an unset h1 (32px, bold) and an unset p (16px, regular) read Mixed, not 16", () => {
    render(
      <>
        <Canvas styles={{ h: "font-size: 32px; font-weight: 700; color: rgb(24, 24, 27)", p: "font-size: 16px; font-weight: 400; color: rgb(24, 24, 27)" }} />
        <InspectorBulkTypographySection nodes={[h1, p]} />
      </>,
    );
    expect(field("Font size").value).toBe("");
    expect(field("Font size").placeholder).toBe("Mixed");
    // Same rendered colour, written two ways: one shared value.
    expect(text("Text color").value).toBe("#18181b");
  });

  it("different authored values that render the same are one value", () => {
    const a: EditorElementNode = { ...h1, typography: { fontSize: { value: 2, unit: "rem" } } };
    const b: EditorElementNode = { ...p, typography: { fontSize: { value: 32, unit: "px" } } };
    render(
      <>
        <Canvas styles={{ h: "font-size: 32px", p: "font-size: 32.00px" }} />
        <InspectorBulkTypographySection nodes={[a, b]} />
      </>,
    );
    expect(field("Font size").value).toBe("32");
  });

  it("an element that can't be read is Unknown, never a default; an authored px value needs no reading", () => {
    render(<InspectorBulkTypographySection nodes={[h1, p]} />);
    expect(field("Font size").placeholder).toBe("Unknown");
    expect(field("Font size").title).toMatch(/couldn't be read/);
  });

  it("without a Canvas, authored absolute values still compare", () => {
    const a: EditorElementNode = { ...h1, typography: { fontSize: { value: 20, unit: "px" }, color: "#ff0000" } };
    const b: EditorElementNode = { ...p, typography: { fontSize: { value: 20, unit: "px" }, color: "rgb(255, 0, 0)" } };
    render(<InspectorBulkTypographySection nodes={[a, b]} />);
    expect(field("Font size").value).toBe("20");
    // Equivalent colours: one value, in a canonical form.
    expect(text("Text color").value).toBe("#ff0000");
  });

  it("typing into a Mixed field sets every element, as one Undo step; focusing it changes nothing", () => {
    render(
      <>
        <Canvas styles={{ h: "font-size: 32px", p: "font-size: 16px" }} />
        <InspectorBulkTypographySection nodes={[h1, p]} />
      </>,
    );
    const size = field("Font size");
    fireEvent.focus(size);
    fireEvent.blur(size);
    expect(store().past).toHaveLength(0);
    fireEvent.change(size, { target: { value: "24" } });
    fireEvent.keyDown(size, { key: "Enter" });
    expect(store().past).toHaveLength(1);
    expect(store().document.children?.map((child) => child.typography?.fontSize)).toEqual([
      { value: 24, unit: "px" },
      { value: 24, unit: "px" },
    ]);
  });

  it("radius: all four corners and their units; a shared 50% is shown, not as 50px", () => {
    const { unmount } = render(
      <>
        <Canvas styles={{ h: CORNERS("50%"), p: CORNERS("50%") }} />
        <InspectorBulkBorderRadiusSection nodes={[h1, p]} />
      </>,
    );
    expect(field("Border radius").value).toBe("");
    expect(field("Border radius").placeholder).toBe("50%");
    unmount();
    render(
      <>
        <Canvas styles={{ h: CORNERS("50%"), p: CORNERS("50px") }} />
        <InspectorBulkBorderRadiusSection nodes={[h1, p]} />
      </>,
    );
    expect(field("Border radius").placeholder).toBe("Mixed");
  });

  it("radius: a node whose corners differ reads 'Varies by side'", () => {
    render(
      <>
        <Canvas styles={{ h: CORNERS("6px", "0px"), p: CORNERS("6px", "0px") }} />
        <InspectorBulkBorderRadiusSection nodes={[h1, p]} />
      </>,
    );
    expect(field("Border radius").placeholder).toBe("Varies by side");
  });

  it("border: every side counts, and two borderless elements agree whatever their style", () => {
    const { unmount } = render(
      <>
        <Canvas styles={{ h: "border: 0px solid rgb(0, 0, 0)", p: "border: 0px dashed rgb(255, 0, 0)" }} />
        <InspectorBulkBorderSection nodes={[h1, p]} />
      </>,
    );
    expect(field("Border width").value).toBe("0");
    unmount();
    render(
      <>
        <Canvas styles={{ h: "border: 2px solid rgb(0, 0, 0)", p: "border-width: 2px 2px 2px 0px; border-style: solid; border-color: rgb(0, 0, 0)" }} />
        <InspectorBulkBorderSection nodes={[h1, p]} />
      </>,
    );
    expect(field("Border width").placeholder).toBe("Mixed");
  });

  it("background: a Button's own dark default differs from a transparent paragraph", () => {
    const button: EditorElementNode = { id: "b", tag: "button", text: "Go" };
    render(
      <>
        <Canvas styles={{ b: "background-color: rgb(24, 24, 27)", p: "background-color: rgba(0, 0, 0, 0)" }} />
        <InspectorBulkBackgroundSection nodes={[button, p]} />
      </>,
    );
    expect(text("Background color").placeholder).toBe("Mixed");
  });

  it("display: a shared value the row has no option for is explained, not hidden", () => {
    render(
      <>
        <Canvas styles={{ h: "display: flex; visibility: visible", p: "display: flex; visibility: visible" }} />
        <InspectorBulkDisplaySection nodes={[h1, p]} />
      </>,
    );
    expect(screen.getByText("Every selected element uses flex.")).toBeInTheDocument();
  });
});
