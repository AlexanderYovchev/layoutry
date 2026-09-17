import { afterEach, describe, expect, it } from "vitest";
import {
  createAvatarNode,
  createAvatarWithTextNode,
  createStatCardNode,
} from "@/features/editor/factories/dataDisplayCompositions";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { useEditorStore } from "./useEditorStore";

const initialState = useEditorStore.getState();

/**
 * Checkpoint 1.15.6.6 — Components -> Data Display, store-level
 * integration. The factories themselves (dataDisplayCompositions.test.ts)
 * already prove the generated trees; this file proves the SURROUNDING
 * architecture — insertion/selection/history, Flex resize independence
 * (Avatar with Text's fixed avatar column vs its growing text column),
 * Grid resize compatibility, duplication with fresh recursive ids, and
 * Parent Style Protection's "style blocked, content editable" invariant
 * across BOTH contentEditable text (a Stat Card Paragraph) AND the
 * Avatar's own native `src` field (proven NOT blocked by style lock,
 * confirming it stays semantic/content data per section 76) — needed
 * zero component-specific code, exactly as Buttons/Navigation/Cards/Forms
 * already established.
 */
describe("Data Display Components — store integration (Checkpoint 1.15.6.6)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  describe("Insertion, selection, and history", () => {
    it("inserting a Stat Card is one history entry and selects the card root", () => {
      const card = createStatCardNode();
      const historyLengthBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().insertElement("page-root", card);

      expect(useEditorStore.getState().past.length).toBe(historyLengthBefore + 1);
      expect(useEditorStore.getState().selection).toEqual({ ids: [card.id], primaryId: card.id });
    });

    it("inserting a standalone Avatar selects the Image itself, since the Image IS the composition root", () => {
      const avatar = createAvatarNode();
      useEditorStore.getState().insertElement("page-root", avatar);

      expect(useEditorStore.getState().selection).toEqual({ ids: [avatar.id], primaryId: avatar.id });
      expect(findNodeById(useEditorStore.getState().document, avatar.id)?.tag).toBe("img");
    });

    it("undo removes the entire inserted Avatar with Text subtree; redo restores it whole", () => {
      const identity = createAvatarWithTextNode();
      useEditorStore.getState().insertElement("page-root", identity);
      expect(findNodeById(useEditorStore.getState().document, identity.id)).toBeDefined();

      useEditorStore.getState().undo();
      expect(findNodeById(useEditorStore.getState().document, identity.id)).toBeUndefined();
      const [, textGroup] = identity.children!;
      expect(findNodeById(useEditorStore.getState().document, textGroup.id)).toBeUndefined();

      useEditorStore.getState().redo();
      const restored = findNodeById(useEditorStore.getState().document, identity.id);
      expect(restored?.children).toHaveLength(2);
    });

    it("inserting a Stat Card into a Free parent succeeds as one history entry, and no child ever receives Free layout/geometry of its own", () => {
      const freeParent = { id: "free-1", tag: "div", layoutMode: "free" as const, children: [] };
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [freeParent] } }));

      const card = createStatCardNode();
      const historyLengthBefore = useEditorStore.getState().past.length;
      useEditorStore.getState().insertElement("free-1", card);

      expect(useEditorStore.getState().past.length).toBe(historyLengthBefore + 1);
      const inserted = findNodeById(useEditorStore.getState().document, card.id);
      for (const child of inserted?.children ?? []) {
        expect(child.layoutMode).not.toBe("free");
        expect(child.dimensions).toBeUndefined();
      }
    });
  });

  describe("Resize regression — Avatar with Text's Image/text Flex independence, and Grid", () => {
    it("resizing the avatar Image holds the manual resize without its sibling text group resizing", () => {
      const identity = createAvatarWithTextNode();
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [identity] } }));
      const [avatar, textGroup] = identity.children!;

      useEditorStore.getState().resizeElement(avatar.id, { preferredWidth: 80, preferredHeight: 80, offsetX: 0, offsetY: 0 });

      expect(findNodeById(useEditorStore.getState().document, avatar.id)?.dimensions).toEqual({
        preferredWidth: 80,
        preferredHeight: 80,
        offsetX: 0,
        offsetY: 0,
      });
      expect(findNodeById(useEditorStore.getState().document, textGroup.id)?.dimensions).toBeUndefined();
    });

    it("resizing the text group holds the manual resize without its sibling avatar Image resizing", () => {
      const identity = createAvatarWithTextNode();
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [identity] } }));
      const [avatar, textGroup] = identity.children!;

      useEditorStore.getState().resizeElement(textGroup.id, { preferredWidth: 220, preferredHeight: 60, offsetX: 0, offsetY: 0 });

      expect(findNodeById(useEditorStore.getState().document, textGroup.id)?.dimensions).toBeDefined();
      expect(findNodeById(useEditorStore.getState().document, avatar.id)?.dimensions).toBeUndefined();
    });

    it("a Stat Card root resizes correctly when placed inside a Grid parent, without being forced back to 100%", () => {
      const card = createStatCardNode();
      card.id = "stat-1";
      const grid = { id: "grid-1", tag: "div", flowLayout: { display: "grid" as const }, children: [card] };
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [grid] } }));

      useEditorStore.getState().resizeElement("stat-1", { preferredWidth: 260, preferredHeight: 160, offsetX: 0, offsetY: 0 });

      const resized = findNodeById(useEditorStore.getState().document, "stat-1");
      expect(resized?.dimensions).toEqual({ preferredWidth: 260, preferredHeight: 160, offsetX: 0, offsetY: 0 });
    });
  });

  describe("Duplication — fresh recursive ids, no shared mutable tree", () => {
    function collectIds(node: { id: string; children?: unknown[] }): string[] {
      return [node.id, ...((node.children as typeof node[] | undefined) ?? []).flatMap(collectIds)];
    }

    it("duplicating an Avatar with Text gives every node in the copy a fresh id, sharing none with the original", () => {
      const identity = createAvatarWithTextNode();
      useEditorStore.setState((state) => ({
        document: { ...state.document, children: [identity] },
        selection: { ids: [identity.id], primaryId: identity.id },
      }));

      useEditorStore.getState().duplicateSelection();

      const allChildren = useEditorStore.getState().document.children ?? [];
      expect(allChildren).toHaveLength(2);
      const duplicate = allChildren.find((c) => c.id !== identity.id)!;

      const originalIds = collectIds(identity);
      const duplicateIds = collectIds(duplicate);
      expect(duplicateIds.some((id) => originalIds.includes(id))).toBe(false);
      expect(new Set(duplicateIds).size).toBe(duplicateIds.length);
    });

    it("editing a duplicated Stat Card's value text never affects the original", () => {
      const card = createStatCardNode();
      useEditorStore.setState((state) => ({
        document: { ...state.document, children: [card] },
        selection: { ids: [card.id], primaryId: card.id },
      }));

      useEditorStore.getState().duplicateSelection();
      const allChildren = useEditorStore.getState().document.children ?? [];
      const duplicate = allChildren.find((c) => c.id !== card.id)!;
      const duplicateValue = duplicate.children![1];

      useEditorStore.getState().setElementText(duplicateValue.id, "99,999");

      expect(findNodeById(useEditorStore.getState().document, card.children![1].id)?.text).toBe("12,450");
      expect(findNodeById(useEditorStore.getState().document, duplicateValue.id)?.text).toBe("99,999");
    });
  });

  describe("Parent Style Protection — style blocked, semantic content editing (contentEditable text AND Image src) remains allowed", () => {
    it("blocks a direct style edit on a Stat Card's value Paragraph under a locked Stat Card root, but leaves its text editable", () => {
      const card = createStatCardNode();
      card.lockChildStyles = true;
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [card] } }));

      const [, valueNode] = card.children!;
      const originalColor = valueNode.typography?.color;
      const historyLengthBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().setElementTypography(valueNode.id, { color: "#ff0000" });
      expect(findNodeById(useEditorStore.getState().document, valueNode.id)?.typography?.color).toBe(originalColor);
      expect(useEditorStore.getState().past.length).toBe(historyLengthBefore);

      useEditorStore.getState().setElementText(valueNode.id, "20,000");
      expect(findNodeById(useEditorStore.getState().document, valueNode.id)?.text).toBe("20,000");

      useEditorStore.getState().setElementLockChildStyles(card.id, undefined);
      useEditorStore.getState().setElementTypography(valueNode.id, { color: "#ff0000" });
      expect(findNodeById(useEditorStore.getState().document, valueNode.id)?.typography?.color).toBe("#ff0000");
    });

    it("blocks a direct style edit on an Avatar with Text's Image under a locked root, but leaves its `src` semantic field editable", () => {
      const identity = createAvatarWithTextNode();
      identity.lockChildStyles = true;
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [identity] } }));

      const [avatar] = identity.children!;
      const historyLengthBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().setElementBorderRadius(avatar.id, undefined);
      expect(findNodeById(useEditorStore.getState().document, avatar.id)?.borderRadius).toBeDefined();
      expect(useEditorStore.getState().past.length).toBe(historyLengthBefore);

      useEditorStore.getState().setElementSrc(avatar.id, "data:image/svg+xml;utf8,new-avatar");
      expect(findNodeById(useEditorStore.getState().document, avatar.id)?.src).toBe("data:image/svg+xml;utf8,new-avatar");
    });

    it("a component root under its OWN lock remains style-editable itself; only its descendants are protected", () => {
      const card = createStatCardNode();
      card.lockChildStyles = true;
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [card] } }));

      useEditorStore.getState().setElementBackground(card.id, { color: "#f4f4f5" });
      expect(findNodeById(useEditorStore.getState().document, card.id)?.background?.color).toBe("#f4f4f5");
    });
  });

  describe("Runtime behavior — confirms no live progress/status/data-binding state exists on the store either", () => {
    it("the store has no Data-Display-composition-specific action for progress, status, or data binding", () => {
      const card = createStatCardNode();
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [card] } }));

      const store = useEditorStore.getState() as unknown as Record<string, unknown>;
      expect(store.setProgressValue).toBeUndefined();
      expect(store.setStatValue).toBeUndefined();
      expect(store.bindData).toBeUndefined();
      expect(store.setBadgeVariant).toBeUndefined();
    });
  });
});
