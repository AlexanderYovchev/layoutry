import { describe, expect, it } from "vitest";
import { MAX_NAVIGATION_LINKS } from "@/features/editor/commands/navigationLinkCommands";
import type { EditorElementNode } from "@/features/editor/types/document";
import { isTouchOnStructureHandle } from "@/features/editor/utils/editorDragSensors";
import { isStructureDragData, resolveStructureDropTarget, shouldAutoExpand, STRUCTURE_DRAG_KIND } from "./structureDragDrop";

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
    expect(resolveStructureDropTarget(doc, "a", "page-root", row, at(0.05))).toEqual({ targetId: "page-root", zone: "inside", rejection: null });
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
    expect(resolveStructureDropTarget(doc, "b", "a", row, at(0.9))).toEqual({ targetId: "a", zone: "after", rejection: null });
  });

  it("an unknown row gives no target", () => {
    expect(resolveStructureDropTarget(doc, "a", "missing", row, at(0.5))).toBeNull();
  });
});

describe("shouldAutoExpand", () => {
  const open = new Set(["page-root", "s1", "s2"]);
  it("only a valid inside target on a closed container with children", () => {
    expect(shouldAutoExpand(doc, { targetId: "inner", zone: "inside", rejection: null }, open)).toBe(true);
    expect(shouldAutoExpand(doc, { targetId: "inner", zone: "before", rejection: null }, open)).toBe(false);
    expect(shouldAutoExpand(doc, { targetId: "list", zone: "inside", rejection: "incompatible-parent" }, open)).toBe(false);
    expect(shouldAutoExpand(doc, { targetId: "s1", zone: "inside", rejection: null }, open)).toBe(false); // already open
    expect(shouldAutoExpand(doc, { targetId: "empty", zone: "inside", rejection: null }, open)).toBe(false); // nothing to reveal
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
