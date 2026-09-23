import { describe, expect, it } from "vitest";
import {
  addInteraction,
  removeInteraction,
  removeInteractionsTargeting,
  remapInteractionTargets,
  updateInteraction,
} from "./interactionCommands";
import type { EditorElementNode } from "@/features/editor/types/document";

describe("addInteraction", () => {
  it("appends a fresh binding with a generated id", () => {
    const root: EditorElementNode = { id: "button-1", tag: "button" };

    const result = addInteraction(root, "button-1", { trigger: "click", action: "toggle", targetId: "target-1" });

    expect(result.interactions).toHaveLength(1);
    expect(result.interactions![0]).toMatchObject({ trigger: "click", action: "toggle", targetId: "target-1" });
    expect(result.interactions![0].id).toBeTruthy();
  });

  it("appends after any existing bindings rather than replacing them", () => {
    const root: EditorElementNode = {
      id: "button-1",
      tag: "button",
      interactions: [{ id: "int-1", trigger: "click", action: "show", targetId: "a" }],
    };

    const result = addInteraction(root, "button-1", { trigger: "click", action: "hide", targetId: "b" });

    expect(result.interactions).toHaveLength(2);
    expect(result.interactions![0].id).toBe("int-1");
  });

  it("is a no-op (same root reference) when nodeId does not resolve", () => {
    const root: EditorElementNode = { id: "button-1", tag: "button" };
    const result = addInteraction(root, "missing-id", { trigger: "click", action: "toggle", targetId: "target-1" });
    expect(result).toBe(root);
  });

  it("finds a deeply nested node", () => {
    const root: EditorElementNode = {
      id: "root",
      tag: "div",
      children: [{ id: "container", tag: "div", children: [{ id: "button-1", tag: "button" }] }],
    };

    const result = addInteraction(root, "button-1", { trigger: "click", action: "toggle", targetId: "target-1" });

    expect(result.children![0].children![0].interactions).toHaveLength(1);
  });
});

describe("updateInteraction", () => {
  const root: EditorElementNode = {
    id: "button-1",
    tag: "button",
    interactions: [{ id: "int-1", trigger: "click", action: "toggle", targetId: "a" }],
  };

  it("patches the action", () => {
    const result = updateInteraction(root, "button-1", "int-1", { action: "hide" });
    expect(result.interactions![0].action).toBe("hide");
    expect(result.interactions![0].targetId).toBe("a");
  });

  it("patches the target", () => {
    const result = updateInteraction(root, "button-1", "int-1", { targetId: "b" });
    expect(result.interactions![0].targetId).toBe("b");
  });

  it("is a true no-op (same root reference) when the patch changes nothing", () => {
    const result = updateInteraction(root, "button-1", "int-1", { action: "toggle", targetId: "a" });
    expect(result).toBe(root);
  });

  it("is a no-op when the interaction id doesn't exist on the node", () => {
    const result = updateInteraction(root, "button-1", "missing-int", { action: "hide" });
    expect(result).toBe(root);
  });
});

describe("removeInteraction", () => {
  it("removes the binding by its own id", () => {
    const root: EditorElementNode = {
      id: "button-1",
      tag: "button",
      interactions: [{ id: "int-1", trigger: "click", action: "toggle", targetId: "a" }],
    };

    const result = removeInteraction(root, "button-1", "int-1");

    expect(result.interactions).toBeUndefined();
  });

  it("collapses back to undefined (never a stray []) once the last binding is removed", () => {
    const root: EditorElementNode = {
      id: "button-1",
      tag: "button",
      interactions: [{ id: "int-1", trigger: "click", action: "toggle", targetId: "a" }],
    };
    const result = removeInteraction(root, "button-1", "int-1");
    expect(result.interactions).toBeUndefined();
  });

  it("leaves other bindings on the same node untouched", () => {
    const root: EditorElementNode = {
      id: "button-1",
      tag: "button",
      interactions: [
        { id: "int-1", trigger: "click", action: "toggle", targetId: "a" },
        { id: "int-2", trigger: "click", action: "show", targetId: "b" },
      ],
    };

    const result = removeInteraction(root, "button-1", "int-1");

    expect(result.interactions).toHaveLength(1);
    expect(result.interactions![0].id).toBe("int-2");
  });

  it("is a no-op when the binding is already gone", () => {
    const root: EditorElementNode = { id: "button-1", tag: "button" };
    const result = removeInteraction(root, "button-1", "int-1");
    expect(result).toBe(root);
  });
});

