import { describe, expect, it } from "vitest";
import { createDropdownButtonNode } from "@/features/editor/factories/buttonCompositions";
import { createDismissibleAlertNode, createManualToastNode, createPopoverNode } from "@/features/editor/factories/feedbackCompositions";
import { createBasicTabsNode, createCollapsibleNode, createDrawerNode, createModalNode } from "@/features/editor/factories/interactionCompositions";
import type { EditorElementNode } from "@/features/editor/types/document";
import { buildExportDocument } from "@/features/export/utils/buildExportDocument";
import { findNodeById } from "./findNodeById";
import { resolveTriggerAccessibility } from "./triggerAccessibility";

const lookup = (root: EditorElementNode) => (nodeId: string) => findNodeById(root, nodeId);

describe("resolveTriggerAccessibility (BC-02.5, B6)", () => {
  const root: EditorElementNode = {
    id: "page-root",
    tag: "page",
    children: [
      { id: "panel", tag: "div" },
      { id: "other", tag: "div" },
      { id: "dlg", tag: "dialog", children: [] },
    ],
  };

  it("a toggle reports the first toggled target", () => {
    const result = resolveTriggerAccessibility(
      [
        { id: "a", trigger: "click", action: "show", targetId: "other" },
        { id: "b", trigger: "click", action: "toggle", targetId: "panel" },
        { id: "c", trigger: "click", action: "toggle", targetId: "other" },
      ],
      lookup(root),
    );
    expect(result).toEqual({ expandsTargetId: "panel", opensDialog: false });
  });

  it("show-only and hide-only triggers report no expanded state", () => {
    expect(resolveTriggerAccessibility([{ id: "a", trigger: "click", action: "show", targetId: "panel" }], lookup(root))).toEqual({ opensDialog: false });
    expect(resolveTriggerAccessibility([{ id: "a", trigger: "click", action: "hide", targetId: "panel" }], lookup(root))).toEqual({ opensDialog: false });
  });

  it("showing or toggling a dialog announces a dialog; hiding one does not", () => {
    expect(resolveTriggerAccessibility([{ id: "a", trigger: "click", action: "show", targetId: "dlg" }], lookup(root)).opensDialog).toBe(true);
    expect(resolveTriggerAccessibility([{ id: "a", trigger: "click", action: "toggle", targetId: "dlg" }], lookup(root))).toEqual({ expandsTargetId: "dlg", opensDialog: true });
    expect(resolveTriggerAccessibility([{ id: "a", trigger: "click", action: "hide", targetId: "dlg" }], lookup(root)).opensDialog).toBe(false);
  });

  it("ignores bindings to nodes that no longer exist, like the executor", () => {
    expect(resolveTriggerAccessibility([{ id: "a", trigger: "click", action: "toggle", targetId: "gone" }], lookup(root))).toEqual({ opensDialog: false });
  });

  it("matches the export's behavior descriptors for every built-in component (no drift between Preview and Export)", () => {
    const document: EditorElementNode = {
      id: "page-root",
      tag: "page",
      children: [createDropdownButtonNode(), createCollapsibleNode(), createPopoverNode(), createDrawerNode(), createModalNode(), createBasicTabsNode(), createManualToastNode(), createDismissibleAlertNode()],
    };
    const built = buildExportDocument(document);
    if (!built.ok) throw new Error("unbuildable");
    const { triggers, targets } = built.document.behaviors;
    const nodeIdByToken = new Map(targets.map((target) => [target.token, target.nodeId]));
    expect(triggers.length).toBeGreaterThanOrEqual(13);
    for (const trigger of triggers) {
      const node = findNodeById(document, trigger.nodeId);
      const result = resolveTriggerAccessibility(node?.interactions ?? [], lookup(document));
      expect(result.expandsTargetId, trigger.nodeId).toBe(trigger.expandsTargetToken === undefined ? undefined : nodeIdByToken.get(trigger.expandsTargetToken));
      expect(result.opensDialog, trigger.nodeId).toBe(trigger.opensDialog);
    }
  });
});
