import { describe, expect, it } from "vitest";
import {
  canOwnStyleLock,
  describeStyleLockNotice,
  findNearestStyleLockingAncestor,
  getReadableNodeName,
  getStyleProtection,
  isStyleProtected,
} from "./styleProtection";
import type { EditorElementNode } from "@/features/editor/types/document";

describe("canOwnStyleLock", () => {
  it("allows ordinary layout/content-grouping containers", () => {
    expect(canOwnStyleLock("div")).toBe(true);
    expect(canOwnStyleLock("section")).toBe(true);
    expect(canOwnStyleLock("form")).toBe(true);
    expect(canOwnStyleLock("label")).toBe(true);
  });

  it("excludes constrained structural containers (table/select) from the v1 toggle list", () => {
    expect(canOwnStyleLock("table")).toBe(false);
    expect(canOwnStyleLock("tr")).toBe(false);
    expect(canOwnStyleLock("select")).toBe(false);
  });

  it("excludes plain content/leaf tags", () => {
    expect(canOwnStyleLock("p")).toBe(false);
    expect(canOwnStyleLock("img")).toBe(false);
  });
});

describe("findNearestStyleLockingAncestor / getStyleProtection", () => {
  it("case A: unlocked parent -> not protected", () => {
    const doc: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [{ id: "parent", tag: "div", children: [{ id: "child", tag: "p" }] }],
    };
    expect(getStyleProtection(doc, "child")).toEqual({ protected: false });
    expect(isStyleProtected(doc, "child")).toBe(false);
  });

  it("case B: locked parent -> direct child protected", () => {
    const doc: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [{ id: "parent", tag: "div", lockChildStyles: true, children: [{ id: "child", tag: "p" }] }],
    };
    const result = getStyleProtection(doc, "child");
    expect(result).toEqual({ protected: true, lockingAncestor: doc.children![0] });
  });

  it("case C: locked grandparent -> deep descendant protected", () => {
    const doc: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [
        {
          id: "grandparent",
          tag: "section",
          lockChildStyles: true,
          children: [{ id: "parent", tag: "div", children: [{ id: "child", tag: "button" }] }],
        },
      ],
    };
    const result = getStyleProtection(doc, "child");
    expect(result).toEqual({ protected: true, lockingAncestor: doc.children![0] });
  });

  it("case D: node itself owns the lock -> node itself is NOT protected", () => {
    const doc: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [{ id: "owner", tag: "div", lockChildStyles: true }],
    };
    expect(getStyleProtection(doc, "owner")).toEqual({ protected: false });
  });

  it("case E: nested locks -> resolves to the NEAREST locking ancestor", () => {
    const doc: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [
        {
          id: "a",
          tag: "div",
          lockChildStyles: true,
          children: [
            {
              id: "b",
              tag: "div",
              lockChildStyles: true,
              children: [{ id: "child", tag: "p" }],
            },
          ],
        },
      ],
    };
    const result = getStyleProtection(doc, "child");
    expect(result).toEqual({ protected: true, lockingAncestor: doc.children![0].children![0] });
  });

  it("case F: sibling outside the locked subtree -> not protected", () => {
    const doc: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [
        { id: "locked", tag: "div", lockChildStyles: true, children: [{ id: "insideChild", tag: "p" }] },
        { id: "outsideSibling", tag: "p" },
      ],
    };
    expect(getStyleProtection(doc, "outsideSibling")).toEqual({ protected: false });
  });

  it("case G: deleted/invalid id -> safe result, no throw", () => {
    const doc: EditorElementNode = { id: "root", tag: "page", children: [] };
    expect(findNearestStyleLockingAncestor(doc, "not-a-real-id")).toBeUndefined();
    expect(getStyleProtection(doc, "not-a-real-id")).toEqual({ protected: false });
  });
});

describe("getReadableNodeName", () => {
  it("prefers the authored HTML ID when present", () => {
    expect(getReadableNodeName({ id: "n1", tag: "div", htmlId: "hero", displayName: "Ignored" })).toBe("hero");
  });

  it("trims whitespace and falls through to the display name when htmlId is blank", () => {
    expect(getReadableNodeName({ id: "n1", tag: "div", htmlId: "   " })).toBe("Container");
  });

  it("falls back to the Structure display name when no htmlId is set", () => {
    expect(getReadableNodeName({ id: "n1", tag: "section" })).toBe("Section");
  });

  it("never exposes the internal editor id", () => {
    const name = getReadableNodeName({ id: "editor-generated-uuid-123", tag: "div" });
    expect(name).not.toContain("editor-generated-uuid-123");
  });
});

describe("describeStyleLockNotice", () => {
  const hero: EditorElementNode = { id: "hero-id", tag: "div", htmlId: "hero" };
  const footer: EditorElementNode = { id: "footer-id", tag: "footer" };

  it("returns empty string when nothing is protected", () => {
    expect(describeStyleLockNotice([{ protected: false }], false)).toBe("");
  });

  it("single-target message names the locking ancestor and says 'this element'", () => {
    const message = describeStyleLockNotice([{ protected: true, lockingAncestor: hero }], false);
    expect(message).toBe('Styles are locked by "hero". Disable "Lock child styles" on the parent to edit this element.');
  });

  it("bulk message with one shared locking ancestor says 'this selection'", () => {
    const message = describeStyleLockNotice(
      [
        { protected: true, lockingAncestor: hero },
        { protected: false },
        { protected: true, lockingAncestor: hero },
      ],
      true,
    );
    expect(message).toBe('Styles are locked by "hero". Disable "Lock child styles" on the parent to edit this selection.');
  });

  it("bulk message with multiple different locking ancestors is generic (no per-target flood)", () => {
    const message = describeStyleLockNotice(
      [
        { protected: true, lockingAncestor: hero },
        { protected: true, lockingAncestor: footer },
      ],
      true,
    );
    expect(message).toBe("Some selected elements have locked styles. Unlock their parent containers before applying this change.");
  });
});
