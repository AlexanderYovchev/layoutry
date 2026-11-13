import { describe, expect, it } from "vitest";
import type { EditorElementNode } from "@/features/editor/types/document";
import { isNodeAuthoredHidden } from "./isNodeAuthoredHidden";

function tree(outer: EditorElementNode["display"], inner: EditorElementNode["display"], leaf?: EditorElementNode["display"]): EditorElementNode {
  return {
    id: "page-root",
    tag: "page",
    children: [{ id: "outer", tag: "section", display: outer, children: [{ id: "inner", tag: "div", display: inner, children: [{ id: "leaf", tag: "iframe", display: leaf }] }] }],
  };
}

describe("isNodeAuthoredHidden (BC-08.3)", () => {
  it("visible by default", () => {
    expect(isNodeAuthoredHidden(tree(undefined, undefined), "leaf")).toBe(false);
  });

  it("Display none on the node or any ancestor hides it", () => {
    expect(isNodeAuthoredHidden(tree(undefined, undefined, { display: "none" }), "leaf")).toBe(true);
    expect(isNodeAuthoredHidden(tree({ display: "none" }, undefined), "leaf")).toBe(true);
    expect(isNodeAuthoredHidden(tree({ display: "none" }, { display: "block" }), "leaf")).toBe(true);
  });

  it("Visibility inherits, and the nearest authored value wins", () => {
    expect(isNodeAuthoredHidden(tree({ visibility: "hidden" }, undefined), "leaf")).toBe(true);
    expect(isNodeAuthoredHidden(tree({ visibility: "hidden" }, { visibility: "visible" }), "leaf")).toBe(false);
    expect(isNodeAuthoredHidden(tree(undefined, { visibility: "visible" }, { visibility: "hidden" }), "leaf")).toBe(true);
  });

  it("undefined for a node that isn't in the document", () => {
    expect(isNodeAuthoredHidden(tree(undefined, undefined), "missing")).toBeUndefined();
  });
});
