import { describe, expect, it } from "vitest";
import { MAX_NAVIGATION_LINKS } from "@/features/editor/commands/navigationLinkCommands";
import type { EditorElementNode } from "@/features/editor/types/document";
import { isTouchOnStructureHandle } from "@/features/editor/utils/editorDragSensors";
import {
  isStructureDragData,
  resolvePageEndTarget,
  resolveStructureDropTarget,
  shouldAutoExpand,
  STRUCTURE_DRAG_KIND,
  trailingLevelCandidates,
  type StructureHoverLevels,
} from "./structureDragDrop";

/** BC-12.3 — Structure drop targeting: zones, the shared validator's verdict, auto-expand eligibility. */

const doc: EditorElementNode = {
  id: "page-root",
  tag: "page",
  children: [
    { id: "s1", tag: "section", children: [{ id: "a", tag: "p", text: "A" }, { id: "b", tag: "p", text: "B" }] },
    { id: "s2", tag: "section", children: [{ id: "inner", tag: "div", children: [{ id: "deep", tag: "p", text: "Deep" }] }] },
    { id: "list", tag: "ul", children: [{ id: "li", tag: "li", text: "Item" }] },
    { id: "empty", tag: "div", children: [] },
    { id: "nav", tag: "nav", children: Array.from({ length: MAX_NAVIGATION_LINKS }, (_, index) => ({ id: `l${index}`, tag: "a", text: `L${index}`, href: "#" })) },
    { id: "loose", tag: "a", text: "Loose", href: "#" },
  ],
};

const row = { top: 100, height: 32 };
const at = (fraction: number) => row.top + row.height * fraction;

describe("resolveStructureDropTarget", () => {
  it("splits a container row 25/50/25 into before / inside / after, and a leaf row 50/50", () => {
    expect(resolveStructureDropTarget(doc, "a", "s2", row, at(0.1))?.zone).toBe("before");
    expect(resolveStructureDropTarget(doc, "a", "s2", row, at(0.5))?.zone).toBe("inside");
    expect(resolveStructureDropTarget(doc, "a", "s2", row, at(0.9))?.zone).toBe("after");
    expect(resolveStructureDropTarget(doc, "a", "b", row, at(0.4))?.zone).toBe("before");
    expect(resolveStructureDropTarget(doc, "a", "b", row, at(0.6))?.zone).toBe("after");
  });

  it("the page row only takes inside", () => {
    expect(resolveStructureDropTarget(doc, "a", "page-root", row, at(0.05))).toEqual({ targetId: "page-root", zone: "inside", rejection: null, levelId: "page-root" });
  });

  it("no target over the dragged row itself", () => {
    expect(resolveStructureDropTarget(doc, "a", "a", row, at(0.5))).toBeNull();
  });

  it("carries the shared validator's reason for refused targets", () => {
    expect(resolveStructureDropTarget(doc, "a", "list", row, at(0.5))?.rejection).toBe("incompatible-parent");
    expect(resolveStructureDropTarget(doc, "s2", "inner", row, at(0.5))?.rejection).toBe("descendant");
    expect(resolveStructureDropTarget(doc, "loose", "nav", row, at(0.5))?.rejection).toBe("navigation-link-limit");
    expect(resolveStructureDropTarget(doc, "a", "deep", row, at(0.4))?.rejection).toBeNull();
  });

  it("a no-op position is valid (nothing changes on drop)", () => {
    expect(resolveStructureDropTarget(doc, "b", "a", row, at(0.9))).toEqual({ targetId: "a", zone: "after", rejection: null, levelId: "a" });
  });

  it("an unknown row gives no target", () => {
    expect(resolveStructureDropTarget(doc, "a", "missing", row, at(0.5))).toBeNull();
  });
});

