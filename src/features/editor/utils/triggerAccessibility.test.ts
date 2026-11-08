import { describe, expect, it } from "vitest";
import { createDropdownButtonNode } from "@/features/editor/factories/buttonCompositions";
import { createDismissibleAlertNode, createManualToastNode, createPopoverNode } from "@/features/editor/factories/feedbackCompositions";
import { createBasicTabsNode, createCollapsibleNode, createDrawerNode, createModalNode } from "@/features/editor/factories/interactionCompositions";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { ExportDiagnostic } from "@/features/export/types/exportDiagnostic";
import { buildExportBehaviors } from "@/features/export/utils/buildExportBehaviors";
import { buildExportDocument } from "@/features/export/utils/buildExportDocument";
import { findNodeById } from "./findNodeById";
import { isKeyboardOperableTrigger, resolveTriggerAccessibility } from "./triggerAccessibility";

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

describe("isKeyboardOperableTrigger (BC-04.2)", () => {
  it("is true only for natively focusable, activatable tags", () => {
    for (const tag of ["button", "a", "input", "select", "textarea"]) expect(isKeyboardOperableTrigger(tag), tag).toBe(true);
    for (const tag of ["h1", "p", "div", "section", "img", "li", "span", "label", "dialog"]) expect(isKeyboardOperableTrigger(tag), tag).toBe(false);
  });

  it("agrees with the export's non-operable-trigger warning, so the Inspector note and the Export dialog can't disagree", () => {
    const tags = ["button", "a", "input", "select", "textarea", "h1", "p", "div", "section", "img", "li"];
    const root: EditorElementNode = {
      id: "page-root",
      tag: "page",
      children: [
        { id: "target", tag: "div" },
        ...tags.map((tag): EditorElementNode => ({ id: `trigger-${tag}`, tag, interactions: [{ id: `int-${tag}`, trigger: "click", action: "toggle", targetId: "target" }] })),
      ],
    };
    const diagnostics: ExportDiagnostic[] = [];
    buildExportBehaviors(root, diagnostics);
    const warned = new Set(diagnostics.filter((diagnostic) => diagnostic.code === "non-operable-trigger").map((diagnostic) => diagnostic.nodeId));
    for (const tag of tags) expect(warned.has(`trigger-${tag}`), tag).toBe(!isKeyboardOperableTrigger(tag));
  });
});
