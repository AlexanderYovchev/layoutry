import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { ShadowLayer } from "@/features/editor/types/boxShadow";
import type { EditorElementNode } from "@/features/editor/types/document";
import { createSelection } from "@/features/editor/types/selection";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { exportHtmlCss } from "@/features/export/utils/exportHtmlCss";
import { InspectorContent } from "./InspectorContent";

/**
 * BC-10.4 — the multi-selection Inspector: the real single-selection
 * sections when the selected elements agree (fanned out to all), the
 * complete bulk sections with per-field Reset when they differ, and the
 * explicit Mixed panels for list/configuration sections.
 */

const initialState = useEditorStore.getState();
const store = () => useEditorStore.getState();
const node = (id: string) => findNodeById(store().document, id)!;
/** A section header (a disclosure button), not a same-named option elsewhere (e.g. Transition's "Box Shadow" property). */
const section = (name: string) => {
  const header = screen.getAllByRole("button", { name }).find((button) => button.hasAttribute("aria-expanded"));
  if (!header) throw new Error(`no section ${name}`);
  return header;
};
/** Segmented options are toggle buttons (aria-pressed). */
const option = (name: string) => screen.getAllByRole("button", { name }).find((button) => button.hasAttribute("aria-pressed"))!;

function show(children: EditorElementNode[], ids: string[]) {
  useEditorStore.setState(initialState, true);
  store().replaceDocument({ id: "page-root", tag: "page", children });
  useEditorStore.setState({ selection: createSelection(ids, ids[ids.length - 1]) });
  return render(<InspectorContent />);
}

function openSection(name: string) {
  const header = section(name);
  if (header.getAttribute("aria-expanded") !== "true") fireEvent.click(header);
}

const flex = { direction: "row", wrap: "nowrap", justifyContent: "start", alignItems: "start", rowGap: 0, columnGap: 0 } as const;

