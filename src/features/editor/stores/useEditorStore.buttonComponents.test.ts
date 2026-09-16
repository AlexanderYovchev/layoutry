import { afterEach, describe, expect, it } from "vitest";
import {
  createButtonGroupNode,
  createDropdownButtonNode,
  createPrimaryButtonNode,
} from "@/features/editor/factories/buttonCompositions";
import { createNavNode } from "@/features/editor/factories/elementFactories";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { useEditorStore } from "./useEditorStore";

const initialState = useEditorStore.getState();

/**
 * Checkpoint 1.15.6.2 — Components -> Buttons, store-level integration.
 * The factories themselves (buttonCompositions.test.ts) already prove
 * the generated trees; this file proves the SURROUNDING architecture —
 * insertion/selection/history, resize compatibility (extending the
 * 1.15.6.1 Nav+Button regression to the new presets), duplication, and
 * Parent Style Protection — needed zero component-specific code, exactly
 * as this checkpoint's own brief requires.
 */
describe("Button Components — store integration (Checkpoint 1.15.6.2)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  describe("Insertion, selection, and history (sections 35-36)", () => {
    it("inserting a Button Group is one history entry and selects the group's own root Container, not any child Button", () => {
      const group = createButtonGroupNode();
      const historyLengthBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().insertElement("page-root", group);

      expect(useEditorStore.getState().past.length).toBe(historyLengthBefore + 1);
      expect(useEditorStore.getState().selection).toEqual({ ids: [group.id], primaryId: group.id });
    });

    it("inserting a Dropdown Button is one history entry and selects the dropdown's own root Container", () => {
      const dropdown = createDropdownButtonNode();
      const historyLengthBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().insertElement("page-root", dropdown);

      expect(useEditorStore.getState().past.length).toBe(historyLengthBefore + 1);
      expect(useEditorStore.getState().selection).toEqual({ ids: [dropdown.id], primaryId: dropdown.id });
    });

    it("undo removes the entire inserted composition; redo restores it whole", () => {
      const group = createButtonGroupNode();
      useEditorStore.getState().insertElement("page-root", group);
      expect(findNodeById(useEditorStore.getState().document, group.id)).toBeDefined();

      useEditorStore.getState().undo();
      expect(findNodeById(useEditorStore.getState().document, group.id)).toBeUndefined();
      expect(findNodeById(useEditorStore.getState().document, group.children![0].id)).toBeUndefined();

      useEditorStore.getState().redo();
      const restored = findNodeById(useEditorStore.getState().document, group.id);
      expect(restored?.children).toHaveLength(3);
    });
  });

  describe("Resize regression — extends the 1.15.6.1 Nav+Button fix to the new Button presets (section 63)", () => {
    it("a Primary Button inside a Flex-row Nav holds a manual resize, exactly like the plain Button primitive does", () => {
      const nav = createNavNode();
      nav.id = "nav-1";
      const button = createPrimaryButtonNode();
      button.id = "primary-button-1";
      nav.children = [button];

      useEditorStore.setState((state) => ({ document: { ...state.document, children: [nav] } }));
      useEditorStore.getState().setFlowDisplayMode("nav-1", "flex");

      useEditorStore.getState().resizeElement("primary-button-1", { preferredWidth: 140, preferredHeight: 48, offsetX: 0, offsetY: 0 });

      const resized = findNodeById(useEditorStore.getState().document, "primary-button-1");
      expect(resized?.dimensions).toEqual({ preferredWidth: 140, preferredHeight: 48, offsetX: 0, offsetY: 0 });
    });

    it("a Dropdown Button's root resizes correctly inside a Flex-row Nav", () => {
      const nav = createNavNode();
      nav.id = "nav-1";
      const dropdown = createDropdownButtonNode();
      dropdown.id = "dropdown-1";
      nav.children = [dropdown];

      useEditorStore.setState((state) => ({ document: { ...state.document, children: [nav] } }));
      useEditorStore.getState().setFlowDisplayMode("nav-1", "flex");

      useEditorStore.getState().resizeElement("dropdown-1", { preferredWidth: 220, preferredHeight: 180, offsetX: 0, offsetY: 0 });

      const resized = findNodeById(useEditorStore.getState().document, "dropdown-1");
      expect(resized?.dimensions).toEqual({ preferredWidth: 220, preferredHeight: 180, offsetX: 0, offsetY: 0 });
    });

    it("resizing one Button inside a Button Group never resizes its siblings", () => {
      const group = createButtonGroupNode();
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [group] } }));
      const [a, b, c] = group.children!;

      useEditorStore.getState().resizeElement(a.id, { preferredWidth: 90, preferredHeight: 44, offsetX: 0, offsetY: 0 });

      expect(findNodeById(useEditorStore.getState().document, a.id)?.dimensions).toBeDefined();
      expect(findNodeById(useEditorStore.getState().document, b.id)?.dimensions).toBeUndefined();
      expect(findNodeById(useEditorStore.getState().document, c.id)?.dimensions).toBeUndefined();
    });
  });

  describe("Duplication (section 58)", () => {
    function collectIds(node: { id: string; children?: unknown[] }): string[] {
      return [node.id, ...((node.children as typeof node[] | undefined) ?? []).flatMap(collectIds)];
    }

    it("duplicating a Button Group gives every node in the copy a fresh id, sharing none with the original", () => {
      const group = createButtonGroupNode();
      useEditorStore.setState((state) => ({
        document: { ...state.document, children: [group] },
        selection: { ids: [group.id], primaryId: group.id },
      }));

      useEditorStore.getState().duplicateSelection();

      const allChildren = useEditorStore.getState().document.children ?? [];
      expect(allChildren).toHaveLength(2);
      const duplicate = allChildren.find((c) => c.id !== group.id)!;
      expect(duplicate.tag).toBe("div");
      expect(duplicate.children).toHaveLength(3);

      const originalIds = collectIds(group);
      const duplicateIds = collectIds(duplicate);
      expect(duplicateIds.some((id) => originalIds.includes(id))).toBe(false);
      expect(new Set(duplicateIds).size).toBe(duplicateIds.length);
    });

    it("duplicating a Dropdown Button preserves its content/styling while giving every node a fresh id", () => {
      const dropdown = createDropdownButtonNode();
      useEditorStore.setState((state) => ({
        document: { ...state.document, children: [dropdown] },
        selection: { ids: [dropdown.id], primaryId: dropdown.id },
      }));

      useEditorStore.getState().duplicateSelection();

      const allChildren = useEditorStore.getState().document.children ?? [];
      const duplicate = allChildren.find((c) => c.id !== dropdown.id)!;
      expect(duplicate.flowLayout).toEqual(dropdown.flowLayout);
      const [originalTrigger] = dropdown.children!;
      const [duplicateTrigger] = duplicate.children!;
      expect(duplicateTrigger.text).toBe(originalTrigger.text);
      expect(duplicateTrigger.id).not.toBe(originalTrigger.id);
    });
  });

  describe("Parent Style Protection (section 31) — naturally applies, no component-specific guard", () => {
    it("blocks a direct style edit on a Button Group's child Button under a locked ancestor, and unblocks it once unlocked", () => {
      const group = createButtonGroupNode();
      const lockedContainer = { id: "locked-1", tag: "div", lockChildStyles: true, children: [group] };
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [lockedContainer] } }));

      const [firstButton] = group.children!;
      const historyLengthBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().setElementBackground(firstButton.id, { color: "#ff0000" });

      // Button Group's own children are plain, unstyled Button primitives
      // (see createButtonGroupNode) — the blocked edit leaves that
      // absence exactly as it was, rather than applying the attempted color.
      expect(findNodeById(useEditorStore.getState().document, firstButton.id)?.background).toBeUndefined();
      expect(useEditorStore.getState().past.length).toBe(historyLengthBefore);

      useEditorStore.getState().setElementLockChildStyles("locked-1", undefined);
      useEditorStore.getState().setElementBackground(firstButton.id, { color: "#ff0000" });
      expect(findNodeById(useEditorStore.getState().document, firstButton.id)?.background?.color).toBe("#ff0000");
    });
  });
});
