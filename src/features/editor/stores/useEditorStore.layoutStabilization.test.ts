import { afterEach, describe, expect, it } from "vitest";
import {
  createButtonNode,
  createFooterCompositionNode,
  createNavNode,
  createOrderedListNode,
  createUnorderedListNode,
} from "@/features/editor/factories/elementFactories";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { useEditorStore } from "./useEditorStore";

const initialState = useEditorStore.getState();

/**
 * Checkpoint 1.15.6.1 — Layout, Resizing & Container Content
 * Stabilization. Permanent regression coverage for the two problems the
 * checkpoint's own brief named explicitly (sections 48/49): a Button
 * inside a Nav failing to hold a manual resize once Nav's Content Layout
 * is Flex, and two sibling Lists appearing "linked" during multi-
 * selection/resize. See resolveFlexOrGridChildStyle.test.ts and
 * DocumentNodeRenderer.test.tsx for the lower-level resolver/renderer
 * regression tests these two scenarios are built on top of.
 */
describe("useEditorStore — Layout/Resizing Stabilization regressions (Checkpoint 1.15.6.1)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  describe("Nav + Button resize (section 48)", () => {
    function seedNavWithButton() {
      const nav = createNavNode();
      nav.id = "nav-1";
      const button = createButtonNode();
      button.id = "button-1";
      nav.children = [button];

      useEditorStore.setState((state) => ({
        document: { ...state.document, children: [nav] },
      }));
      return { nav, button };
    }

    it("persists a manual width/height resize on a Button child of a Flex-row Nav, and undo/redo restore it correctly", () => {
      seedNavWithButton();
      useEditorStore.getState().setFlowDisplayMode("nav-1", "flex");

      useEditorStore.getState().resizeElement("button-1", { preferredWidth: 120, preferredHeight: 44, offsetX: 0, offsetY: 0 });

      let button = findNodeById(useEditorStore.getState().document, "button-1");
      expect(button?.dimensions).toEqual({ preferredWidth: 120, preferredHeight: 44, offsetX: 0, offsetY: 0 });

      useEditorStore.getState().undo();
      button = findNodeById(useEditorStore.getState().document, "button-1");
      expect(button?.dimensions).toBeUndefined();

      useEditorStore.getState().redo();
      button = findNodeById(useEditorStore.getState().document, "button-1");
      expect(button?.dimensions).toEqual({ preferredWidth: 120, preferredHeight: 44, offsetX: 0, offsetY: 0 });
    });

    it("resizing the Button leaves the Nav's own document state (its flowLayout/spacing) untouched", () => {
      const { nav } = seedNavWithButton();
      useEditorStore.getState().setFlowDisplayMode("nav-1", "flex");
      const navBeforeResize = findNodeById(useEditorStore.getState().document, "nav-1");

      useEditorStore.getState().resizeElement("button-1", { preferredWidth: 90, preferredHeight: 36, offsetX: 0, offsetY: 0 });

      const navAfterResize = findNodeById(useEditorStore.getState().document, "nav-1");
      expect(navAfterResize?.flowLayout).toEqual(navBeforeResize?.flowLayout);
      expect(navAfterResize?.spacing).toEqual(nav.spacing);
      expect(navAfterResize?.dimensions).toBeUndefined();
    });

    it("resizing the Button in Flow (Block), Flex, and Grid Nav modes all persist the exact dragged size (Checkpoint 1.15.6.1 root-cause fix — Flex previously reverted flexShrink to the container default, Grid previously forced width/height to 100%)", () => {
      for (const display of ["block", "flex", "grid"] as const) {
        seedNavWithButton();
        if (display !== "block") {
          useEditorStore.getState().setFlowDisplayMode("nav-1", display);
        }

        useEditorStore.getState().resizeElement("button-1", { preferredWidth: 75, preferredHeight: 32, offsetX: 0, offsetY: 0 });

        const button = findNodeById(useEditorStore.getState().document, "button-1");
        expect(button?.dimensions?.preferredWidth).toBe(75);
        expect(button?.dimensions?.preferredHeight).toBe(32);

        useEditorStore.setState(initialState, true);
      }
    });
  });

  describe("Two sibling Lists — multi-selection and independent resize (section 49)", () => {
    function seedTwoLists() {
      const container = createButtonNode();
      container.id = "container-1";
      container.tag = "div";
      delete container.text;
      const ul = createUnorderedListNode();
      ul.id = "ul-1";
      const ol = createOrderedListNode();
      ol.id = "ol-1";
      container.children = [ul, ol];

      useEditorStore.setState((state) => ({
        document: { ...state.document, children: [container] },
      }));
    }

    it("Ctrl/Cmd-selecting both lists makes both members explicit in selection.ids, with only one primaryId", () => {
      seedTwoLists();
      useEditorStore.getState().selectOnly("ul-1");
      useEditorStore.getState().toggleSelection("ol-1");

      const selection = useEditorStore.getState().selection;
      expect(selection.ids.sort()).toEqual(["ol-1", "ul-1"]);
      expect(selection.ids).toContain(selection.primaryId);
    });

    it("a plain click (selectOnly) on one already-multi-selected list collapses the selection down to just that list", () => {
      seedTwoLists();
      useEditorStore.getState().selectOnly("ul-1");
      useEditorStore.getState().toggleSelection("ol-1");
      expect(useEditorStore.getState().selection.ids).toHaveLength(2);

      useEditorStore.getState().selectOnly("ol-1");

      expect(useEditorStore.getState().selection).toEqual({ ids: ["ol-1"], primaryId: "ol-1" });
    });

    it("resizing one list never touches the other list's own dimensions, regardless of a prior multi-selection", () => {
      seedTwoLists();
      useEditorStore.getState().selectOnly("ul-1");
      useEditorStore.getState().toggleSelection("ol-1");

      useEditorStore.getState().resizeElement("ul-1", { preferredWidth: 200, preferredHeight: 150, offsetX: 0, offsetY: 0 });

      const ul = findNodeById(useEditorStore.getState().document, "ul-1");
      const ol = findNodeById(useEditorStore.getState().document, "ol-1");
      expect(ul?.dimensions).toEqual({ preferredWidth: 200, preferredHeight: 150, offsetX: 0, offsetY: 0 });
      expect(ol?.dimensions).toBeUndefined();
    });

    it("one resize drag (begin/live-updates/commit, matching useResizeSession) is one history entry, and undo restores only the resized list", () => {
      seedTwoLists();
      const historyLengthBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().beginResizeTransaction();
      useEditorStore.getState().resizeElement("ul-1", { preferredWidth: 90, preferredHeight: 90, offsetX: 0, offsetY: 0 });
      useEditorStore.getState().resizeElement("ul-1", { preferredWidth: 200, preferredHeight: 150, offsetX: 0, offsetY: 0 });
      useEditorStore.getState().commitResizeTransaction();

      expect(useEditorStore.getState().past.length).toBe(historyLengthBefore + 1);

      useEditorStore.getState().undo();
      const ul = findNodeById(useEditorStore.getState().document, "ul-1");
      const ol = findNodeById(useEditorStore.getState().document, "ol-1");
      expect(ul?.dimensions).toBeUndefined();
      expect(ol?.dimensions).toBeUndefined();
    });
  });

  describe("Compositions (Checkpoint 1.15.6.1.1, Workstream C, section 55) — built from ordinary primitives, so no tag-specific resize hack should ever be needed", () => {
    it("resizes the Simple Footer composition's root exactly like an ordinary footer, in Block, Flex, and Grid Content Layout modes, with its internal Nav/Links completely untouched", () => {
      for (const display of ["block", "flex", "grid"] as const) {
        const footer = createFooterCompositionNode();
        footer.id = "footer-1";
        useEditorStore.setState((state) => ({ document: { ...state.document, children: [footer] } }));
        if (display !== "block") {
          useEditorStore.getState().setFlowDisplayMode("footer-1", display);
        }

        useEditorStore.getState().resizeElement("footer-1", { preferredWidth: 480, preferredHeight: 96, offsetX: 0, offsetY: 0 });

        const resized = findNodeById(useEditorStore.getState().document, "footer-1");
        expect(resized?.dimensions).toEqual({ preferredWidth: 480, preferredHeight: 96, offsetX: 0, offsetY: 0 });
        // The composition's own internal div/p/nav/a subtree is exactly what the factory produced — resizing the root never touches it.
        expect(resized?.children).toEqual(footer.children);

        useEditorStore.setState(initialState, true);
      }
    });
  });
});
