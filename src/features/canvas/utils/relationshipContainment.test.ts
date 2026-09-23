import { describe, expect, it } from "vitest";
import { isEventInsideRelationshipRegion, resolveRelationshipElements } from "./relationshipContainment";
import type { DismissibleRelationship } from "@/features/editor/utils/dismissibleTargets";

describe("isEventInsideRelationshipRegion (Checkpoint 1.15.6.8.3)", () => {
  it("is true when the event target is the trigger element itself", () => {
    const trigger = document.createElement("button");
    expect(isEventInsideRelationshipRegion(trigger, trigger, null)).toBe(true);
  });

  it("is true when the event target is a descendant of the trigger", () => {
    const trigger = document.createElement("button");
    const icon = document.createElement("span");
    trigger.appendChild(icon);
    expect(isEventInsideRelationshipRegion(icon, trigger, null)).toBe(true);
  });

  it("is true when the event target is the target element itself", () => {
    const target = document.createElement("div");
    expect(isEventInsideRelationshipRegion(target, null, target)).toBe(true);
  });

  it("is true when the event target is a descendant of the target (e.g. a menu Link)", () => {
    const target = document.createElement("div");
    const link = document.createElement("a");
    target.appendChild(link);
    expect(isEventInsideRelationshipRegion(link, null, target)).toBe(true);
  });

  it("is false when the event target is outside both trigger and target", () => {
    const trigger = document.createElement("button");
    const target = document.createElement("div");
    const outside = document.createElement("p");
    expect(isEventInsideRelationshipRegion(outside, trigger, target)).toBe(false);
  });

  it("is false when both elements are null (already-unmounted relationship)", () => {
    const outside = document.createElement("p");
    expect(isEventInsideRelationshipRegion(outside, null, null)).toBe(false);
  });
});

describe("resolveRelationshipElements (Checkpoint 1.15.6.8.3)", () => {
  it("resolves both elements via the existing data-node-id convention", () => {
    const container = document.createElement("div");
    const trigger = document.createElement("button");
    trigger.setAttribute("data-node-id", "trigger-1");
    const target = document.createElement("div");
    target.setAttribute("data-node-id", "target-1");
    container.append(trigger, target);

    const relationship: DismissibleRelationship = { triggerId: "trigger-1", targetId: "target-1", bindingId: "int-1" };
    const { triggerElement, targetElement } = resolveRelationshipElements(container, relationship);

    expect(triggerElement).toBe(trigger);
    expect(targetElement).toBe(target);
  });

  it("resolves null for a side that isn't currently rendered", () => {
    const container = document.createElement("div");
    const relationship: DismissibleRelationship = { triggerId: "missing-trigger", targetId: "missing-target", bindingId: "int-1" };
    const { triggerElement, targetElement } = resolveRelationshipElements(container, relationship);

    expect(triggerElement).toBeNull();
    expect(targetElement).toBeNull();
  });
});
