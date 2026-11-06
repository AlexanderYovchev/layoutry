import { describe, expect, it } from "vitest";
import { createCollapsibleNode, createModalNode } from "@/features/editor/factories/interactionCompositions";
import { createDropdownButtonNode } from "@/features/editor/factories/buttonCompositions";
import type { EditorElementNode } from "@/features/editor/types/document";
import { buildExportDocument } from "@/features/export/utils/buildExportDocument";
import { isUsableAuthoredId, resolveInteractionTargets } from "./interactionTargets";

const page = (children: EditorElementNode[]): EditorElementNode => ({ id: "page-root", tag: "page", children });
const toggle = (id: string, targetId: string): EditorElementNode => ({ id, tag: "button", text: id, interactions: [{ id: `i-${id}`, trigger: "click", action: "toggle", targetId }] });

describe("resolveInteractionTargets (BC-02.5.1)", () => {
  it("numbers targets in document order and generates ly-target ids for those without a usable authored id", () => {
    const targets = resolveInteractionTargets(page([toggle("b-1", "panel-2"), toggle("b-2", "panel-1"), { id: "panel-1", tag: "div" }, { id: "panel-2", tag: "div", htmlId: "details" }]));
    expect(targets.map(({ nodeId, token, domId, generatedDomId }) => ({ nodeId, token, domId, generatedDomId }))).toEqual([
      { nodeId: "panel-1", token: 1, domId: "ly-target-1", generatedDomId: true },
      { nodeId: "panel-2", token: 2, domId: "details", generatedDomId: false },
    ]);
  });

  it("never references a duplicated authored id, and never reuses an authored id with the reserved prefix", () => {
    const targets = resolveInteractionTargets(page([toggle("b-1", "a"), toggle("b-2", "b"), toggle("b-3", "c"), { id: "a", tag: "div", htmlId: "same" }, { id: "b", tag: "div", htmlId: "same" }, { id: "c", tag: "div", htmlId: "ly-target-1" }]));
    expect(targets.find((target) => target.nodeId === "a")?.domId).toBeUndefined();
    expect(targets.find((target) => target.nodeId === "b")?.domId).toBeUndefined();
    expect(targets.find((target) => target.nodeId === "c")).toMatchObject({ domId: "ly-target-3", generatedDomId: true });
    expect(isUsableAuthoredId("ly-target-1")).toBe(false);
    expect(isUsableAuthoredId("has space")).toBe(false);
    expect(isUsableAuthoredId("ok-id")).toBe(true);
  });

  it("ids are unique and stable for several and nested instances", () => {
    const outer = createCollapsibleNode();
    const inner = createCollapsibleNode();
    const content = outer.children?.find((child) => child.id === outer.children?.[0]?.interactions?.[0]?.targetId);
    if (content) content.children = [...(content.children ?? []), inner];
    const document = page([createDropdownButtonNode(), createDropdownButtonNode(), outer, createModalNode()]);
    const first = resolveInteractionTargets(document);
    const ids = first.map((target) => target.domId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id !== undefined)).toBe(true);
    expect(resolveInteractionTargets(document)).toEqual(first);
  });

  it("is exactly what the export uses for its targets", () => {
    const document = page([createDropdownButtonNode(), createCollapsibleNode(), createModalNode()]);
    const built = buildExportDocument(document);
    if (!built.ok) throw new Error("unbuildable");
    expect(built.document.behaviors.targets).toEqual(resolveInteractionTargets(document));
  });
});
