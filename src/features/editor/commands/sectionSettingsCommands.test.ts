import { describe, expect, it } from "vitest";
import { applySectionSettings } from "./sectionSettingsCommands";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { GradientSettings } from "@/features/editor/types/gradient";
import { findNodeById } from "@/features/editor/utils/findNodeById";

/** BC-10.4 — a section's settings fanned out to several elements, through each single-element command. */

function root(): EditorElementNode {
  return {
    id: "page-root",
    tag: "page",
    children: [
      {
        id: "parent",
        tag: "section",
        background: { color: "#111111", sourceType: "image", image: "https://example.com/a.png" },
        children: [{ id: "child", tag: "p", text: "Child", background: { color: "#222222" } }],
      },
      { id: "other", tag: "p", text: "Other" },
      {
        id: "grid",
        tag: "div",
        flowLayout: { display: "grid", grid: { columns: 2, rows: 1, columnGap: 0, rowGap: 0 } },
        children: [{ id: "cell", tag: "p", text: "Cell" }],
      },
    ],
  };
}
const node = (document: EditorElementNode, id: string) => findNodeById(document, id)!;

describe("applySectionSettings (BC-10.4)", () => {
  it("writes the same settings to every element once, a selected parent and its child included", () => {
    const next = applySectionSettings(root(), ["parent", "child", "other", "child"], "typography", { color: "#ff0000" });
    for (const id of ["parent", "child", "other"]) expect(node(next, id).typography).toEqual({ color: "#ff0000" });
    // Nothing else on them changed.
    expect(node(next, "parent").background).toEqual(node(root(), "parent").background);
  });

  it("returns the same root when nothing changes", () => {
    const document = root();
    expect(applySectionSettings(document, ["other"], "typography", undefined)).toBe(document);
  });

  it("backgroundSource replaces image/gradient everywhere but keeps each element's own colour", () => {
    const gradient: GradientSettings = { type: "linear", angle: 90, stops: [{ id: "s1", color: "#000000", position: 0 }, { id: "s2", color: "#ffffff", position: 100 }] };
    // The given colour is ignored: each element keeps its own.
    const next = applySectionSettings(root(), ["parent", "child"], "backgroundSource", { color: "#999999", sourceType: "gradient", gradient });
    expect(node(next, "parent").background).toEqual({ color: "#111111", sourceType: "gradient", gradient });
    expect(node(next, "child").background).toEqual({ color: "#222222", sourceType: "gradient", gradient });
    const removed = applySectionSettings(next, ["parent", "child"], "backgroundSource", undefined);
    expect(node(removed, "parent").background).toEqual({ color: "#111111" });
    expect(node(removed, "child").background).toEqual({ color: "#222222" });
  });

  it("a grid placement is clamped to each element's own grid, as for one element", () => {
    const next = applySectionSettings(root(), ["cell"], "gridChild", { columnStart: 9, columnSpan: 5, rowStart: "auto", rowSpan: 1 });
    const placement = node(next, "cell").gridChild;
    // A 2-column grid: the start and span are brought inside it.
    expect(placement?.columnStart).not.toBe(9);
    expect(placement?.columnSpan).toBeLessThanOrEqual(2);
  });
});
