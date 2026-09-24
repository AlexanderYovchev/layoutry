import { describe, expect, it } from "vitest";
import { createModalNode } from "@/features/editor/factories/interactionCompositions";
import { createDismissibleAlertNode, createManualToastNode, createPopoverNode } from "@/features/editor/factories/feedbackCompositions";
import { findDismissibleRelationships } from "./dismissibleTargets";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Checkpoint 1.15.6.8.3 — the V1 dismissibility signature: click+toggle
 * binding, authored `initialPreviewVisibility: "hidden"` on the target,
 * AND currently `runtimeVisibility[targetId] === true`. All three must
 * hold together; each test isolates exactly one of them failing.
 */
function dropdownLikeTree(): EditorElementNode {
  return {
    id: "root",
    tag: "div",
    children: [
      {
        id: "trigger-1",
        tag: "button",
        interactions: [{ id: "int-1", trigger: "click", action: "toggle", targetId: "menu-1" }],
      },
      { id: "menu-1", tag: "div", initialPreviewVisibility: "hidden" },
    ],
  };
}

describe("findDismissibleRelationships", () => {
  it("qualifies a click+toggle binding whose target is authored hidden and currently runtime-visible", () => {
    const relationships = findDismissibleRelationships(dropdownLikeTree(), { "menu-1": true });
    expect(relationships).toEqual([{ triggerId: "trigger-1", targetId: "menu-1", bindingId: "int-1" }]);
  });

  it("excludes it when the target is not currently runtime-visible (closed)", () => {
    expect(findDismissibleRelationships(dropdownLikeTree(), { "menu-1": false })).toEqual([]);
  });

  it("excludes it when the target has no runtimeVisibility entry at all (never opened)", () => {
    expect(findDismissibleRelationships(dropdownLikeTree(), {})).toEqual([]);
  });

  it("excludes a target whose authored initialPreviewVisibility is NOT 'hidden' — this is exactly what keeps Collapsible out of the list, since its content never sets this field", () => {
    const tree: EditorElementNode = {
      id: "root",
      tag: "div",
      children: [
        { id: "trigger-1", tag: "button", interactions: [{ id: "int-1", trigger: "click", action: "toggle", targetId: "content-1" }] },
        { id: "content-1", tag: "div" }, // no initialPreviewVisibility — defaults "visible"
      ],
    };
    expect(findDismissibleRelationships(tree, { "content-1": true })).toEqual([]);
  });

  it("excludes an action other than 'toggle' (e.g. 'show'), even when the target is authored hidden and currently visible", () => {
    const tree: EditorElementNode = {
      id: "root",
      tag: "div",
      children: [
        { id: "trigger-1", tag: "button", interactions: [{ id: "int-1", trigger: "click", action: "show", targetId: "target-1" }] },
        { id: "target-1", tag: "div", initialPreviewVisibility: "hidden" },
      ],
    };
    expect(findDismissibleRelationships(tree, { "target-1": true })).toEqual([]);
  });

  it("is safe (empty result, no throw) when the binding's target no longer exists in the document", () => {
    const tree: EditorElementNode = {
      id: "root",
      tag: "div",
      children: [{ id: "trigger-1", tag: "button", interactions: [{ id: "int-1", trigger: "click", action: "toggle", targetId: "gone" }] }],
    };
    expect(() => findDismissibleRelationships(tree, { gone: true })).not.toThrow();
    expect(findDismissibleRelationships(tree, { gone: true })).toEqual([]);
  });

  it("finds multiple independent open relationships across separate Dropdown-like compositions", () => {
    const tree: EditorElementNode = {
      id: "root",
      tag: "div",
      children: [dropdownLikeTree(), { ...dropdownLikeTree(), id: "root-2", children: [{ id: "trigger-2", tag: "button", interactions: [{ id: "int-2", trigger: "click", action: "toggle", targetId: "menu-2" }] }, { id: "menu-2", tag: "div", initialPreviewVisibility: "hidden" }] }],
    };
    const relationships = findDismissibleRelationships(tree, { "menu-1": true, "menu-2": true });
    expect(relationships).toHaveLength(2);
    expect(relationships.map((r) => r.targetId).sort()).toEqual(["menu-1", "menu-2"]);
  });

  it("returns an empty array for a document with no interactions anywhere", () => {
    expect(findDismissibleRelationships({ id: "root", tag: "div" }, {})).toEqual([]);
  });

  it("Checkpoint 1.15.6.9 — a real Modal's Dialog is never dismissible via this generic rule, even while open: Open/Close use show/hide, not toggle", () => {
    const modal = createModalNode();
    const [, dialog] = modal.children!;
    expect(findDismissibleRelationships(modal, { [dialog.id]: true })).toEqual([]);
  });

  it("Checkpoint 1.15.6.11.1 — a real Manual Toast's target is never dismissible via this generic rule, even while shown: Show/Close use show/hide, not toggle", () => {
    const toastComposition = createManualToastNode();
    const [, toast] = toastComposition.children!;
    expect(findDismissibleRelationships(toastComposition, { [toast.id]: true })).toEqual([]);
  });

  it("Checkpoint 1.15.6.11.1 — a real Dismissible Alert is never dismissible via this generic rule, even while visible: Dismiss uses hide, not toggle, and the root has no initialPreviewVisibility: hidden anyway", () => {
    const alert = createDismissibleAlertNode();
    expect(findDismissibleRelationships(alert, { [alert.id]: true })).toEqual([]);
  });

  it("Checkpoint 1.15.6.11.2 — a real Popover's Panel DOES naturally qualify for generic dismissal while open, with zero new inclusion logic: it uses click+toggle+initially-hidden, exactly like Dropdown's own menu", () => {
    const popover = createPopoverNode();
    const [trigger, panel] = popover.children!;
    const relationships = findDismissibleRelationships(popover, { [panel.id]: true });
    expect(relationships).toEqual([{ triggerId: trigger.id, targetId: panel.id, bindingId: trigger.interactions![0].id }]);
  });
});
