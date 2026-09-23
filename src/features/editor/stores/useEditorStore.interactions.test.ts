import { afterEach, describe, expect, it } from "vitest";
import { createCollapsibleNode } from "@/features/editor/factories/interactionCompositions";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { useEditorStore } from "./useEditorStore";

const initialState = useEditorStore.getState();

/**
 * Checkpoint 1.15.6.8 — the generic Interaction & Preview foundation.
 * Proves the three-way state separation the 1.15.6.7 audit designed:
 * authored bindings are persistent/history-aware document data;
 * editorMode is editor UI state, outside history entirely; runtime
 * visibility is ephemeral Preview-only state, also outside history.
 */
describe("Interaction & Preview foundation — store integration (Checkpoint 1.15.6.8)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  describe("Editor Mode — outside document history", () => {
    it("defaults to design", () => {
      expect(useEditorStore.getState().editorMode).toBe("design");
    });

    it("enterPreview/exitPreview change mode without pushing history", () => {
      const historyBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().enterPreview();
      expect(useEditorStore.getState().editorMode).toBe("preview");
      expect(useEditorStore.getState().past.length).toBe(historyBefore);

      useEditorStore.getState().exitPreview();
      expect(useEditorStore.getState().editorMode).toBe("design");
      expect(useEditorStore.getState().past.length).toBe(historyBefore);
    });

    it("enterPreview resets runtimeVisibility to empty (deterministic start)", () => {
      useEditorStore.setState({ runtimeVisibility: { "some-id": false } });
      useEditorStore.getState().enterPreview();
      expect(useEditorStore.getState().runtimeVisibility).toEqual({});
    });

    it("does not clear selection on Preview entry (least-destructive choice)", () => {
      useEditorStore.setState({ selection: { ids: ["node-1"], primaryId: "node-1" } });
      useEditorStore.getState().enterPreview();
      expect(useEditorStore.getState().selection).toEqual({ ids: ["node-1"], primaryId: "node-1" });
    });

    it("enterPreview safely exits SVG Edit Mode", () => {
      useEditorStore.setState({ svgEditingNodeId: "svg-1", selectedSvgObjectIds: ["rect-1"] });
      useEditorStore.getState().enterPreview();
      expect(useEditorStore.getState().svgEditingNodeId).toBeNull();
      expect(useEditorStore.getState().selectedSvgObjectIds).toEqual([]);
    });
  });

  describe("Binding CRUD — history-aware document data", () => {
    it("addInteraction is one history entry; undo removes it, redo restores it", () => {
      const collapsible = createCollapsibleNode();
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [collapsible] } }));
      const [trigger] = collapsible.children!;
      const historyBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().addInteraction(trigger.id, { trigger: "click", action: "show", targetId: "some-target" });
      expect(useEditorStore.getState().past.length).toBe(historyBefore + 1);
      const afterAdd = findNodeById(useEditorStore.getState().document, trigger.id);
      expect(afterAdd?.interactions).toHaveLength(2);

      useEditorStore.getState().undo();
      expect(findNodeById(useEditorStore.getState().document, trigger.id)?.interactions).toHaveLength(1);

      useEditorStore.getState().redo();
      expect(findNodeById(useEditorStore.getState().document, trigger.id)?.interactions).toHaveLength(2);
    });

    it("updateInteraction is one history entry; a true no-op update pushes zero", () => {
      const collapsible = createCollapsibleNode();
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [collapsible] } }));
      const [trigger] = collapsible.children!;
      const bindingId = trigger.interactions![0].id;
      const historyBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().updateInteraction(trigger.id, bindingId, { action: "hide" });
      expect(useEditorStore.getState().past.length).toBe(historyBefore + 1);
      expect(findNodeById(useEditorStore.getState().document, trigger.id)?.interactions![0].action).toBe("hide");

      const historyAfterFirstUpdate = useEditorStore.getState().past.length;
      useEditorStore.getState().updateInteraction(trigger.id, bindingId, { action: "hide" });
      expect(useEditorStore.getState().past.length).toBe(historyAfterFirstUpdate);
    });

    it("removeInteraction is one history entry", () => {
      const collapsible = createCollapsibleNode();
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [collapsible] } }));
      const [trigger] = collapsible.children!;
      const bindingId = trigger.interactions![0].id;
      const historyBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().removeInteraction(trigger.id, bindingId);

      expect(useEditorStore.getState().past.length).toBe(historyBefore + 1);
      expect(findNodeById(useEditorStore.getState().document, trigger.id)?.interactions).toBeUndefined();
    });

    it("binding CRUD is never blocked by Parent Style Protection, even under an ancestor lock", () => {
      const collapsible = createCollapsibleNode();
      collapsible.lockChildStyles = true;
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [collapsible] } }));
      const [trigger] = collapsible.children!;

      useEditorStore.getState().addInteraction(trigger.id, { trigger: "click", action: "show", targetId: "another-target" });

      expect(findNodeById(useEditorStore.getState().document, trigger.id)?.interactions).toHaveLength(2);
    });
  });

  describe("Preview execution (executeInteractionsForNode) — ephemeral, never document/history", () => {
    it("toggle flips runtimeVisibility without touching the document or history", () => {
      const collapsible = createCollapsibleNode();
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [collapsible] } }));
      const [trigger, content] = collapsible.children!;
      const documentBefore = useEditorStore.getState().document;
      const historyBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().executeInteractionsForNode(trigger.id, "click");

      expect(useEditorStore.getState().runtimeVisibility[content.id]).toBe(false);
      expect(useEditorStore.getState().document).toBe(documentBefore);
      expect(useEditorStore.getState().past.length).toBe(historyBefore);

      useEditorStore.getState().executeInteractionsForNode(trigger.id, "click");
      expect(useEditorStore.getState().runtimeVisibility[content.id]).toBe(true);
    });

    it("show always sets visible true; hide always sets visible false, regardless of current state", () => {
      const button: import("@/features/editor/types/document").EditorElementNode = {
        id: "button-1",
        tag: "button",
        interactions: [{ id: "int-1", trigger: "click", action: "show", targetId: "target-1" }],
      };
      const target: import("@/features/editor/types/document").EditorElementNode = { id: "target-1", tag: "div" };
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [button, target] } }));

      // Starts already-hidden so "show" performs a genuine transition —
      // a target with no runtimeVisibility entry at all is ALSO
      // effectively visible (the default), so "show" on an
      // already-effectively-visible target is a legitimate no-op write
      // (see executeInteractionsForNode's own no-op guard); this test is
      // about the actual true/false transition, not the raw map shape.
      useEditorStore.setState({ runtimeVisibility: { "target-1": false } });
      useEditorStore.getState().executeInteractionsForNode("button-1", "click");
      expect(useEditorStore.getState().runtimeVisibility["target-1"]).toBe(true);

      useEditorStore.getState().updateInteraction("button-1", "int-1", { action: "hide" });
      useEditorStore.getState().executeInteractionsForNode("button-1", "click");
      expect(useEditorStore.getState().runtimeVisibility["target-1"]).toBe(false);
    });

    it("safely no-ops when the target no longer exists — no crash, no runtimeVisibility write", () => {
      const button: import("@/features/editor/types/document").EditorElementNode = {
        id: "button-1",
        tag: "button",
        interactions: [{ id: "int-1", trigger: "click", action: "toggle", targetId: "nonexistent-target" }],
      };
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [button] } }));

      expect(() => useEditorStore.getState().executeInteractionsForNode("button-1", "click")).not.toThrow();
      expect(useEditorStore.getState().runtimeVisibility["nonexistent-target"]).toBeUndefined();
    });

    it("is a no-op when the node has no bindings, or none matching the given trigger", () => {
      const button: import("@/features/editor/types/document").EditorElementNode = { id: "button-1", tag: "button" };
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [button] } }));

      const before = useEditorStore.getState().runtimeVisibility;
      useEditorStore.getState().executeInteractionsForNode("button-1", "click");
      expect(useEditorStore.getState().runtimeVisibility).toBe(before);
    });

    it("still executes for a node under an ancestor's style lock — Style Protection never blocks runtime execution", () => {
      const collapsible = createCollapsibleNode();
      collapsible.lockChildStyles = true;
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [collapsible] } }));
      const [trigger, content] = collapsible.children!;

      useEditorStore.getState().executeInteractionsForNode(trigger.id, "click");

      expect(useEditorStore.getState().runtimeVisibility[content.id]).toBe(false);
    });
  });

  describe("Target deletion cleanup — atomic with the deletion itself (sections 36-37)", () => {
    it("deleting the target node cleans the trigger's binding in the SAME history entry; undo restores both together", () => {
      const collapsible = createCollapsibleNode();
      useEditorStore.setState((state) => ({
        document: { ...state.document, children: [collapsible] },
        selection: { ids: [collapsible.children![1].id], primaryId: collapsible.children![1].id },
      }));
      const [trigger, content] = collapsible.children!;
      const historyBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().deleteSelection();

      expect(useEditorStore.getState().past.length).toBe(historyBefore + 1);
      expect(findNodeById(useEditorStore.getState().document, content.id)).toBeUndefined();
      expect(findNodeById(useEditorStore.getState().document, trigger.id)?.interactions).toBeUndefined();

      useEditorStore.getState().undo();
      expect(findNodeById(useEditorStore.getState().document, content.id)).toBeDefined();
      expect(findNodeById(useEditorStore.getState().document, trigger.id)?.interactions).toHaveLength(1);

      useEditorStore.getState().redo();
      expect(findNodeById(useEditorStore.getState().document, content.id)).toBeUndefined();
      expect(findNodeById(useEditorStore.getState().document, trigger.id)?.interactions).toBeUndefined();
    });

    it("deleting a subtree containing the target cleans bindings targeting any node nested inside it", () => {
      const collapsible = createCollapsibleNode();
      const [trigger, content] = collapsible.children!;
      const wrapper = { id: "wrapper-1", tag: "div", children: [content] };
      useEditorStore.setState((state) => ({
        document: { ...state.document, children: [trigger, wrapper] },
        selection: { ids: ["wrapper-1"], primaryId: "wrapper-1" },
      }));

      useEditorStore.getState().deleteSelection();

      expect(findNodeById(useEditorStore.getState().document, trigger.id)?.interactions).toBeUndefined();
    });

    it("cutSelection cleans bindings targeting the cut node the same way deleteSelection does", () => {
      const collapsible = createCollapsibleNode();
      useEditorStore.setState((state) => ({
        document: { ...state.document, children: [collapsible] },
        selection: { ids: [collapsible.children![1].id], primaryId: collapsible.children![1].id },
      }));
      const [trigger] = collapsible.children!;

      useEditorStore.getState().cutSelection();

      expect(findNodeById(useEditorStore.getState().document, trigger.id)?.interactions).toBeUndefined();
    });

    it("does not clean a binding targeting a node that was NOT deleted", () => {
      const collapsible = createCollapsibleNode();
      const decoy = { id: "decoy-1", tag: "div" };
      useEditorStore.setState((state) => ({
        document: { ...state.document, children: [collapsible, decoy] },
        selection: { ids: ["decoy-1"], primaryId: "decoy-1" },
      }));
      const [trigger] = collapsible.children!;

      useEditorStore.getState().deleteSelection();

      expect(findNodeById(useEditorStore.getState().document, trigger.id)?.interactions).toHaveLength(1);
    });
  });

  describe("Duplication reference remapping (Part I) via the real store command", () => {
    it("duplicating the whole Collapsible remaps the copied Button to target the copied Content, not the original", () => {
      const collapsible = createCollapsibleNode();
      useEditorStore.setState((state) => ({
        document: { ...state.document, children: [collapsible] },
        selection: { ids: [collapsible.id], primaryId: collapsible.id },
      }));

      useEditorStore.getState().duplicateSelection();

      const allChildren = useEditorStore.getState().document.children ?? [];
      expect(allChildren).toHaveLength(2);
      const duplicate = allChildren.find((c) => c.id !== collapsible.id)!;
      const [dupTrigger, dupContent] = duplicate.children!;

      expect(dupTrigger.interactions![0].targetId).toBe(dupContent.id);
      expect(dupTrigger.interactions![0].targetId).not.toBe(collapsible.children![1].id);
    });

    it("duplicating only the trigger (external target outside the duplicated subtree) keeps the copy pointed at the original external target", () => {
      const collapsible = createCollapsibleNode();
      const [trigger, content] = collapsible.children!;
      useEditorStore.setState((state) => ({
        document: { ...state.document, children: [trigger, content] },
        selection: { ids: [trigger.id], primaryId: trigger.id },
      }));

      useEditorStore.getState().duplicateSelection();

      const allChildren = useEditorStore.getState().document.children ?? [];
      const duplicateTrigger = allChildren.find((c) => c.id !== trigger.id && c.id !== content.id)!;

      expect(duplicateTrigger.interactions![0].targetId).toBe(content.id);
    });

    it("toggling the duplicated Collapsible in Preview never affects the original's runtime visibility", () => {
      const collapsible = createCollapsibleNode();
      useEditorStore.setState((state) => ({
        document: { ...state.document, children: [collapsible] },
        selection: { ids: [collapsible.id], primaryId: collapsible.id },
      }));
      useEditorStore.getState().duplicateSelection();
      const allChildren = useEditorStore.getState().document.children ?? [];
      const duplicate = allChildren.find((c) => c.id !== collapsible.id)!;
      const [dupTrigger, dupContent] = duplicate.children!;
      const [, originalContent] = collapsible.children!;

      useEditorStore.getState().executeInteractionsForNode(dupTrigger.id, "click");

      expect(useEditorStore.getState().runtimeVisibility[dupContent.id]).toBe(false);
      expect(useEditorStore.getState().runtimeVisibility[originalContent.id]).toBeUndefined();
    });
  });

  describe("Runtime behavior confirmation", () => {
    it("the store has no component-specific behavior state such as collapsibleOpen/dropdownOpen", () => {
      const collapsible = createCollapsibleNode();
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [collapsible] } }));
      const store = useEditorStore.getState() as unknown as Record<string, unknown>;
      expect(store.collapsibleOpen).toBeUndefined();
      expect(store.dropdownOpen).toBeUndefined();
      expect(store.setModalOpen).toBeUndefined();
    });
  });
});