describe("end-of-container levels (BC-12.3.1)", () => {
  // Indentation like the tree: depth d starts at 4 + 16d px.
  const depth: Record<string, number> = { "page-root": 0, s1: 1, s2: 1, list: 1, empty: 1, nav: 1, loose: 1, a: 2, b: 2, inner: 2, li: 2, deep: 3 };
  const levels = (pointerX: number, open: string[] = ["page-root", "s1", "s2", "inner", "list"]): StructureHoverLevels => ({
    openNodeIds: new Set(open),
    pointerX,
    indentStartOf: (id) => (id in depth ? 4 + 16 * depth[id] : null),
  });
  const after = at(0.9);

  it("the gap under a last child can mean the row, its parent, its grandparent… (deepest first)", () => {
    expect(trailingLevelCandidates(doc, "deep", "a")).toEqual(["deep", "inner", "s2"]);
    expect(trailingLevelCandidates(doc, "b", "x")).toEqual(["b", "s1"]);
    expect(trailingLevelCandidates(doc, "a", "x")).toEqual(["a"]); // not a last child
    // The dragged element itself never counts: with b dragged, a is s1's last child.
    expect(trailingLevelCandidates(doc, "a", "b")).toEqual(["a", "s1"]);
  });

  it("the pointer's indentation picks the level: the row itself, or the end of an ancestor's parent", () => {
    expect(resolveStructureDropTarget(doc, "a", "deep", row, after, levels(200))).toMatchObject({ targetId: "deep", zone: "after", levelId: "deep" });
    expect(resolveStructureDropTarget(doc, "a", "deep", row, after, levels(40))).toMatchObject({ targetId: "inner", zone: "after", levelId: "inner" }); // end of Section Two
    expect(resolveStructureDropTarget(doc, "a", "deep", row, after, levels(21))).toMatchObject({ targetId: "s2", zone: "after", levelId: "s2" }); // after Section Two (page level)
    expect(resolveStructureDropTarget(doc, "a", "deep", row, after, levels(0))).toMatchObject({ targetId: "s2", zone: "after" }); // left of everything: the shallowest
  });

  it("outdenting the dragged last child itself: its own row's gap at the parent's level", () => {
    expect(resolveStructureDropTarget(doc, "b", "b", row, after, levels(25))).toMatchObject({ targetId: "s1", zone: "after", rejection: null });
    expect(resolveStructureDropTarget(doc, "b", "b", row, after, levels(200))).toBeNull();
  });

  it("after an OPEN container with children means before its first child, not after the subtree", () => {
    expect(resolveStructureDropTarget(doc, "a", "s2", row, after, levels(200))).toMatchObject({ targetId: "inner", zone: "before", levelId: "inner" });
    // Closed: plain after the container.
    expect(resolveStructureDropTarget(doc, "a", "s2", row, after, levels(200, ["page-root"]))).toMatchObject({ targetId: "s2", zone: "after" });
  });

  it("an ancestor level is validated like any other target", () => {
    expect(resolveStructureDropTarget(doc, "li", "deep", row, after, levels(40))?.rejection).toBe("incompatible-parent");
    expect(resolveStructureDropTarget(doc, "s2", "deep", row, after, levels(40))?.rejection).toBe("descendant");
  });

  it("the page-end area appends to the page; a page's last child dropped there is a no-op (valid, unchanged)", () => {
    expect(resolvePageEndTarget(doc, "a")).toEqual({ targetId: "page-root", zone: "inside", rejection: null, levelId: "page-root" });
    expect(resolvePageEndTarget(doc, "li")).toMatchObject({ rejection: "incompatible-parent" });
    expect(resolvePageEndTarget(doc, "loose")).toMatchObject({ rejection: null });
  });

  it("an empty container takes the element inside", () => {
    expect(resolveStructureDropTarget(doc, "a", "empty", row, at(0.5), levels(200))).toMatchObject({ targetId: "empty", zone: "inside", rejection: null });
  });
});

describe("shouldAutoExpand", () => {
  const open = new Set(["page-root", "s1", "s2"]);
  it("only a valid inside target on a closed container with children", () => {
    expect(shouldAutoExpand(doc, { targetId: "inner", zone: "inside", rejection: null, levelId: "inner" }, open)).toBe(true);
    expect(shouldAutoExpand(doc, { targetId: "inner", zone: "before", rejection: null, levelId: "inner" }, open)).toBe(false);
    expect(shouldAutoExpand(doc, { targetId: "list", zone: "inside", rejection: "incompatible-parent", levelId: "list" }, open)).toBe(false);
    expect(shouldAutoExpand(doc, { targetId: "s1", zone: "inside", rejection: null, levelId: "s1" }, open)).toBe(false); // already open
    expect(shouldAutoExpand(doc, { targetId: "empty", zone: "inside", rejection: null, levelId: "empty" }, open)).toBe(false); // nothing to reveal
    expect(shouldAutoExpand(doc, null, open)).toBe(false);
  });
});

describe("drag payload and touch detection", () => {
  it("recognises only Structure drag payloads", () => {
    expect(isStructureDragData({ kind: STRUCTURE_DRAG_KIND, nodeId: "a", label: "A", tag: "p", count: 1 })).toBe(true);
    expect(isStructureDragData({ kind: "move", nodeId: "a" })).toBe(false);
    expect(isStructureDragData(undefined)).toBe(false);
  });

  it("the touch press delay applies to a touch on a Structure handle only", () => {
    const handle = document.createElement("button");
    handle.setAttribute("data-structure-drag-handle", "");
    const icon = document.createElement("span");
    handle.append(icon);
    const other = document.createElement("div");
    document.body.append(handle, other);
    const pointer = (target: Element, pointerType: string) => {
      const event = new PointerEvent("pointerdown", { pointerType, bubbles: true });
      Object.defineProperty(event, "target", { value: target });
      return event;
    };
    expect(isTouchOnStructureHandle(pointer(icon, "touch"))).toBe(true);
    expect(isTouchOnStructureHandle(pointer(handle, "mouse"))).toBe(false);
    expect(isTouchOnStructureHandle(pointer(handle, "pen"))).toBe(false);
    expect(isTouchOnStructureHandle(pointer(other, "touch"))).toBe(false);
    handle.remove();
    other.remove();
  });
});
