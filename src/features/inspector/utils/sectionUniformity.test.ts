import { describe, expect, it } from "vitest";
import type { EditorElementNode } from "@/features/editor/types/document";
import { isSectionUniform, stableJson } from "./sectionUniformity";

/** BC-10.4 — when the real single-selection editor can edit a whole multi-selection. */

const p = (id: string, extra: Partial<EditorElementNode> = {}): EditorElementNode => ({ id, tag: "p", text: id, ...extra });
const flexParent: EditorElementNode = { id: "row", tag: "div", flowLayout: { display: "flex", flex: { direction: "row", wrap: "nowrap", justifyContent: "start", alignItems: "start", rowGap: 0, columnGap: 0 } } };
const columnParent: EditorElementNode = { id: "column", tag: "div", flowLayout: { display: "flex", flex: { direction: "column", wrap: "nowrap", justifyContent: "start", alignItems: "start", rowGap: 0, columnGap: 0 } } };

describe("isSectionUniform (BC-10.4)", () => {
  it("same tag and identical authored settings (key order and undefined fields don't matter)", () => {
    expect(isSectionUniform("typography", [p("a", { typography: { color: "#f00", fontWeight: 700 } }), p("b", { typography: { fontWeight: 700, color: "#f00" } })], [undefined, undefined])).toBe(true);
    expect(isSectionUniform("typography", [p("a"), p("b")], [undefined, undefined])).toBe(true);
  });

  it("different tags are never uniform: their defaults differ", () => {
    expect(isSectionUniform("typography", [p("a"), { id: "h", tag: "h1", text: "H" }], [undefined, undefined])).toBe(false);
  });

  it("different authored settings are not uniform; other sections' fields don't matter", () => {
    expect(isSectionUniform("typography", [p("a", { typography: { color: "#f00" } }), p("b")], [undefined, undefined])).toBe(false);
    expect(isSectionUniform("typography", [p("a", { background: { color: "#f00" } }), p("b")], [undefined, undefined])).toBe(true);
  });

  it("child sections also need the same parent layout", () => {
    expect(isSectionUniform("flexChild", [p("a"), p("b")], [flexParent, flexParent])).toBe(true);
    expect(isSectionUniform("flexChild", [p("a"), p("b")], [flexParent, columnParent])).toBe(false);
  });

  it("one element is never a fan-out", () => {
    expect(isSectionUniform("typography", [p("a")], [undefined])).toBe(false);
  });

  it("stableJson ignores key order and undefined values", () => {
    expect(stableJson({ b: 1, a: [1, { d: undefined, c: 2 }] })).toBe(stableJson({ a: [1, { c: 2 }], b: 1 }));
  });
});
