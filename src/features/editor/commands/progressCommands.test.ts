import { describe, expect, it } from "vitest";
import { setElementProgressIndeterminate, setElementProgressMax, setElementProgressValue } from "./progressCommands";
import { createProgressNode } from "@/features/editor/factories/elementFactories";
import type { EditorElementNode } from "@/features/editor/types/document";

/** Wraps a bare progress node in a page root — every command here walks from the document root, matching every other document command's own contract. */
function wrap(node: EditorElementNode): EditorElementNode {
  return { id: "page-1", tag: "page", children: [node] };
}

describe("setElementProgressValue (Checkpoint 1.15.6.12.4)", () => {
  it("sets a determinate value within range", () => {
    const root = wrap(createProgressNode());
    const node = root.children![0];
    const next = setElementProgressValue(root, node.id, 75);
    expect(next.children![0].progressValue).toBe(75);
  });

  it("clamps a value above the effective max down to max", () => {
    const root = wrap(createProgressNode());
    const node = root.children![0];
    const next = setElementProgressValue(root, node.id, 500);
    expect(next.children![0].progressValue).toBe(100);
  });

  it("clamps a negative value up to 0", () => {
    const root = wrap(createProgressNode());
    const node = root.children![0];
    const next = setElementProgressValue(root, node.id, -20);
    expect(next.children![0].progressValue).toBe(0);
  });

  it("undefined enters indeterminate state directly", () => {
    const root = wrap(createProgressNode());
    const node = root.children![0];
    const next = setElementProgressValue(root, node.id, undefined);
    expect(next.children![0].progressValue).toBeUndefined();
  });

  it("is a no-op (same reference) when committing the exact already-clamped value again", () => {
    const root = wrap(createProgressNode()); // starter value: 50
    const node = root.children![0];
    const next = setElementProgressValue(root, node.id, 50);
    expect(next).toBe(root);
  });

  it("is a safe no-op for a non-progress tag", () => {
    const root: EditorElementNode = { id: "page-1", tag: "page", children: [{ id: "div-1", tag: "div" }] };
    const next = setElementProgressValue(root, "div-1", 50);
    expect(next).toBe(root);
  });

  it("is a safe no-op for an unknown nodeId", () => {
    const root = wrap(createProgressNode());
    expect(setElementProgressValue(root, "does-not-exist", 50)).toBe(root);
  });
});

describe("setElementProgressMax (Checkpoint 1.15.6.12.4)", () => {
  it("sets a positive max", () => {
    const root = wrap(createProgressNode());
    const node = root.children![0];
    const next = setElementProgressMax(root, node.id, 200);
    expect(next.children![0].progressMax).toBe(200);
  });

  it("clamps a zero/negative/NaN max up to a minimum of 1", () => {
    const root = wrap(createProgressNode());
    const node = root.children![0];
    expect(setElementProgressMax(root, node.id, 0).children![0].progressMax).toBe(1);
    expect(setElementProgressMax(root, node.id, -10).children![0].progressMax).toBe(1);
    expect(setElementProgressMax(root, node.id, NaN).children![0].progressMax).toBe(1);
  });

  it("atomically clamps a determinate value that would exceed the new max, in the same write", () => {
    const root = wrap({ id: "progress-1", tag: "progress", progressValue: 80, progressMax: 100 });
    const next = setElementProgressMax(root, "progress-1", 50);
    const node = next.children![0];
    expect(node.progressMax).toBe(50);
    expect(node.progressValue).toBe(50);
  });

  it("never touches an indeterminate node's own undefined value when max shrinks", () => {
    const root = wrap({ id: "progress-1", tag: "progress", progressValue: undefined, progressMax: 100 });
    const next = setElementProgressMax(root, "progress-1", 10);
    expect(next.children![0].progressValue).toBeUndefined();
    expect(next.children![0].progressMax).toBe(10);
  });

  it("is a no-op when the max is unchanged and no value-clamp is needed", () => {
    const root = wrap(createProgressNode());
    const node = root.children![0];
    const next = setElementProgressMax(root, node.id, 100);
    expect(next).toBe(root);
  });

  it("is a safe no-op for a non-progress tag", () => {
    const root: EditorElementNode = { id: "page-1", tag: "page", children: [{ id: "div-1", tag: "div" }] };
    expect(setElementProgressMax(root, "div-1", 50)).toBe(root);
  });
});

describe("setElementProgressIndeterminate (Checkpoint 1.15.6.12.4)", () => {
  it("ON clears progressValue entirely", () => {
    const root = wrap(createProgressNode());
    const node = root.children![0];
    const next = setElementProgressIndeterminate(root, node.id, true);
    expect(next.children![0].progressValue).toBeUndefined();
  });

  it("OFF restores a determinate value of effective max / 2, rounded", () => {
    const root = wrap({ id: "progress-1", tag: "progress", progressValue: undefined, progressMax: 100 });
    const next = setElementProgressIndeterminate(root, "progress-1", false);
    expect(next.children![0].progressValue).toBe(50);
  });

  it("OFF scales the restored value with a non-default max", () => {
    const root = wrap({ id: "progress-1", tag: "progress", progressValue: undefined, progressMax: 10 });
    const next = setElementProgressIndeterminate(root, "progress-1", false);
    expect(next.children![0].progressValue).toBe(5);
  });

  it("is a no-op when already in the requested state", () => {
    const root = wrap(createProgressNode()); // already determinate
    const node = root.children![0];
    expect(setElementProgressIndeterminate(root, node.id, false)).toBe(root);

    const indeterminateRoot = wrap({ id: "progress-1", tag: "progress", progressValue: undefined });
    expect(setElementProgressIndeterminate(indeterminateRoot, "progress-1", true)).toBe(indeterminateRoot);
  });

  it("is a safe no-op for a non-progress tag", () => {
    const root: EditorElementNode = { id: "page-1", tag: "page", children: [{ id: "div-1", tag: "div" }] };
    expect(setElementProgressIndeterminate(root, "div-1", true)).toBe(root);
  });
});
