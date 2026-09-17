import { afterEach, describe, expect, it } from "vitest";
import {
  createBasicNavbarNode,
  createBreadcrumbsNode,
  createNavbarWithCtaNode,
  createPaginationNode,
  createSidebarNavigationNode,
} from "@/features/editor/factories/navigationCompositions";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { useEditorStore } from "./useEditorStore";

const initialState = useEditorStore.getState();

/**
 * Checkpoint 1.15.6.3 — Components -> Navigation, store-level integration.
 * The factories themselves (navigationCompositions.test.ts) already prove
 * the generated trees; this file proves the SURROUNDING architecture —
 * insertion/selection/history, resize compatibility (extending the
 * 1.15.6.1 Flex `flexShrink` and 1.15.6.1 Grid `100%` fixes to real
 * Navigation compositions), duplication, and Parent Style Protection —
 * needed zero component-specific code, exactly as buttonComponents did.
 */
describe("Navigation Components — store integration (Checkpoint 1.15.6.3)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  describe("Insertion, selection, and history (section 40-41)", () => {
    it("inserting a Navbar with CTA is one history entry and selects the Nav root, not any child Link/Button", () => {
      const navbar = createNavbarWithCtaNode();
      const historyLengthBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().insertElement("page-root", navbar);

      expect(useEditorStore.getState().past.length).toBe(historyLengthBefore + 1);
      expect(useEditorStore.getState().selection).toEqual({ ids: [navbar.id], primaryId: navbar.id });
    });

    it("inserting Sidebar Navigation is one history entry and selects its own Nav root", () => {
      const sidebar = createSidebarNavigationNode();
      const historyLengthBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().insertElement("page-root", sidebar);

      expect(useEditorStore.getState().past.length).toBe(historyLengthBefore + 1);
      expect(useEditorStore.getState().selection).toEqual({ ids: [sidebar.id], primaryId: sidebar.id });
    });

    it("undo removes the entire inserted composition; redo restores it whole", () => {
      const navbar = createNavbarWithCtaNode();
      useEditorStore.getState().insertElement("page-root", navbar);
      expect(findNodeById(useEditorStore.getState().document, navbar.id)).toBeDefined();

      useEditorStore.getState().undo();
      expect(findNodeById(useEditorStore.getState().document, navbar.id)).toBeUndefined();
      expect(findNodeById(useEditorStore.getState().document, navbar.children![0].id)).toBeUndefined();

      useEditorStore.getState().redo();
      const restored = findNodeById(useEditorStore.getState().document, navbar.id);
      expect(restored?.children).toHaveLength(4);
    });
  });

  describe("Resize regression — extends the 1.15.6.1/1.15.6.1.1 fixes to real Navigation compositions (sections 63-64)", () => {
    it("the CTA Button inside a Navbar with CTA holds a manual resize without its sibling Links resizing (Flex flexShrink regression)", () => {
      const navbar = createNavbarWithCtaNode();
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [navbar] } }));
      const [firstLink, , , cta] = navbar.children!;

      useEditorStore.getState().resizeElement(cta.id, { preferredWidth: 160, preferredHeight: 48, offsetX: 0, offsetY: 0 });

      expect(findNodeById(useEditorStore.getState().document, cta.id)?.dimensions).toEqual({
        preferredWidth: 160,
        preferredHeight: 48,
        offsetX: 0,
        offsetY: 0,
      });
      expect(findNodeById(useEditorStore.getState().document, firstLink.id)?.dimensions).toBeUndefined();
    });

    it("a Navbar root resizes correctly when placed inside a Grid parent, without being forced back to 100%", () => {
      const navbar = createBasicNavbarNode();
      navbar.id = "navbar-1";
      const grid = { id: "grid-1", tag: "div", flowLayout: { display: "grid" as const }, children: [navbar] };
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [grid] } }));

      useEditorStore.getState().resizeElement("navbar-1", { preferredWidth: 300, preferredHeight: 60, offsetX: 0, offsetY: 0 });

      const resized = findNodeById(useEditorStore.getState().document, "navbar-1");
      expect(resized?.dimensions).toEqual({ preferredWidth: 300, preferredHeight: 60, offsetX: 0, offsetY: 0 });
    });

    it("resizing one Link inside Sidebar Navigation never resizes its siblings", () => {
      const sidebar = createSidebarNavigationNode();
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [sidebar] } }));
      const [a, b, c, d] = sidebar.children!;

      useEditorStore.getState().resizeElement(a.id, { preferredWidth: 180, preferredHeight: 36, offsetX: 0, offsetY: 0 });

      expect(findNodeById(useEditorStore.getState().document, a.id)?.dimensions).toBeDefined();
      for (const sibling of [b, c, d]) {
        expect(findNodeById(useEditorStore.getState().document, sibling.id)?.dimensions).toBeUndefined();
      }
    });
  });

  describe("Duplication (section 72-73)", () => {
    function collectIds(node: { id: string; children?: unknown[] }): string[] {
      return [node.id, ...((node.children as typeof node[] | undefined) ?? []).flatMap(collectIds)];
    }

    it("duplicating a Navbar with CTA gives every node in the copy a fresh id, sharing none with the original", () => {
      const navbar = createNavbarWithCtaNode();
      useEditorStore.setState((state) => ({
        document: { ...state.document, children: [navbar] },
        selection: { ids: [navbar.id], primaryId: navbar.id },
      }));

      useEditorStore.getState().duplicateSelection();

      const allChildren = useEditorStore.getState().document.children ?? [];
      expect(allChildren).toHaveLength(2);
      const duplicate = allChildren.find((c) => c.id !== navbar.id)!;
      expect(duplicate.tag).toBe("nav");
      expect(duplicate.children).toHaveLength(4);

      const originalIds = collectIds(navbar);
      const duplicateIds = collectIds(duplicate);
      expect(duplicateIds.some((id) => originalIds.includes(id))).toBe(false);
      expect(new Set(duplicateIds).size).toBe(duplicateIds.length);
    });

    it("editing a duplicate Breadcrumbs Link's text never affects the original", () => {
      const breadcrumbs = createBreadcrumbsNode();
      useEditorStore.setState((state) => ({
        document: { ...state.document, children: [breadcrumbs] },
        selection: { ids: [breadcrumbs.id], primaryId: breadcrumbs.id },
      }));

      useEditorStore.getState().duplicateSelection();
      const allChildren = useEditorStore.getState().document.children ?? [];
      const duplicate = allChildren.find((c) => c.id !== breadcrumbs.id)!;
      const duplicateFirstLink = duplicate.children![0];

      useEditorStore.getState().setElementText(duplicateFirstLink.id, "Changed");

      expect(findNodeById(useEditorStore.getState().document, breadcrumbs.children![0].id)?.text).toBe("Home");
      expect(findNodeById(useEditorStore.getState().document, duplicateFirstLink.id)?.text).toBe("Changed");
    });
  });

  describe("Parent Style Protection (section 69) — naturally applies, no component-specific guard", () => {
    it("blocks a direct style edit on a Navbar's child Link under a locked ancestor, and unblocks it once unlocked", () => {
      const navbar = createBasicNavbarNode();
      const lockedContainer = { id: "locked-1", tag: "div", lockChildStyles: true, children: [navbar] };
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [lockedContainer] } }));

      const [firstLink] = navbar.children!;
      const originalColor = firstLink.typography?.color;
      const historyLengthBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().setElementTypography(firstLink.id, { color: "#ff0000" });

      expect(findNodeById(useEditorStore.getState().document, firstLink.id)?.typography?.color).toBe(originalColor);
      expect(useEditorStore.getState().past.length).toBe(historyLengthBefore);

      useEditorStore.getState().setElementLockChildStyles("locked-1", undefined);
      useEditorStore.getState().setElementTypography(firstLink.id, { color: "#ff0000" });
      expect(findNodeById(useEditorStore.getState().document, firstLink.id)?.typography?.color).toBe("#ff0000");
    });
  });

  describe("Pagination active-page state (section 22) — confirms no runtime pagination state exists on the store either", () => {
    it("the store has no pagination-specific action; active page is purely the node's own authored background/typography", () => {
      const pagination = createPaginationNode();
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [pagination] } }));

      const store = useEditorStore.getState() as unknown as Record<string, unknown>;
      expect(store.setActivePage).toBeUndefined();
      expect(store.setPaginationState).toBeUndefined();
    });
  });
});
