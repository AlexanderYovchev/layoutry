import { describe, expect, it } from "vitest";
import { resolveSizeConstraintsStyle } from "./resolveSizeConstraintsStyle";
import type { EditorElementNode } from "@/features/editor/types/document";

describe("resolveSizeConstraintsStyle", () => {
  it("returns an empty style for an unresized Flow node with no constraints", () => {
    const node: EditorElementNode = { id: "n1", tag: "div" };
    expect(resolveSizeConstraintsStyle(node, "flow")).toEqual({});
  });

  it("emits the legacy 100% containment for a resized Flow node with no user constraints", () => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "div",
      dimensions: { preferredWidth: 320, preferredHeight: 180, offsetX: 0, offsetY: 0 },
    };
    expect(resolveSizeConstraintsStyle(node, "flow")).toEqual({ maxWidth: "100%", maxHeight: "100%" });
  });

  it("never applies the legacy 100% containment to a Free child, even with dimensions stored", () => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "div",
      dimensions: { preferredWidth: 320, preferredHeight: 180, offsetX: 0, offsetY: 0 },
      freeLayout: { x: 0, y: 0, width: 100, height: 80 },
    };
    expect(resolveSizeConstraintsStyle(node, "free")).toEqual({});
  });

  it("emits a plain user max-width/max-height in px for an unresized node", () => {
    const node: EditorElementNode = { id: "n1", tag: "div", sizeConstraints: { maxWidth: 600, maxHeight: 400 } };
    expect(resolveSizeConstraintsStyle(node, "flow")).toEqual({ maxWidth: "600px", maxHeight: "400px" });
  });

  it("composes the legacy 100% containment with a user max via min() when both apply", () => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "div",
      dimensions: { preferredWidth: 320, preferredHeight: 180, offsetX: 0, offsetY: 0 },
      sizeConstraints: { maxWidth: 600, maxHeight: 400 },
    };
    expect(resolveSizeConstraintsStyle(node, "flow")).toEqual({
      maxWidth: "min(100%, 600px)",
      maxHeight: "min(100%, 400px)",
    });
  });

  it("emits minWidth/minHeight as plain px with no legacy counterpart to compose with", () => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "div",
      dimensions: { preferredWidth: 320, preferredHeight: 180, offsetX: 0, offsetY: 0 },
      sizeConstraints: { minWidth: 100, minHeight: 50 },
    };
    expect(resolveSizeConstraintsStyle(node, "flow")).toEqual({
      maxWidth: "100%",
      maxHeight: "100%",
      minWidth: "100px",
      minHeight: "50px",
    });
  });

  it("allows an explicit min-width: 0 (a common, deliberate flexbox override)", () => {
    const node: EditorElementNode = { id: "n1", tag: "div", sizeConstraints: { minWidth: 0 } };
    expect(resolveSizeConstraintsStyle(node, "flow")).toEqual({ minWidth: "0px" });
  });

  it("a malformed maxWidth doesn't suppress a valid maxHeight", () => {
    const node = { id: "n1", tag: "div", sizeConstraints: { maxWidth: -5, maxHeight: 400 } } as unknown as EditorElementNode;
    expect(resolveSizeConstraintsStyle(node, "flow")).toEqual({ maxHeight: "400px" });
  });

  it("a malformed minHeight doesn't suppress a valid minWidth", () => {
    const node = { id: "n1", tag: "div", sizeConstraints: { minWidth: 100, minHeight: NaN } } as unknown as EditorElementNode;
    expect(resolveSizeConstraintsStyle(node, "flow")).toEqual({ minWidth: "100px" });
  });

  it("a malformed constraint on one axis never suppresses a valid constraint on the other axis pair", () => {
    const node = {
      id: "n1",
      tag: "div",
      sizeConstraints: { minWidth: "not-a-number", maxWidth: 500, minHeight: 20, maxHeight: -1 },
    } as unknown as EditorElementNode;
    expect(resolveSizeConstraintsStyle(node, "flow")).toEqual({ maxWidth: "500px", minHeight: "20px" });
  });

  it("never throws on entirely malformed sizeConstraints data", () => {
    const node = { id: "n1", tag: "div", sizeConstraints: "not-an-object" } as unknown as EditorElementNode;
    expect(() => resolveSizeConstraintsStyle(node, "flow")).not.toThrow();
    expect(resolveSizeConstraintsStyle(node, "flow")).toEqual({});
  });
});
