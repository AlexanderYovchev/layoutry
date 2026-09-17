import { afterEach, describe, expect, it } from "vitest";
import {
  createBasicCardNode,
  createHorizontalCardNode,
  createImageCardNode,
  createPricingCardNode,
} from "@/features/editor/factories/cardCompositions";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { useEditorStore } from "./useEditorStore";

const initialState = useEditorStore.getState();

/**
 * Checkpoint 1.15.6.4 — Components -> Cards & Content, store-level
 * integration. The factories themselves (cardCompositions.test.ts) already
 * prove the generated trees; this file proves the SURROUNDING architecture
 * — insertion/selection/history, Flex/Grid resize compatibility, Image
 * field survival through duplication/undo/redo, and Parent Style
 * Protection's "style blocked, content editable" invariant — needed zero
 * component-specific code, exactly as Buttons and Navigation did.
 */
describe("Card Components — store integration (Checkpoint 1.15.6.4)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  describe("Insertion, selection, and history (sections 44-46)", () => {
    it("inserting an Image Card is one history entry and selects the Card root, not the Image or any text child", () => {
      const card = createImageCardNode();
      const historyLengthBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().insertElement("page-root", card);

      expect(useEditorStore.getState().past.length).toBe(historyLengthBefore + 1);
      expect(useEditorStore.getState().selection).toEqual({ ids: [card.id], primaryId: card.id });
    });

    it("undo removes the entire inserted Card subtree; redo restores it whole", () => {
      const card = createImageCardNode();
      useEditorStore.getState().insertElement("page-root", card);
      expect(findNodeById(useEditorStore.getState().document, card.id)).toBeDefined();

      useEditorStore.getState().undo();
      expect(findNodeById(useEditorStore.getState().document, card.id)).toBeUndefined();
      const [, content] = card.children!;
      expect(findNodeById(useEditorStore.getState().document, content.id)).toBeUndefined();

      useEditorStore.getState().redo();
      const restored = findNodeById(useEditorStore.getState().document, card.id);
      expect(restored?.children).toHaveLength(2);
    });

    it("inserting a Card into a Free parent succeeds as one history entry, and no child ever receives Free layout/geometry of its own", () => {
      const freeParent = { id: "free-1", tag: "div", layoutMode: "free" as const, children: [] };
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [freeParent] } }));

      const card = createBasicCardNode();
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

  describe("Resize regression — extends the 1.15.6.1/1.15.6.1.1 fixes to real Card compositions (sections 62-67)", () => {
    it("resizing the Image inside a Horizontal Card holds the manual resize without its sibling content Container resizing", () => {
      const card = createHorizontalCardNode();
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [card] } }));
      const [image, content] = card.children!;

      useEditorStore.getState().resizeElement(image.id, { preferredWidth: 200, preferredHeight: 200, offsetX: 0, offsetY: 0 });

      expect(findNodeById(useEditorStore.getState().document, image.id)?.dimensions).toEqual({
        preferredWidth: 200,
        preferredHeight: 200,
        offsetX: 0,
        offsetY: 0,
      });
      expect(findNodeById(useEditorStore.getState().document, content.id)?.dimensions).toBeUndefined();
    });

    it("a Card root resizes correctly when placed inside a Grid parent, without being forced back to 100%", () => {
      const card = createBasicCardNode();
      card.id = "card-1";
      const grid = { id: "grid-1", tag: "div", flowLayout: { display: "grid" as const }, children: [card] };
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [grid] } }));

      useEditorStore.getState().resizeElement("card-1", { preferredWidth: 320, preferredHeight: 220, offsetX: 0, offsetY: 0 });

      const resized = findNodeById(useEditorStore.getState().document, "card-1");
      expect(resized?.dimensions).toEqual({ preferredWidth: 320, preferredHeight: 220, offsetX: 0, offsetY: 0 });
    });

    it("resizing a Pricing Card's Button never resizes its sibling feature list", () => {
      const card = createPricingCardNode();
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [card] } }));
      const [, , , list, cta] = card.children!;

      useEditorStore.getState().resizeElement(cta.id, { preferredWidth: 160, preferredHeight: 48, offsetX: 0, offsetY: 0 });

      expect(findNodeById(useEditorStore.getState().document, cta.id)?.dimensions).toBeDefined();
      expect(findNodeById(useEditorStore.getState().document, list.id)?.dimensions).toBeUndefined();
    });
  });

  describe("Duplication (sections 76-77) — Image fields survive undo/redo and duplication", () => {
    function collectIds(node: { id: string; children?: unknown[] }): string[] {
      return [node.id, ...((node.children as typeof node[] | undefined) ?? []).flatMap(collectIds)];
    }

    it("duplicating an Image Card gives every node in the copy a fresh id, sharing none with the original, and preserves the Image's aspectRatio/mediaFit fields", () => {
      const card = createImageCardNode();
      useEditorStore.setState((state) => ({
        document: { ...state.document, children: [card] },
        selection: { ids: [card.id], primaryId: card.id },
      }));

      useEditorStore.getState().duplicateSelection();

      const allChildren = useEditorStore.getState().document.children ?? [];
      expect(allChildren).toHaveLength(2);
      const duplicate = allChildren.find((c) => c.id !== card.id)!;
      const [originalImage] = card.children!;
      const [duplicateImage] = duplicate.children!;
      expect(duplicateImage.tag).toBe("img");
      expect(duplicateImage.aspectRatio).toEqual(originalImage.aspectRatio);
      expect(duplicateImage.mediaFit).toEqual(originalImage.mediaFit);
      expect(duplicateImage.id).not.toBe(originalImage.id);

      const originalIds = collectIds(card);
      const duplicateIds = collectIds(duplicate);
      expect(duplicateIds.some((id) => originalIds.includes(id))).toBe(false);
      expect(new Set(duplicateIds).size).toBe(duplicateIds.length);
    });

    it("a Pricing Card's Image/text fields survive an undo/redo round trip unchanged", () => {
      const card = createPricingCardNode();
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [card] } }));
      const [planName] = card.children!;

      useEditorStore.getState().setElementText(planName.id, "Pro");
      useEditorStore.getState().undo();
      expect(findNodeById(useEditorStore.getState().document, planName.id)?.text).toBe("Starter");

      useEditorStore.getState().redo();
      expect(findNodeById(useEditorStore.getState().document, planName.id)?.text).toBe("Pro");
    });

    it("editing a duplicated Basic Card's Link text never affects the original", () => {
      const card = createBasicCardNode();
      useEditorStore.setState((state) => ({
        document: { ...state.document, children: [card] },
        selection: { ids: [card.id], primaryId: card.id },
      }));

      useEditorStore.getState().duplicateSelection();
      const allChildren = useEditorStore.getState().document.children ?? [];
      const duplicate = allChildren.find((c) => c.id !== card.id)!;
      const duplicateLink = duplicate.children![2];

      useEditorStore.getState().setElementText(duplicateLink.id, "Read More");

      expect(findNodeById(useEditorStore.getState().document, card.children![2].id)?.text).toBe("Learn More");
      expect(findNodeById(useEditorStore.getState().document, duplicateLink.id)?.text).toBe("Read More");
    });
  });

  describe("Parent Style Protection (sections 73-75) — style blocked, content editing remains allowed", () => {
    it("blocks a direct style edit on a Card's child Heading under a locked Card root, but leaves its text editable", () => {
      const card = createBasicCardNode();
      card.lockChildStyles = true;
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [card] } }));

      const [heading] = card.children!;
      const originalColor = heading.typography?.color;
      const historyLengthBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().setElementTypography(heading.id, { color: "#ff0000" });
      expect(findNodeById(useEditorStore.getState().document, heading.id)?.typography?.color).toBe(originalColor);
      expect(useEditorStore.getState().past.length).toBe(historyLengthBefore);

      // Content editing (not style) must remain unaffected by the lock.
      useEditorStore.getState().setElementText(heading.id, "New Title");
      expect(findNodeById(useEditorStore.getState().document, heading.id)?.text).toBe("New Title");

      useEditorStore.getState().setElementLockChildStyles(card.id, undefined);
      useEditorStore.getState().setElementTypography(heading.id, { color: "#ff0000" });
      expect(findNodeById(useEditorStore.getState().document, heading.id)?.typography?.color).toBe("#ff0000");
    });

    it("a Card root under its OWN lock remains style-editable itself; only its descendants are protected", () => {
      const card = createBasicCardNode();
      card.lockChildStyles = true;
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [card] } }));

      useEditorStore.getState().setElementBackground(card.id, { color: "#f4f4f5" });
      expect(findNodeById(useEditorStore.getState().document, card.id)?.background?.color).toBe("#f4f4f5");
    });
  });

  describe("Pricing state (section 31) — confirms no runtime pricing state exists on the store either", () => {
    it("the store has no pricing-specific action; the plan/price/features are purely the node's own authored text", () => {
      const card = createPricingCardNode();
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [card] } }));

      const store = useEditorStore.getState() as unknown as Record<string, unknown>;
      expect(store.setPricingPlan).toBeUndefined();
      expect(store.setActivePricingTier).toBeUndefined();
    });
  });
});