describe("shared CSS controls (BC-10.4)", () => {
  beforeEach(() => {
    useEditorStore.setState(initialState, true);
  });
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("two paragraphs that agree get the full single-selection Typography; one edit sets both, one Undo step", () => {
    show([{ id: "a", tag: "p", text: "A" }, { id: "b", tag: "p", text: "B" }], ["a", "b"]);
    openSection("Typography");
    // The single-selection section's own unit controls are there (bulk fields are px only).
    expect(screen.getAllByRole("combobox").length).toBeGreaterThan(0);
    fireEvent.click(option("Italic"));
    expect([node("a").typography?.fontStyle, node("b").typography?.fontStyle]).toEqual(["italic", "italic"]);
    expect(store().past).toHaveLength(1);
    act(() => store().undo());
    expect([node("a").typography, node("b").typography]).toEqual([undefined, undefined]);
  });

  it("a heading and a paragraph get the complete bulk Typography, with a Reset per field that clears it on all", () => {
    show(
      [
        { id: "h", tag: "h1", text: "H", typography: { lineHeight: { value: 30, unit: "px" } } },
        { id: "p", tag: "p", text: "P", typography: { lineHeight: { value: 20, unit: "px" }, fontStyle: "italic" } },
      ],
      ["h", "p"],
    );
    openSection("Typography");
    for (const field of ["Font family", "Font size", "Line height", "Letter spacing", "Text color"]) {
      expect(screen.getByRole(field === "Font family" || field === "Text color" ? "textbox" : "spinbutton", { name: field })).toBeInTheDocument();
    }
    // Mixed line heights can still be reset; afterwards each element shows its own default (they may stay Mixed).
    fireEvent.click(screen.getByRole("button", { name: "Reset line height on all selected elements" }));
    expect([node("h").typography?.lineHeight, node("p").typography?.lineHeight]).toEqual([undefined, undefined]);
    // Only that field: the paragraph's italic stays.
    expect(node("p").typography?.fontStyle).toBe("italic");
    expect(store().past).toHaveLength(1);
  });

  it("box shadows that differ show an explicit Mixed panel; adopting the primary's makes them editable together", () => {
    const px = (value: number) => ({ value, unit: "px" as const });
    const shadow = (id: string, x: number): ShadowLayer[] => [{ id, enabled: true, inset: false, offsetX: px(x), offsetY: px(2), blur: px(4), spread: px(0), color: "rgba(0, 0, 0, 0.2)" }];
    show(
      [
        { id: "b1", tag: "button", text: "One", boxShadow: shadow("l1", 1) },
        { id: "b2", tag: "button", text: "Two", boxShadow: shadow("l2", 8) },
      ],
      ["b1", "b2"],
    );
    openSection("Box Shadow");
    expect(screen.getByText("Mixed.")).toBeInTheDocument();
    // Nothing changes until a choice is made.
    expect(store().past).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: /^Use .*'s shadows on all$/ }));
    expect(node("b1").boxShadow).toEqual(node("b2").boxShadow);
    expect(node("b1").boxShadow?.[0].offsetX).toEqual({ value: 8, unit: "px" });
    expect(store().past).toHaveLength(1);
    // Now uniform: the real Box Shadow editor (its layer list) is shown.
    expect(screen.queryByText("Mixed.")).toBeNull();
  });

  it("'Remove all shadows' clears every element's shadows in one step", () => {
    show(
      [
        { id: "b1", tag: "button", text: "One", boxShadow: [{ id: "l1", enabled: true, inset: false, offsetX: { value: 1, unit: "px" }, color: "#000000" }] },
        { id: "b2", tag: "button", text: "Two" },
      ],
      ["b1", "b2"],
    );
    openSection("Box Shadow");
    fireEvent.click(screen.getByRole("button", { name: "Remove all shadows" }));
    expect([node("b1").boxShadow, node("b2").boxShadow]).toEqual([undefined, undefined]);
    expect(store().past).toHaveLength(1);
  });

  it("two Flex containers that agree get the real Content Layout section; Flow/Free switching is held back", () => {
    show(
      [
        { id: "c1", tag: "div", flowLayout: { display: "flex", flex } },
        { id: "c2", tag: "div", flowLayout: { display: "flex", flex } },
      ],
      ["c1", "c2"],
    );
    openSection("Content Layout");
    expect(screen.getByText("Switch between Flow and Free one container at a time.")).toBeInTheDocument();
    const before = store().document;
    fireEvent.click(option("Free"));
    expect(store().document).toBe(before);
  });

  it("differently laid out containers: a Mixed panel, and adopting the primary's layout is one Undo step that never changes display silently", () => {
    show(
      [
        { id: "c1", tag: "div", flowLayout: { display: "flex", flex } },
        { id: "c2", tag: "div", flowLayout: { display: "grid", grid: { columns: 2, rows: "auto", rowGap: 4, columnGap: 4 } } },
      ],
      ["c1", "c2"],
    );
    openSection("Content Layout");
    expect(node("c1").flowLayout?.display).toBe("flex");
    fireEvent.click(screen.getByRole("button", { name: /^Use .*'s layout on all$/ }));
    expect([node("c1").flowLayout?.display, node("c2").flowLayout?.display]).toEqual(["grid", "grid"]);
    expect(node("c1").flowLayout?.grid).toEqual(node("c2").flowLayout?.grid);
    expect(store().past).toHaveLength(1);
  });

  it("Flex children in the same row get the real Flex Child section; in different containers, a Mixed panel", () => {
    show(
      [
        { id: "row", tag: "div", flowLayout: { display: "flex", flex }, children: [{ id: "x", tag: "p", text: "X" }, { id: "y", tag: "p", text: "Y", flexChild: { grow: 1, shrink: 1, basis: "auto", alignSelf: "center" } }] },
      ],
      ["x", "y"],
    );
    openSection("Flex Child");
    fireEvent.click(screen.getByRole("button", { name: /^Use .*'s Flex child settings on all$/ }));
    expect(node("x").flexChild).toEqual(node("y").flexChild);
  });

  it("background images/gradients that differ: adopt the primary's on all, keeping each element's colour", () => {
    const gradient = { type: "linear" as const, angle: 45, stops: [{ id: "s1", color: "#000000", position: 0 }, { id: "s2", color: "#ffffff", position: 100 }] };
    show(
      [
        { id: "d1", tag: "div", background: { color: "#ff0000" } },
        { id: "d2", tag: "div", background: { color: "#00ff00", sourceType: "gradient", gradient } },
      ],
      ["d1", "d2"],
    );
    fireEvent.click(screen.getByRole("button", { name: /^Use .*'s image\/gradient on all$/ }));
    expect(node("d1").background).toEqual({ color: "#ff0000", sourceType: "gradient", gradient });
    expect(node("d2").background).toEqual({ color: "#00ff00", sourceType: "gradient", gradient });
    expect(store().past).toHaveLength(1);
  });

  it("all-or-nothing: with one element under a style lock, a fanned-out edit changes nothing", () => {
    show(
      [
        { id: "locked", tag: "div", lockChildStyles: true, children: [{ id: "a", tag: "p", text: "A" }] },
        { id: "b", tag: "p", text: "B" },
      ],
      ["a", "b"],
    );
    const before = store().document;
    act(() => store().setElementsSettings(["a", "b"], "typography", { color: "#ff0000" }));
    expect(store().document).toBe(before);
    expect(store().past).toHaveLength(0);
    expect(store().editorNotice).not.toBeNull();
  });

  it("a live gesture (e.g. a slider) is one Undo step once committed", () => {
    show([{ id: "a", tag: "p", text: "A" }, { id: "b", tag: "p", text: "B" }], ["a", "b"]);
    act(() => {
      store().beginTransaction();
      store().setElementsSettings(["a", "b"], "filters", { opacity: 0.9 }, { live: true });
      store().setElementsSettings(["a", "b"], "filters", { opacity: 0.5 }, { live: true });
      store().commitTransaction();
    });
    expect([node("a").filters, node("b").filters]).toEqual([{ opacity: 0.5 }, { opacity: 0.5 }]);
    expect(store().past).toHaveLength(1);
    act(() => store().undo());
    expect([node("a").filters, node("b").filters]).toEqual([undefined, undefined]);
  });

  it("two Grid containers that agree: one Columns choice changes both grids, never their display; Undo then Redo", () => {
    const grid = { columns: 2, rows: "auto", rowGap: 4, columnGap: 4 } as const;
    show(
      [
        { id: "g1", tag: "div", flowLayout: { display: "grid", grid } },
        { id: "g2", tag: "div", flowLayout: { display: "grid", grid } },
      ],
      ["g1", "g2"],
    );
    openSection("Content Layout");
    fireEvent.click(option("3"));
    expect([node("g1").flowLayout?.grid?.columns, node("g2").flowLayout?.grid?.columns]).toEqual([3, 3]);
    expect([node("g1").flowLayout?.display, node("g2").flowLayout?.display]).toEqual(["grid", "grid"]);
    expect(store().past).toHaveLength(1);
    act(() => store().undo());
    expect([node("g1").flowLayout?.grid?.columns, node("g2").flowLayout?.grid?.columns]).toEqual([2, 2]);
    act(() => store().redo());
    expect([node("g1").flowLayout?.grid?.columns, node("g2").flowLayout?.grid?.columns]).toEqual([3, 3]);
  });

  it("a large selection (40 paragraphs) has no cap: one edit, all 40, one Undo step", () => {
    const ids = Array.from({ length: 40 }, (_, index) => `p${index}`);
    show(ids.map((id) => ({ id, tag: "p", text: id })), ids);
    openSection("Typography");
    fireEvent.click(option("Italic"));
    expect(ids.every((id) => node(id).typography?.fontStyle === "italic")).toBe(true);
    expect(store().past).toHaveLength(1);
  });

  it("a selection change during a live gesture still ends as one Undo step for the original targets", () => {
    show([{ id: "a", tag: "p", text: "A" }, { id: "b", tag: "p", text: "B" }, { id: "c", tag: "p", text: "C" }], ["a", "b"]);
    act(() => {
      store().beginTransaction();
      store().setElementsSettings(["a", "b"], "filters", { opacity: 0.4 }, { live: true });
      useEditorStore.setState({ selection: createSelection(["c"], "c") });
      store().commitTransaction();
    });
    expect([node("a").filters, node("b").filters, node("c").filters]).toEqual([{ opacity: 0.4 }, { opacity: 0.4 }, undefined]);
    expect(store().past).toHaveLength(1);
  });

  it("a shared edit is ordinary authored CSS: the export carries it for every element", () => {
    const shadow: ShadowLayer[] = [{ id: "l", enabled: true, inset: false, offsetX: { value: 3, unit: "px" }, offsetY: { value: 3, unit: "px" }, blur: { value: 0, unit: "px" }, spread: { value: 0, unit: "px" }, color: "#ff0000" }];
    show([{ id: "b1", tag: "button", text: "One" }, { id: "b2", tag: "button", text: "Two" }], ["b1", "b2"]);
    act(() => store().setElementsSettings(["b1", "b2"], "boxShadow", shadow));
    const css = exportHtmlCss(store().document, { mode: "separate", title: "x" }).files.find((file) => file.path.endsWith(".css"))?.content ?? "";
    // One rule per element (.ly-node-2, .ly-node-3), both with the shared shadow.
    expect(css.match(/box-shadow: 3px 3px 0px 0px #ff0000;/g)).toHaveLength(2);
    // No selection metadata leaks into the export.
    expect(css).not.toMatch(/selected|primary/i);
  });

  it("Spacing differing: bulk Reset clears the box on every element in one step", () => {
    show(
      [
        { id: "a", tag: "p", text: "A", spacing: { padding: { top: 4, right: 4, bottom: 4, left: 4 } } },
        { id: "b", tag: "h2", text: "B", spacing: { padding: { top: 8 } } },
      ],
      ["a", "b"],
    );
    const spacing = screen.getAllByRole("button", { name: "Reset padding on all selected elements" })[0];
    fireEvent.click(spacing);
    expect([node("a").spacing?.padding, node("b").spacing?.padding]).toEqual([undefined, undefined]);
    expect(store().past).toHaveLength(1);
  });
});