describe("removeInteractionsTargeting", () => {
  it("strips a binding anywhere in the tree whose target falls inside the deleted-id set", () => {
    const root: EditorElementNode = {
      id: "root",
      tag: "div",
      children: [{ id: "button-1", tag: "button", interactions: [{ id: "int-1", trigger: "click", action: "toggle", targetId: "content-1" }] }],
    };

    const result = removeInteractionsTargeting(root, new Set(["content-1"]));

    expect(result.children![0].interactions).toBeUndefined();
  });

  it("leaves bindings targeting a surviving node untouched", () => {
    const root: EditorElementNode = {
      id: "root",
      tag: "div",
      children: [{ id: "button-1", tag: "button", interactions: [{ id: "int-1", trigger: "click", action: "toggle", targetId: "content-1" }] }],
    };

    const result = removeInteractionsTargeting(root, new Set(["some-other-id"]));

    expect(result).toBe(root);
  });

  it("cleans multiple bindings (from different triggers) targeting the same deleted node in one pass", () => {
    const root: EditorElementNode = {
      id: "root",
      tag: "div",
      children: [
        { id: "button-1", tag: "button", interactions: [{ id: "int-1", trigger: "click", action: "toggle", targetId: "content-1" }] },
        { id: "button-2", tag: "button", interactions: [{ id: "int-2", trigger: "click", action: "hide", targetId: "content-1" }] },
      ],
    };

    const result = removeInteractionsTargeting(root, new Set(["content-1"]));

    expect(result.children![0].interactions).toBeUndefined();
    expect(result.children![1].interactions).toBeUndefined();
  });

  it("is a no-op for an empty deleted-id set", () => {
    const root: EditorElementNode = { id: "root", tag: "div" };
    expect(removeInteractionsTargeting(root, new Set())).toBe(root);
  });
});

describe("remapInteractionTargets", () => {
  it("rewrites a target id present in the map", () => {
    const root: EditorElementNode = {
      id: "button-1",
      tag: "button",
      interactions: [{ id: "int-1", trigger: "click", action: "toggle", targetId: "old-id" }],
    };

    const result = remapInteractionTargets(root, new Map([["old-id", "new-id"]]));

    expect(result.interactions![0].targetId).toBe("new-id");
  });

  it("leaves a target id absent from the map untouched", () => {
    const root: EditorElementNode = {
      id: "button-1",
      tag: "button",
      interactions: [{ id: "int-1", trigger: "click", action: "toggle", targetId: "external-id" }],
    };

    const result = remapInteractionTargets(root, new Map([["old-id", "new-id"]]));

    expect(result.interactions![0].targetId).toBe("external-id");
  });

  it("recurses into children", () => {
    const root: EditorElementNode = {
      id: "root",
      tag: "div",
      children: [{ id: "button-1", tag: "button", interactions: [{ id: "int-1", trigger: "click", action: "toggle", targetId: "old-id" }] }],
    };

    const result = remapInteractionTargets(root, new Map([["old-id", "new-id"]]));

    expect(result.children![0].interactions![0].targetId).toBe("new-id");
  });

  it("is a no-op (same reference) when nothing needs remapping", () => {
    const root: EditorElementNode = { id: "root", tag: "div", children: [{ id: "p-1", tag: "p", text: "Hi" }] };
    const result = remapInteractionTargets(root, new Map([["unrelated", "id"]]));
    expect(result).toBe(root);
  });
});
