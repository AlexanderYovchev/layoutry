import { afterEach, describe, expect, it } from "vitest";
import { createDropdownButtonNode } from "@/features/editor/factories/buttonCompositions";
import { createCollapsibleNode } from "@/features/editor/factories/interactionCompositions";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { useEditorStore } from "./useEditorStore";

const initialState = useEditorStore.getState();

/**
 * Checkpoint 1.15.6.8.1 — generic authored initial Preview visibility,
 * proved end-to-end via the real, now-upgraded Dropdown Button
 * composition (not just synthetic fixtures), plus confirmation that
 * Collapsible (1.15.6.8's own proof, which never sets this field) stays
 * fully backward compatible.
 */
describe("Initial Preview visibility — store integration (Checkpoint 1.15.6.8.1)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  describe("Preview initialization (enterPreview seeds runtimeVisibility from authored state)", () => {
    it("a node with no authored initial state stays default-visible on Preview entry (undefined runtimeVisibility entry)", () => {
      const collapsible = createCollapsibleNode();
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [collapsible] } }));
      const [, content] = collapsible.children!;

      useEditorStore.getState().enterPreview();

      expect(useEditorStore.getState().runtimeVisibility[content.id]).toBeUndefined();
    });

    it("a node authored initialPreviewVisibility: 'hidden' starts hidden immediately on Preview entry, with no click required", () => {
      const dropdown = createDropdownButtonNode();
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [dropdown] } }));
      const [, menu] = dropdown.children!;

      useEditorStore.getState().enterPreview();

      expect(useEditorStore.getState().runtimeVisibility[menu.id]).toBe(false);
    });

    it("Design mode ignores authored initial hidden state entirely — the node keeps rendering (runtimeVisibility is simply not consulted outside Preview)", () => {
      const dropdown = createDropdownButtonNode();
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [dropdown] } }));

      expect(useEditorStore.getState().editorMode).toBe("design");
      expect(useEditorStore.getState().runtimeVisibility).toEqual({});
    });
  });

  describe("Toggle preserves both authored CSS and authored initial state", () => {
    it("toggling the Dropdown menu open then closed never touches its own flowLayout or initialPreviewVisibility", () => {
      const dropdown = createDropdownButtonNode();
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [dropdown] } }));
      const [trigger, menu] = dropdown.children!;

      useEditorStore.getState().enterPreview();
      useEditorStore.getState().executeInteractionsForNode(trigger.id, "click");
      expect(useEditorStore.getState().runtimeVisibility[menu.id]).toBe(true);

      useEditorStore.getState().executeInteractionsForNode(trigger.id, "click");
      expect(useEditorStore.getState().runtimeVisibility[menu.id]).toBe(false);

      const stored = findNodeById(useEditorStore.getState().document, menu.id);
      expect(stored?.initialPreviewVisibility).toBe("hidden");
      expect(stored?.flowLayout).toEqual(menu.flowLayout);
    });
  });

  describe("Preview re-entry always reapplies the authored initial state", () => {
    it("opening the Dropdown, exiting Preview, and re-entering starts it closed again", () => {
      const dropdown = createDropdownButtonNode();
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [dropdown] } }));
      const [trigger, menu] = dropdown.children!;

      useEditorStore.getState().enterPreview();
      useEditorStore.getState().executeInteractionsForNode(trigger.id, "click");
      expect(useEditorStore.getState().runtimeVisibility[menu.id]).toBe(true);

      useEditorStore.getState().exitPreview();
      useEditorStore.getState().enterPreview();

      expect(useEditorStore.getState().runtimeVisibility[menu.id]).toBe(false);
    });
  });

  describe("Authored initial-state edits participate in history; Preview execution never does", () => {
    it("setInitialPreviewVisibility is one history entry, undo/redo restore it", () => {
      const dropdown = createDropdownButtonNode();
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [dropdown] } }));
      const [, menu] = dropdown.children!;
      const historyBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().setInitialPreviewVisibility(menu.id, "visible");
      expect(useEditorStore.getState().past.length).toBe(historyBefore + 1);
      expect(findNodeById(useEditorStore.getState().document, menu.id)?.initialPreviewVisibility).toBe("visible");

      useEditorStore.getState().undo();
      expect(findNodeById(useEditorStore.getState().document, menu.id)?.initialPreviewVisibility).toBe("hidden");

      useEditorStore.getState().redo();
      expect(findNodeById(useEditorStore.getState().document, menu.id)?.initialPreviewVisibility).toBe("visible");
    });

    it("a no-op authored update pushes zero history entries", () => {
      const dropdown = createDropdownButtonNode();
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [dropdown] } }));
      const [, menu] = dropdown.children!;
      const historyBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().setInitialPreviewVisibility(menu.id, "hidden");

      expect(useEditorStore.getState().past.length).toBe(historyBefore);
    });

    it("Preview show/hide/toggle execution never pushes history, regardless of authored initial state", () => {
      const dropdown = createDropdownButtonNode();
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [dropdown] } }));
      const [trigger] = dropdown.children!;
      useEditorStore.getState().enterPreview();
      const historyBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().executeInteractionsForNode(trigger.id, "click");
      useEditorStore.getState().executeInteractionsForNode(trigger.id, "click");

      expect(useEditorStore.getState().past.length).toBe(historyBefore);
    });
  });

  describe("Duplication preserves authored initial state (Part L)", () => {
    it("duplicating the whole Dropdown preserves the copied menu's own initialPreviewVisibility: hidden", () => {
      const dropdown = createDropdownButtonNode();
      useEditorStore.setState((state) => ({
        document: { ...state.document, children: [dropdown] },
        selection: { ids: [dropdown.id], primaryId: dropdown.id },
      }));

      useEditorStore.getState().duplicateSelection();

      const allChildren = useEditorStore.getState().document.children ?? [];
      const duplicate = allChildren.find((c) => c.id !== dropdown.id)!;
      const [, dupMenu] = duplicate.children!;

      expect(dupMenu.initialPreviewVisibility).toBe("hidden");
    });

    it("the two Dropdowns behave fully independently in Preview — opening the copy leaves the original closed", () => {
      const dropdown = createDropdownButtonNode();
      useEditorStore.setState((state) => ({
        document: { ...state.document, children: [dropdown] },
        selection: { ids: [dropdown.id], primaryId: dropdown.id },
      }));
      useEditorStore.getState().duplicateSelection();
      const allChildren = useEditorStore.getState().document.children ?? [];
      const duplicate = allChildren.find((c) => c.id !== dropdown.id)!;
      const [dupTrigger, dupMenu] = duplicate.children!;
      const [, originalMenu] = dropdown.children!;

      useEditorStore.getState().enterPreview();
      expect(useEditorStore.getState().runtimeVisibility[originalMenu.id]).toBe(false);
      expect(useEditorStore.getState().runtimeVisibility[dupMenu.id]).toBe(false);

      useEditorStore.getState().executeInteractionsForNode(dupTrigger.id, "click");

      expect(useEditorStore.getState().runtimeVisibility[dupMenu.id]).toBe(true);
      expect(useEditorStore.getState().runtimeVisibility[originalMenu.id]).toBe(false);
    });

    it("the duplicated binding gets a fresh id, and the copied Button targets the copied menu, not the original", () => {
      const dropdown = createDropdownButtonNode();
      useEditorStore.setState((state) => ({
        document: { ...state.document, children: [dropdown] },
        selection: { ids: [dropdown.id], primaryId: dropdown.id },
      }));

      useEditorStore.getState().duplicateSelection();

      const allChildren = useEditorStore.getState().document.children ?? [];
      const duplicate = allChildren.find((c) => c.id !== dropdown.id)!;
      const [dupTrigger, dupMenu] = duplicate.children!;
      const [origTrigger] = dropdown.children!;

      expect(dupTrigger.interactions![0].targetId).toBe(dupMenu.id);
      expect(dupTrigger.interactions![0].id).not.toBe(origTrigger.interactions![0].id);
    });
  });

  describe("Deletion cleanup for the real Dropdown composition (Part M)", () => {
    it("deleting the menu cleans the Button's binding generically; undo restores the menu, the binding, and the authored initial state together", () => {
      const dropdown = createDropdownButtonNode();
      useEditorStore.setState((state) => ({
        document: { ...state.document, children: [dropdown] },
        selection: { ids: [dropdown.children![1].id], primaryId: dropdown.children![1].id },
      }));
      const [trigger, menu] = dropdown.children!;
      const historyBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().deleteSelection();

      expect(useEditorStore.getState().past.length).toBe(historyBefore + 1);
      expect(findNodeById(useEditorStore.getState().document, menu.id)).toBeUndefined();
      expect(findNodeById(useEditorStore.getState().document, trigger.id)?.interactions).toBeUndefined();

      useEditorStore.getState().undo();
      const restoredMenu = findNodeById(useEditorStore.getState().document, menu.id);
      expect(restoredMenu?.initialPreviewVisibility).toBe("hidden");
      expect(findNodeById(useEditorStore.getState().document, trigger.id)?.interactions).toHaveLength(1);
    });

    it("deleting one Dropdown's menu never affects a second, independent Dropdown", () => {
      const dropdownA = createDropdownButtonNode();
      const dropdownB = createDropdownButtonNode();
      useEditorStore.setState((state) => ({
        document: { ...state.document, children: [dropdownA, dropdownB] },
        selection: { ids: [dropdownA.children![1].id], primaryId: dropdownA.children![1].id },
      }));
      const [triggerB, menuB] = dropdownB.children!;

      useEditorStore.getState().deleteSelection();

      expect(findNodeById(useEditorStore.getState().document, menuB.id)).toBeDefined();
      expect(findNodeById(useEditorStore.getState().document, triggerB.id)?.interactions).toHaveLength(1);
    });
  });

  describe("Style Protection leaves behavior metadata (both interactions and initial state) editable, and Preview execution working, under a lock", () => {
    it("locking the Dropdown root blocks descendant CSS but leaves initial-state editing and Preview toggling intact", () => {
      const dropdown = createDropdownButtonNode();
      dropdown.lockChildStyles = true;
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [dropdown] } }));
      const [trigger, menu] = dropdown.children!;

      useEditorStore.getState().setInitialPreviewVisibility(menu.id, "visible");
      expect(findNodeById(useEditorStore.getState().document, menu.id)?.initialPreviewVisibility).toBe("visible");

      useEditorStore.getState().setElementBackground(menu.id, { color: "#ff0000" });
      expect(findNodeById(useEditorStore.getState().document, menu.id)?.background?.color).not.toBe("#ff0000");

      // Menu was just switched to authored-visible above, so it starts
      // with no runtimeVisibility entry on Preview entry (undefined ==
      // effectively visible) — a toggle click from there makes it hidden.
      useEditorStore.getState().enterPreview();
      expect(useEditorStore.getState().runtimeVisibility[menu.id]).toBeUndefined();
      useEditorStore.getState().executeInteractionsForNode(trigger.id, "click");
      expect(useEditorStore.getState().runtimeVisibility[menu.id]).toBe(false);
    });
  });

  describe("Collapsible backward compatibility (Part R)", () => {
    it("Collapsible (which never authors initialPreviewVisibility) still starts visible in Preview and toggles exactly as in 1.15.6.8", () => {
      const collapsible = createCollapsibleNode();
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [collapsible] } }));
      const [trigger, content] = collapsible.children!;

      useEditorStore.getState().enterPreview();
      expect(useEditorStore.getState().runtimeVisibility[content.id]).toBeUndefined();

      useEditorStore.getState().executeInteractionsForNode(trigger.id, "click");
      expect(useEditorStore.getState().runtimeVisibility[content.id]).toBe(false);
    });
  });
});
