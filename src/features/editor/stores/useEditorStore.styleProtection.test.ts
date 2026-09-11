import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "./useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";

// A separate file from useEditorStore.test.ts / useEditorStore.multiSelection.test.ts,
// the same "new checkpoint, new file" convention Checkpoint 1.15.2 already
// established — see this checkpoint's own report for why.

const initialState = useEditorStore.getState();

function setupDocument(children: EditorElementNode[]) {
  useEditorStore.setState((state) => ({ document: { ...state.document, children } }));
}

function node(id: string) {
  return useEditorStore.getState().document.children!.find((c) => c.id === id)!;
}

function childOf(parentId: string, childId: string) {
  return node(parentId).children!.find((c) => c.id === childId)!;
}

describe("useEditorStore — Parent Style Protection (Checkpoint 1.15.3)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
    useEditorStore.getState().dismissEditorNotice();
  });

  describe("setElementLockChildStyles", () => {
    it("toggles the field, one history entry per call, no-op safe", () => {
      setupDocument([{ id: "hero", tag: "div" }]);
      const pastBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().setElementLockChildStyles("hero", true);
      expect(node("hero").lockChildStyles).toBe(true);
      expect(useEditorStore.getState().past.length).toBe(pastBefore + 1);

      // Re-applying the same value is a true no-op — no extra history entry.
      useEditorStore.getState().setElementLockChildStyles("hero", true);
      expect(useEditorStore.getState().past.length).toBe(pastBefore + 1);

      useEditorStore.getState().setElementLockChildStyles("hero", false);
      expect(node("hero").lockChildStyles).toBe(false);
      expect(useEditorStore.getState().past.length).toBe(pastBefore + 2);
    });

    it("undo/redo restore the lock state", () => {
      setupDocument([{ id: "hero", tag: "div" }]);
      useEditorStore.getState().setElementLockChildStyles("hero", true);
      useEditorStore.getState().undo();
      expect(node("hero").lockChildStyles).toBeUndefined();
      useEditorStore.getState().redo();
      expect(node("hero").lockChildStyles).toBe(true);
    });

    it("stays editable even on a node that is itself protected by a further ancestor (editor metadata, not style)", () => {
      setupDocument([
        {
          id: "a",
          tag: "div",
          lockChildStyles: true,
          children: [{ id: "b", tag: "div" }],
        },
      ]);
      useEditorStore.getState().setElementLockChildStyles("b", true);
      expect(childOf("a", "b").lockChildStyles).toBe(true);
    });
  });

  describe("single-node style commands", () => {
    it("blocks a protected descendant's Typography edit: no document change, no history, shows a notice", () => {
      setupDocument([
        {
          id: "hero",
          tag: "div",
          htmlId: "hero",
          lockChildStyles: true,
          children: [{ id: "p1", tag: "p" }],
        },
      ]);
      const pastBefore = useEditorStore.getState().past.length;
      const docBefore = useEditorStore.getState().document;

      useEditorStore.getState().setElementTypography("p1", { fontSize: { value: 24, unit: "px" } });

      expect(useEditorStore.getState().document).toBe(docBefore);
      expect(useEditorStore.getState().past.length).toBe(pastBefore);
      expect(useEditorStore.getState().editorNotice?.message).toBe(
        'Styles are locked by "hero". Disable "Lock child styles" on the parent to edit this element.',
      );
    });

    it("allows an unlocked descendant's Typography edit normally", () => {
      setupDocument([{ id: "hero", tag: "div", children: [{ id: "p1", tag: "p" }] }]);
      useEditorStore.getState().setElementTypography("p1", { fontSize: { value: 24, unit: "px" } });
      expect(childOf("hero", "p1").typography?.fontSize).toEqual({ value: 24, unit: "px" });
      expect(useEditorStore.getState().editorNotice).toBeNull();
    });

    it("the lock OWNER remains editable on its own style (background/padding/width) — section 8", () => {
      setupDocument([{ id: "hero", tag: "div", lockChildStyles: true }]);
      useEditorStore.getState().setElementBackground("hero", { color: "#ffffff" });
      expect(node("hero").background?.color).toBe("#ffffff");
      expect(useEditorStore.getState().editorNotice).toBeNull();
    });

    it("protects a deep (grandchild) descendant recursively", () => {
      setupDocument([
        {
          id: "a",
          tag: "div",
          lockChildStyles: true,
          children: [{ id: "b", tag: "div", children: [{ id: "button1", tag: "button" }] }],
        },
      ]);
      const docBefore = useEditorStore.getState().document;
      useEditorStore.getState().setElementBorder("button1", { top: { width: { value: 2, unit: "px" } } });
      expect(useEditorStore.getState().document).toBe(docBefore);
    });

    it("unlock then edit: two separate history entries, undo order reverts the edit first then the lock", () => {
      setupDocument([{ id: "hero", tag: "div", lockChildStyles: true, children: [{ id: "p1", tag: "p" }] }]);

      // Blocked while locked.
      useEditorStore.getState().setElementTypography("p1", { fontSize: { value: 24, unit: "px" } });
      expect(childOf("hero", "p1").typography).toBeUndefined();

      useEditorStore.getState().setElementLockChildStyles("hero", false);
      useEditorStore.getState().setElementTypography("p1", { fontSize: { value: 24, unit: "px" } });
      expect(childOf("hero", "p1").typography?.fontSize).toEqual({ value: 24, unit: "px" });

      useEditorStore.getState().undo();
      expect(childOf("hero", "p1").typography).toBeUndefined();
      expect(node("hero").lockChildStyles).toBe(false);

      useEditorStore.getState().undo();
      expect(node("hero").lockChildStyles).toBe(true);
    });

    it("nested locks: the notice names the NEAREST locking ancestor", () => {
      setupDocument([
        {
          id: "a",
          tag: "div",
          htmlId: "outer",
          lockChildStyles: true,
          children: [
            {
              id: "b",
              tag: "div",
              htmlId: "inner",
              lockChildStyles: true,
              children: [{ id: "p1", tag: "p" }],
            },
          ],
        },
      ]);
      useEditorStore.getState().setElementTypography("p1", { fontSize: { value: 24, unit: "px" } });
      expect(useEditorStore.getState().editorNotice?.message).toContain('"inner"');
    });
  });

  describe("bulk style commands — atomic protection (sections 17-18)", () => {
    it("blocks the ENTIRE bulk mutation when any one target is protected, even the unprotected ones", () => {
      setupDocument([
        { id: "free1", tag: "p" },
        { id: "hero", tag: "div", htmlId: "hero", lockChildStyles: true, children: [{ id: "locked1", tag: "p" }] },
      ]);
      const pastBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().setElementsTypographyField(["free1", "locked1"], "fontWeight", 700);

      expect(node("free1").typography).toBeUndefined();
      expect(childOf("hero", "locked1").typography).toBeUndefined();
      expect(useEditorStore.getState().past.length).toBe(pastBefore);
      expect(useEditorStore.getState().editorNotice?.message).toContain('"hero"');
    });

    it("applies normally when nothing in the selection is protected", () => {
      setupDocument([
        { id: "free1", tag: "p" },
        { id: "free2", tag: "p" },
      ]);
      useEditorStore.getState().setElementsTypographyField(["free1", "free2"], "fontWeight", 700);
      expect(node("free1").typography?.fontWeight).toBe(700);
      expect(node("free2").typography?.fontWeight).toBe(700);
    });

    it("shows the generic multi-parent message when protected targets share no single ancestor", () => {
      setupDocument([
        { id: "a", tag: "div", htmlId: "a", lockChildStyles: true, children: [{ id: "child-a", tag: "p" }] },
        { id: "b", tag: "div", htmlId: "b", lockChildStyles: true, children: [{ id: "child-b", tag: "p" }] },
      ]);
      useEditorStore.getState().setElementsTypographyField(["child-a", "child-b"], "fontWeight", 700);
      expect(useEditorStore.getState().editorNotice?.message).toBe(
        "Some selected elements have locked styles. Unlock their parent containers before applying this change.",
      );
    });

    it("bulk delete (a structural mutation) remains allowed for protected descendants", () => {
      setupDocument([{ id: "hero", tag: "div", lockChildStyles: true, children: [{ id: "p1", tag: "p" }] }]);
      useEditorStore.getState().setSelection(["p1"]);
      useEditorStore.getState().deleteSelection();
      expect(node("hero").children).toEqual([]);
    });
  });

  describe("resizeElement / setFreeChildGeometry(Live) — defense in depth", () => {
    it("resizeElement is a no-op for a protected node even called directly (bypassing hidden handles)", () => {
      setupDocument([{ id: "hero", tag: "div", lockChildStyles: true, children: [{ id: "p1", tag: "p" }] }]);
      const docBefore = useEditorStore.getState().document;
      useEditorStore.getState().resizeElement("p1", { preferredWidth: 200, preferredHeight: 100, offsetX: 0, offsetY: 0 });
      expect(useEditorStore.getState().document).toBe(docBefore);
    });

    it("setFreeChildGeometry is blocked for a protected node, no history, notice shown", () => {
      setupDocument([{ id: "hero", tag: "div", lockChildStyles: true, children: [{ id: "p1", tag: "p" }] }]);
      const pastBefore = useEditorStore.getState().past.length;
      useEditorStore.getState().setFreeChildGeometry("p1", { x: 10, y: 10, width: 50, height: 50 });
      expect(childOf("hero", "p1").freeLayout).toBeUndefined();
      expect(useEditorStore.getState().past.length).toBe(pastBefore);
      expect(useEditorStore.getState().editorNotice).not.toBeNull();
    });
  });

  describe("showEditorNotice / dismissEditorNotice", () => {
    it("replaces rather than queues, and coalesces an identical repeated message (no id churn)", () => {
      useEditorStore.getState().showEditorNotice("first");
      const firstId = useEditorStore.getState().editorNotice?.id;
      useEditorStore.getState().showEditorNotice("first");
      expect(useEditorStore.getState().editorNotice?.id).toBe(firstId);

      useEditorStore.getState().showEditorNotice("second");
      expect(useEditorStore.getState().editorNotice?.message).toBe("second");
      expect(useEditorStore.getState().editorNotice?.id).not.toBe(firstId);
    });

    it("dismissEditorNotice clears it", () => {
      useEditorStore.getState().showEditorNotice("hello");
      useEditorStore.getState().dismissEditorNotice();
      expect(useEditorStore.getState().editorNotice).toBeNull();
    });

    it("notices never enter document history", () => {
      const pastBefore = useEditorStore.getState().past.length;
      useEditorStore.getState().showEditorNotice("hello");
      expect(useEditorStore.getState().past.length).toBe(pastBefore);
    });
  });
});
