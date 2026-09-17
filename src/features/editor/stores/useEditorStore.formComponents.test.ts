import { afterEach, describe, expect, it } from "vitest";
import {
  createContactFormNode,
  createLoginFormNode,
  createSearchBarNode,
} from "@/features/editor/factories/formCompositions";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { useEditorStore } from "./useEditorStore";

const initialState = useEditorStore.getState();

/**
 * Checkpoint 1.15.6.5 — Components -> Forms & Inputs, store-level
 * integration. The factories themselves (formCompositions.test.ts)
 * already prove the generated trees; this file proves the SURROUNDING
 * architecture — insertion/selection/history, Flex resize compatibility
 * (Search Input growing without coupling to its Button), duplication with
 * semantic-field survival, and Parent Style Protection's "style blocked,
 * semantic content editable" invariant across BOTH contentEditable
 * (Paragraph label text) and native form-value editing (Input name) —
 * needed zero component-specific code, exactly as Buttons/Navigation/
 * Cards already established.
 */
describe("Form Components — store integration (Checkpoint 1.15.6.5)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  describe("Insertion, selection, and history (sections 50-52)", () => {
    it("inserting a Contact Form is one history entry and selects the Form root, not any child field", () => {
      const form = createContactFormNode();
      const historyLengthBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().insertElement("page-root", form);

      expect(useEditorStore.getState().past.length).toBe(historyLengthBefore + 1);
      expect(useEditorStore.getState().selection).toEqual({ ids: [form.id], primaryId: form.id });
    });

    it("undo removes the entire inserted Form subtree; redo restores it whole", () => {
      const form = createLoginFormNode();
      useEditorStore.getState().insertElement("page-root", form);
      expect(findNodeById(useEditorStore.getState().document, form.id)).toBeDefined();

      useEditorStore.getState().undo();
      expect(findNodeById(useEditorStore.getState().document, form.id)).toBeUndefined();
      const [, emailField] = form.children!;
      expect(findNodeById(useEditorStore.getState().document, emailField.id)).toBeUndefined();

      useEditorStore.getState().redo();
      const restored = findNodeById(useEditorStore.getState().document, form.id);
      expect(restored?.children).toHaveLength(5);
    });

    it("inserting a Form into a Free parent succeeds as one history entry, and no child ever receives Free layout/geometry of its own", () => {
      const freeParent = { id: "free-1", tag: "div", layoutMode: "free" as const, children: [] };
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [freeParent] } }));

      const form = createContactFormNode();
      const historyLengthBefore = useEditorStore.getState().past.length;
      useEditorStore.getState().insertElement("free-1", form);

      expect(useEditorStore.getState().past.length).toBe(historyLengthBefore + 1);
      const inserted = findNodeById(useEditorStore.getState().document, form.id);
      for (const child of inserted?.children ?? []) {
        expect(child.layoutMode).not.toBe("free");
        expect(child.dimensions).toBeUndefined();
      }
    });
  });

  describe("Resize regression — Search Bar's Input/Button Flex independence, and Grid (sections 74-78)", () => {
    it("resizing the Search Input holds the manual resize without its sibling Button resizing", () => {
      const bar = createSearchBarNode();
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [bar] } }));
      const [input, button] = bar.children!;

      useEditorStore.getState().resizeElement(input.id, { preferredWidth: 260, preferredHeight: 40, offsetX: 0, offsetY: 0 });

      expect(findNodeById(useEditorStore.getState().document, input.id)?.dimensions).toEqual({
        preferredWidth: 260,
        preferredHeight: 40,
        offsetX: 0,
        offsetY: 0,
      });
      expect(findNodeById(useEditorStore.getState().document, button.id)?.dimensions).toBeUndefined();
    });

    it("resizing the Button holds the manual resize without its sibling Input resizing", () => {
      const bar = createSearchBarNode();
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [bar] } }));
      const [input, button] = bar.children!;

      useEditorStore.getState().resizeElement(button.id, { preferredWidth: 100, preferredHeight: 40, offsetX: 0, offsetY: 0 });

      expect(findNodeById(useEditorStore.getState().document, button.id)?.dimensions).toBeDefined();
      expect(findNodeById(useEditorStore.getState().document, input.id)?.dimensions).toBeUndefined();
    });

    it("a Contact Form root resizes correctly when placed inside a Grid parent, without being forced back to 100%", () => {
      const form = createContactFormNode();
      form.id = "form-1";
      const grid = { id: "grid-1", tag: "div", flowLayout: { display: "grid" as const }, children: [form] };
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [grid] } }));

      useEditorStore.getState().resizeElement("form-1", { preferredWidth: 400, preferredHeight: 460, offsetX: 0, offsetY: 0 });

      const resized = findNodeById(useEditorStore.getState().document, "form-1");
      expect(resized?.dimensions).toEqual({ preferredWidth: 400, preferredHeight: 460, offsetX: 0, offsetY: 0 });
    });
  });

  describe("Duplication (sections 87-89) — semantic fields survive, no shared mutable tree", () => {
    function collectIds(node: { id: string; children?: unknown[] }): string[] {
      return [node.id, ...((node.children as typeof node[] | undefined) ?? []).flatMap(collectIds)];
    }

    it("duplicating a Contact Form gives every node in the copy a fresh id, sharing none with the original, and preserves each Input's inputType/name/placeholder", () => {
      const form = createContactFormNode();
      useEditorStore.setState((state) => ({
        document: { ...state.document, children: [form] },
        selection: { ids: [form.id], primaryId: form.id },
      }));

      useEditorStore.getState().duplicateSelection();

      const allChildren = useEditorStore.getState().document.children ?? [];
      expect(allChildren).toHaveLength(2);
      const duplicate = allChildren.find((c) => c.id !== form.id)!;
      const [originalEmailField] = [form.children![1]];
      const [duplicateEmailField] = [duplicate.children![1]];
      const originalInput = originalEmailField.children![1];
      const duplicateInput = duplicateEmailField.children![1];
      expect(duplicateInput.inputType).toBe(originalInput.inputType);
      expect(duplicateInput.name).toBe(originalInput.name);
      expect(duplicateInput.placeholder).toBe(originalInput.placeholder);
      expect(duplicateInput.id).not.toBe(originalInput.id);

      const originalIds = collectIds(form);
      const duplicateIds = collectIds(duplicate);
      expect(duplicateIds.some((id) => originalIds.includes(id))).toBe(false);
      expect(new Set(duplicateIds).size).toBe(duplicateIds.length);
    });

    it("editing a duplicated Login Form's field-label text never affects the original", () => {
      const form = createLoginFormNode();
      useEditorStore.setState((state) => ({
        document: { ...state.document, children: [form] },
        selection: { ids: [form.id], primaryId: form.id },
      }));

      useEditorStore.getState().duplicateSelection();
      const allChildren = useEditorStore.getState().document.children ?? [];
      const duplicate = allChildren.find((c) => c.id !== form.id)!;
      const duplicateHeading = duplicate.children![0];

      useEditorStore.getState().setElementText(duplicateHeading.id, "Sign In Again");

      expect(findNodeById(useEditorStore.getState().document, form.children![0].id)?.text).toBe("Welcome Back");
      expect(findNodeById(useEditorStore.getState().document, duplicateHeading.id)?.text).toBe("Sign In Again");
    });
  });

  describe("Parent Style Protection (sections 85-86) — style blocked, semantic content editing (both contentEditable text AND native form-value fields) remains allowed", () => {
    it("blocks a direct style edit on a Contact Form's field-label Paragraph under a locked Form root, but leaves its text editable", () => {
      const form = createContactFormNode();
      form.lockChildStyles = true;
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [form] } }));

      const [nameField] = form.children!;
      const [labelText] = nameField.children!;
      const originalColor = labelText.typography?.color;
      const historyLengthBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().setElementTypography(labelText.id, { color: "#ff0000" });
      expect(findNodeById(useEditorStore.getState().document, labelText.id)?.typography?.color).toBe(originalColor);
      expect(useEditorStore.getState().past.length).toBe(historyLengthBefore);

      useEditorStore.getState().setElementText(labelText.id, "Full Name");
      expect(findNodeById(useEditorStore.getState().document, labelText.id)?.text).toBe("Full Name");

      useEditorStore.getState().setElementLockChildStyles(form.id, undefined);
      useEditorStore.getState().setElementTypography(labelText.id, { color: "#ff0000" });
      expect(findNodeById(useEditorStore.getState().document, labelText.id)?.typography?.color).toBe("#ff0000");
    });

    it("blocks a direct style edit on a Contact Form's Input under a locked Form root, but leaves its name/placeholder semantic fields editable", () => {
      const form = createContactFormNode();
      form.lockChildStyles = true;
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [form] } }));

      const [nameField] = form.children!;
      const input = nameField.children![1];
      const historyLengthBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().setElementBackground(input.id, { color: "#ff0000" });
      expect(findNodeById(useEditorStore.getState().document, input.id)?.background).toBeUndefined();
      expect(useEditorStore.getState().past.length).toBe(historyLengthBefore);

      useEditorStore.getState().setElementName(input.id, "fullName");
      useEditorStore.getState().setElementPlaceholder(input.id, "Your full name");
      expect(findNodeById(useEditorStore.getState().document, input.id)?.name).toBe("fullName");
      expect(findNodeById(useEditorStore.getState().document, input.id)?.placeholder).toBe("Your full name");
    });

    it("a Form root under its OWN lock remains style-editable itself; only its descendants are protected", () => {
      const form = createContactFormNode();
      form.lockChildStyles = true;
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [form] } }));

      useEditorStore.getState().setElementBackground(form.id, { color: "#f4f4f5" });
      expect(findNodeById(useEditorStore.getState().document, form.id)?.background?.color).toBe("#f4f4f5");
    });
  });

  describe("Runtime behavior (section 8/K) — confirms no validation/submission/auth state exists on the store either", () => {
    it("the store has no Form-composition-specific action for validation, submission, or authentication", () => {
      const form = createLoginFormNode();
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [form] } }));

      const store = useEditorStore.getState() as unknown as Record<string, unknown>;
      expect(store.submitForm).toBeUndefined();
      expect(store.validateForm).toBeUndefined();
      expect(store.authenticateUser).toBeUndefined();
      expect(store.setFormValidationState).toBeUndefined();
    });
  });
});
