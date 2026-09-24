import { describe, expect, it } from "vitest";
import { createBasicTabsNode, createDrawerNode, createModalNode } from "@/features/editor/factories/interactionCompositions";
import { createDismissibleAlertNode, createManualToastNode, createPopoverNode } from "@/features/editor/factories/feedbackCompositions";
import { cloneNodeWithFreshIds } from "./cloneNodeWithFreshIds";
import type { EditorElementNode } from "@/features/editor/types/document";

describe("cloneNodeWithFreshIds", () => {
  it("gives the cloned root a fresh id, distinct from the source", () => {
    const source: EditorElementNode = { id: "image-1", tag: "img" };

    const clone = cloneNodeWithFreshIds(source);

    expect(clone.id).not.toBe(source.id);
    expect(clone.tag).toBe("img");
  });

  it("gives every descendant a fresh id too, not just the root", () => {
    const source: EditorElementNode = {
      id: "section-1",
      tag: "section",
      children: [
        { id: "heading-1", tag: "h1", text: "Title" },
        { id: "container-1", tag: "div", children: [{ id: "image-1", tag: "img" }] },
      ],
    };

    const clone = cloneNodeWithFreshIds(source);
    const ids = collectIds(clone);
    const sourceIds = collectIds(source);

    expect(ids).toHaveLength(sourceIds.length);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(sourceIds).not.toContain(id);
    }
  });

  it("preserves content, dimensions, and structure", () => {
    const source: EditorElementNode = {
      id: "image-1",
      tag: "img",
      dimensions: { preferredWidth: 300, preferredHeight: 150, offsetX: 0, offsetY: 0 },
      displayName: "Hero Image",
    };

    const clone = cloneNodeWithFreshIds(source);

    expect(clone.dimensions).toEqual(source.dimensions);
    expect(clone.displayName).toBe("Hero Image");
  });

  it("preserves the nested tree shape (children in the same order, same depth)", () => {
    const source: EditorElementNode = {
      id: "container-1",
      tag: "div",
      children: [
        { id: "a", tag: "p", text: "A" },
        { id: "b", tag: "p", text: "B" },
      ],
    };

    const clone = cloneNodeWithFreshIds(source);

    expect(clone.children?.map((child) => child.text)).toEqual(["A", "B"]);
  });

  it("preserves flowLayout, spacing, flexChild, and gridChild (Checkpoint 3.5)", () => {
    const source: EditorElementNode = {
      id: "container-1",
      tag: "div",
      flowLayout: { display: "flex", flex: { direction: "row", wrap: "wrap", justifyContent: "center", alignItems: "stretch", rowGap: 8, columnGap: 8 } },
      spacing: { margin: { top: 4, right: 4, bottom: 4, left: 4 }, padding: { top: 16, right: 16, bottom: 16, left: 16 } },
      children: [
        {
          id: "heading-1",
          tag: "h1",
          flexChild: { grow: 1, shrink: 0, basis: 200, alignSelf: "center" },
          gridChild: { columnStart: 2, columnSpan: 2, rowStart: "auto", rowSpan: 1 },
        },
      ],
    };

    const clone = cloneNodeWithFreshIds(source);

    expect(clone.flowLayout).toEqual(source.flowLayout);
    expect(clone.spacing).toEqual(source.spacing);
    expect(clone.children?.[0].flexChild).toEqual(source.children?.[0].flexChild);
    expect(clone.children?.[0].gridChild).toEqual(source.children?.[0].gridChild);
  });

  it("preserves src and mediaFit (Checkpoint 3.5.1)", () => {
    const source: EditorElementNode = {
      id: "image-1",
      tag: "img",
      src: "data:image/svg+xml;utf8,<svg/>",
      mediaFit: { objectFit: "cover", objectPositionX: { value: 50, unit: "%" }, objectPositionY: { value: 0, unit: "%" } },
    };

    const clone = cloneNodeWithFreshIds(source);

    expect(clone.src).toBe(source.src);
    expect(clone.mediaFit).toEqual(source.mediaFit);
  });

  it("preserves a Link's text and href, with a fresh id (Checkpoint 1.4)", () => {
    const source: EditorElementNode = {
      id: "link-1",
      tag: "a",
      text: "Learn more",
      href: "/about",
      typography: { fontWeight: 700 },
    };

    const clone = cloneNodeWithFreshIds(source);

    expect(clone.id).not.toBe(source.id);
    expect(clone.text).toBe("Learn more");
    expect(clone.href).toBe("/about");
    expect(clone.typography).toEqual({ fontWeight: 700 });
  });

  it("clones an entire list (ul + li children) recursively with fresh ids for every node (Checkpoint 1.6)", () => {
    const source: EditorElementNode = {
      id: "list-1",
      tag: "ul",
      children: [
        { id: "li-1", tag: "li", text: "Alpha" },
        { id: "li-2", tag: "li", text: "Beta" },
        { id: "li-3", tag: "li", text: "Gamma" },
      ],
    };

    const clone = cloneNodeWithFreshIds(source);

    expect(clone.id).not.toBe(source.id);
    expect(clone.tag).toBe("ul");
    expect(clone.children).toHaveLength(3);
    expect(clone.children?.map((c) => c.text)).toEqual(["Alpha", "Beta", "Gamma"]);
    const sourceIds = collectIds(source);
    const cloneIds = collectIds(clone);
    expect(new Set(cloneIds).size).toBe(cloneIds.length);
    for (const id of cloneIds) {
      expect(sourceIds).not.toContain(id);
    }
  });

  it("preserves typography (Checkpoint 4.2)", () => {
    const source: EditorElementNode = {
      id: "heading-1",
      tag: "h1",
      typography: {
        fontFamily: "Georgia, serif",
        fontSize: { value: 32, unit: "px" },
        fontWeight: 700,
        color: "#3366ff",
      },
    };

    const clone = cloneNodeWithFreshIds(source);

    expect(clone.typography).toEqual(source.typography);
  });

  it("preserves background (Checkpoint 4.3)", () => {
    const source: EditorElementNode = {
      id: "container-1",
      tag: "div",
      background: {
        color: "#3366ff",
        image: "https://example.com/hero.jpg",
        size: "custom",
        customSize: { width: { value: 200, unit: "px" }, height: "auto" },
        position: "center",
        repeat: "no-repeat",
        attachment: "fixed",
      },
    };

    const clone = cloneNodeWithFreshIds(source);

    expect(clone.background).toEqual(source.background);
  });

  it("preserves a gradient, including its stop ids verbatim (Checkpoint 4.3.1)", () => {
    const source: EditorElementNode = {
      id: "container-1",
      tag: "div",
      background: {
        sourceType: "gradient",
        gradient: {
          type: "radial",
          shape: "circle",
          position: "top-left",
          stops: [
            { id: "stop-a", color: "#ff0000", position: 0 },
            { id: "stop-b", color: "#00ff00", position: 100 },
          ],
        },
      },
    };

    const clone = cloneNodeWithFreshIds(source);

    // Gradient stop ids are local identities scoped to their own parent
    // gradient (only ever looked up as `gradient.stops.find(s => s.id ===
    // ...)` within the same element) — never looked up globally across
    // the document — so a duplicated element keeping the exact same stop
    // ids as its source is safe: there is no cross-element stop lookup
    // anywhere in this codebase that duplicate ids could collide with.
    // Regenerating them here would add complexity with no real benefit.
    expect(clone.background).toEqual(source.background);
  });

  it("preserves border, independently per side (Checkpoint 4.4)", () => {
    const source: EditorElementNode = {
      id: "container-1",
      tag: "div",
      border: {
        top: { width: { value: 2, unit: "px" }, style: "solid", color: "#3366ff" },
        left: { style: "dashed" },
      },
    };

    const clone = cloneNodeWithFreshIds(source);

    expect(clone.border).toEqual(source.border);
  });

  it("preserves border radius, independently per corner (Checkpoint 4.5)", () => {
    const source: EditorElementNode = {
      id: "container-1",
      tag: "div",
      borderRadius: {
        topLeft: { value: 8, unit: "px" },
        bottomRight: { value: 50, unit: "%" },
      },
    };

    const clone = cloneNodeWithFreshIds(source);

    expect(clone.borderRadius).toEqual(source.borderRadius);
  });

  it("preserves box shadow layers verbatim, including their stop-like ids (Checkpoint 4.6)", () => {
    const source: EditorElementNode = {
      id: "container-1",
      tag: "div",
      boxShadow: [
        { id: "shadow-1", enabled: true, inset: false, offsetY: { value: 4, unit: "px" }, color: "#000000" },
        { id: "shadow-2", enabled: false, inset: true, blur: { value: 8, unit: "px" } },
      ],
    };

    const clone = cloneNodeWithFreshIds(source);

    // Shadow layer ids, like gradient stop ids, are local identities scoped
    // to their own parent node's boxShadow array — never looked up
    // globally — so preserving them verbatim on clone is safe; see this
    // file's gradient stop test above for the identical precedent.
    expect(clone.boxShadow).toEqual(source.boxShadow);
  });

  it("preserves visual effects (Checkpoint 4.7)", () => {
    const source: EditorElementNode = {
      id: "container-1",
      tag: "div",
      filters: { opacity: 80, blur: { value: 4, unit: "px" }, hueRotate: 90 },
    };

    const clone = cloneNodeWithFreshIds(source);

    expect(clone.filters).toEqual(source.filters);
  });

  it("preserves display/visibility/overflow/interaction settings (Checkpoint 4.8)", () => {
    const source: EditorElementNode = {
      id: "container-1",
      tag: "div",
      display: { display: "none", overflowX: "hidden", cursor: "pointer" },
    };

    const clone = cloneNodeWithFreshIds(source);

    expect(clone.display).toEqual(source.display);
  });

  it("preserves sizeConstraints and an explicit resize lock override (Checkpoint 5.7)", () => {
    const source: EditorElementNode = {
      id: "container-1",
      tag: "div",
      sizeConstraints: { minWidth: 100, maxWidth: 800 },
      aspectRatioLocked: true,
      dimensions: { preferredWidth: 320, preferredHeight: 180, offsetX: 0, offsetY: 0 },
    };

    const clone = cloneNodeWithFreshIds(source);

    expect(clone.sizeConstraints).toEqual(source.sizeConstraints);
    expect(clone.aspectRatioLocked).toBe(true);
    expect(clone.dimensions).toEqual(source.dimensions);
  });

  it("does not mutate the source tree", () => {
    const source: EditorElementNode = {
      id: "container-1",
      tag: "div",
      children: [{ id: "heading-1", tag: "h1", text: "Title" }],
    };

    cloneNodeWithFreshIds(source);

    expect(source.id).toBe("container-1");
    expect(source.children?.[0].id).toBe("heading-1");
  });

  describe("SVG scene (Checkpoint 1.15.6)", () => {
    it("regenerates every vector object's own id, preserving geometry/style", () => {
      const source: EditorElementNode = {
        id: "svg-1",
        tag: "svg",
        svgScene: {
          objects: [
            { id: "rect-1", type: "rect", x: 1, y: 2, width: 3, height: 4, fill: "#ff0000" },
            { id: "ellipse-1", type: "ellipse", cx: 5, cy: 6, rx: 7, ry: 8 },
          ],
        },
      };

      const clone = cloneNodeWithFreshIds(source);

      expect(clone.svgScene!.objects[0].id).not.toBe("rect-1");
      expect(clone.svgScene!.objects[1].id).not.toBe("ellipse-1");
      expect(clone.svgScene!.objects[0]).toMatchObject({ type: "rect", x: 1, y: 2, width: 3, height: 4, fill: "#ff0000" });
      expect(clone.svgScene!.objects[1]).toMatchObject({ type: "ellipse", cx: 5, cy: 6, rx: 7, ry: 8 });
    });

    it("never lets a duplicate's vector ids collide with the original's", () => {
      const source: EditorElementNode = {
        id: "svg-1",
        tag: "svg",
        svgScene: { objects: [{ id: "rect-1", type: "rect", x: 0, y: 0, width: 1, height: 1 }] },
      };
      const clone = cloneNodeWithFreshIds(source);
      expect(clone.svgScene!.objects[0].id).not.toBe(source.svgScene!.objects[0].id);
    });

    it("leaves an SVG with no scene (legacy/simple mode) with an undefined svgScene, not a crash", () => {
      const source: EditorElementNode = { id: "svg-1", tag: "svg", svgKind: "circle" };
      const clone = cloneNodeWithFreshIds(source);
      expect(clone.svgScene).toBeUndefined();
      expect(clone.svgKind).toBe("circle");
    });

    it("does not mutate the source scene", () => {
      const source: EditorElementNode = {
        id: "svg-1",
        tag: "svg",
        svgScene: { objects: [{ id: "rect-1", type: "rect", x: 0, y: 0, width: 1, height: 1 }] },
      };
      cloneNodeWithFreshIds(source);
      expect(source.svgScene!.objects[0].id).toBe("rect-1");
    });
  });

  describe("Interaction bindings (Checkpoint 1.15.6.8)", () => {
    it("remaps an INTERNAL target reference to the corresponding cloned node (Part I)", () => {
      const source: EditorElementNode = {
        id: "root-1",
        tag: "div",
        children: [
          { id: "button-1", tag: "button", text: "Toggle", interactions: [{ id: "int-1", trigger: "click", action: "toggle", targetId: "content-1" }] },
          { id: "content-1", tag: "div", children: [{ id: "p-1", tag: "p", text: "Content" }] },
        ],
      };

      const clone = cloneNodeWithFreshIds(source);
      const [clonedButton, clonedContent] = clone.children!;

      expect(clonedButton.interactions).toHaveLength(1);
      expect(clonedButton.interactions![0].targetId).toBe(clonedContent.id);
      expect(clonedButton.interactions![0].targetId).not.toBe("content-1");
    });

    it("leaves an EXTERNAL target reference (outside the cloned subtree) completely untouched", () => {
      const source: EditorElementNode = {
        id: "button-1",
        tag: "button",
        text: "Toggle",
        interactions: [{ id: "int-1", trigger: "click", action: "toggle", targetId: "external-target-1" }],
      };

      const clone = cloneNodeWithFreshIds(source);

      expect(clone.interactions![0].targetId).toBe("external-target-1");
    });

    it("gives every duplicated binding its own fresh interaction id, never reusing the original's", () => {
      const source: EditorElementNode = {
        id: "button-1",
        tag: "button",
        interactions: [{ id: "int-1", trigger: "click", action: "show", targetId: "target-1" }],
      };

      const clone = cloneNodeWithFreshIds(source);

      expect(clone.interactions![0].id).not.toBe("int-1");
    });

    it("leaves a node with no interactions at all with interactions still undefined", () => {
      const source: EditorElementNode = { id: "div-1", tag: "div" };
      const clone = cloneNodeWithFreshIds(source);
      expect(clone.interactions).toBeUndefined();
    });

    it("does not mutate the source's own interactions array", () => {
      const source: EditorElementNode = {
        id: "root-1",
        tag: "div",
        children: [
          { id: "button-1", tag: "button", interactions: [{ id: "int-1", trigger: "click", action: "toggle", targetId: "content-1" }] },
          { id: "content-1", tag: "div" },
        ],
      };

      cloneNodeWithFreshIds(source);

      expect(source.children![0].interactions![0]).toEqual({ id: "int-1", trigger: "click", action: "toggle", targetId: "content-1" });
    });

    it("Checkpoint 1.15.6.9 — remaps TWO different triggers that target the SAME node to the SAME cloned target (a real Modal, not a synthetic fixture)", () => {
      const modal = createModalNode();
      const [openButton, dialog] = modal.children!;
      const closeButton = dialog.children![0].children![2];
      expect(openButton.interactions![0].targetId).toBe(dialog.id);
      expect(closeButton.interactions![0].targetId).toBe(dialog.id);

      const clone = cloneNodeWithFreshIds(modal);
      const [clonedOpenButton, clonedDialog] = clone.children!;
      const clonedCloseButton = clonedDialog.children![0].children![2];

      expect(clonedDialog.id).not.toBe(dialog.id);
      expect(clonedOpenButton.interactions![0].targetId).toBe(clonedDialog.id);
      expect(clonedCloseButton.interactions![0].targetId).toBe(clonedDialog.id);
      // Both bindings converge on the exact same cloned id — the
      // relationship survives duplication intact, for BOTH triggers.
      expect(clonedOpenButton.interactions![0].targetId).toBe(clonedCloseButton.interactions![0].targetId);
    });

    it("Checkpoint 1.15.6.11.3 — remaps a Drawer's TWO different triggers (Open, Close) that target the SAME Dialog, the same two-pass shape Modal already proved — no Drawer-specific cloning logic exists or is needed", () => {
      const drawer = createDrawerNode();
      const [openButton, dialog] = drawer.children!;
      const closeButton = dialog.children![0].children![2];
      expect(openButton.interactions![0].targetId).toBe(dialog.id);
      expect(closeButton.interactions![0].targetId).toBe(dialog.id);

      const clone = cloneNodeWithFreshIds(drawer);
      const [clonedOpenButton, clonedDialog] = clone.children!;
      const clonedCloseButton = clonedDialog.children![0].children![2];

      expect(clonedDialog.id).not.toBe(dialog.id);
      expect(clonedOpenButton.interactions![0].targetId).toBe(clonedDialog.id);
      expect(clonedCloseButton.interactions![0].targetId).toBe(clonedDialog.id);
      expect(clonedOpenButton.interactions![0].targetId).toBe(clonedCloseButton.interactions![0].targetId);
      // Positioning/dimensions are ordinary authored data, copied verbatim
      // by the clone like any other field — no remapping needed for them.
      expect(clonedDialog.position).toEqual(dialog.position);
      expect(clonedDialog.dimensions).toEqual(dialog.dimensions);
    });

    it("Checkpoint 1.15.6.9.1 — a cloned Modal's Dialog derives its own accessible name/description from its own (cloned) heading/paragraph text, independent of the original", () => {
      const modal = createModalNode();
      const [, dialog] = modal.children!;
      const clone = cloneNodeWithFreshIds(modal);
      const [, clonedDialog] = clone.children!;

      const [content] = dialog.children!;
      const [clonedContent] = clonedDialog.children!;

      // Not the SAME node objects (real, independent clones)...
      expect(clonedContent.children![0]).not.toBe(content.children![0]);
      // ...but carrying the same authored text, since resolveDialogAccessibleName
      // reads text content directly with no id/reference involved at all —
      // there is no htmlId/labelledby relationship that duplication could
      // leave dangling or pointing at the original.
      expect(clonedContent.children![0].text).toBe(content.children![0].text);
      expect(clonedDialog.htmlId).toBeUndefined();
      expect(dialog.htmlId).toBeUndefined();
    });

    it("Checkpoint 1.15.6.11.1 — remaps a Manual Toast's TWO different triggers (Show, Close) that target the SAME node, the same two-pass shape Modal already proved", () => {
      const toastComposition = createManualToastNode();
      const [showButton, toast] = toastComposition.children!;
      const [, closeButton] = toast.children!;
      expect(showButton.interactions![0].targetId).toBe(toast.id);
      expect(closeButton.interactions![0].targetId).toBe(toast.id);

      const clone = cloneNodeWithFreshIds(toastComposition);
      const [clonedShowButton, clonedToast] = clone.children!;
      const [, clonedCloseButton] = clonedToast.children!;

      expect(clonedToast.id).not.toBe(toast.id);
      expect(clonedShowButton.interactions![0].targetId).toBe(clonedToast.id);
      expect(clonedCloseButton.interactions![0].targetId).toBe(clonedToast.id);
      expect(clonedShowButton.interactions![0].targetId).toBe(clonedCloseButton.interactions![0].targetId);
    });

    it("Checkpoint 1.15.6.11.1 — remaps a Dismissible Alert's own Dismiss Button to hide the DUPLICATED root, never the original", () => {
      const alert = createDismissibleAlertNode();
      const [, dismissButton] = alert.children!;
      expect(dismissButton.interactions![0].targetId).toBe(alert.id);

      const clone = cloneNodeWithFreshIds(alert);
      const [, clonedDismissButton] = clone.children!;

      expect(clone.id).not.toBe(alert.id);
      expect(clonedDismissButton.interactions![0].targetId).toBe(clone.id);
      expect(clonedDismissButton.interactions![0].targetId).not.toBe(alert.id);
    });

    it("Checkpoint 1.15.6.11.2 — remaps a Popover's own trigger to toggle the DUPLICATED Panel, never the original", () => {
      const popover = createPopoverNode();
      const [trigger, panel] = popover.children!;
      expect(trigger.interactions![0].targetId).toBe(panel.id);

      const clone = cloneNodeWithFreshIds(popover);
      const [clonedTrigger, clonedPanel] = clone.children!;

      expect(clonedPanel.id).not.toBe(panel.id);
      expect(clonedTrigger.interactions![0].targetId).toBe(clonedPanel.id);
      expect(clonedTrigger.interactions![0].targetId).not.toBe(panel.id);
    });

    it("Checkpoint 1.15.6.11.2 — remaps ALL NINE of a duplicated Basic Tabs' interaction targets to the duplicated Panels, never the originals", () => {
      const tabs = createBasicTabsNode();
      const [controls, panels] = tabs.children!;
      const [panel1, panel2, panel3] = panels.children!;

      const clone = cloneNodeWithFreshIds(tabs);
      const [clonedControls, clonedPanels] = clone.children!;
      const [clonedPanel1, clonedPanel2, clonedPanel3] = clonedPanels.children!;

      expect(clonedPanel1.id).not.toBe(panel1.id);
      expect(clonedPanel2.id).not.toBe(panel2.id);
      expect(clonedPanel3.id).not.toBe(panel3.id);

      const originalPanelIds = new Set([panel1.id, panel2.id, panel3.id]);
      const clonedPanelIds = new Set([clonedPanel1.id, clonedPanel2.id, clonedPanel3.id]);

      let totalBindings = 0;
      for (const clonedTab of clonedControls.children!) {
        expect(clonedTab.interactions).toHaveLength(3);
        for (const binding of clonedTab.interactions!) {
          totalBindings += 1;
          expect(clonedPanelIds.has(binding.targetId)).toBe(true);
          expect(originalPanelIds.has(binding.targetId)).toBe(false);
        }
      }
      expect(totalBindings).toBe(9);

      // Originals remain completely untouched.
      for (const tab of controls.children!) {
        for (const binding of tab.interactions!) {
          expect(originalPanelIds.has(binding.targetId)).toBe(true);
        }
      }
    });
  });
});

function collectIds(node: EditorElementNode): string[] {
  return [node.id, ...(node.children ?? []).flatMap(collectIds)];
}
