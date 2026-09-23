import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DocumentNodeRenderer } from "@/features/canvas/components/document/DocumentNodeRenderer";
import { ButtonElement } from "@/features/canvas/components/document/elements/ButtonElement";
import { ContainerElement } from "@/features/canvas/components/document/elements/ContainerElement";
import { DialogElement } from "@/features/canvas/components/document/elements/DialogElement";
import { HeadingElement } from "@/features/canvas/components/document/elements/HeadingElement";
import { IframeElement } from "@/features/canvas/components/document/elements/IframeElement";
import { ImageElement } from "@/features/canvas/components/document/elements/ImageElement";
import { InputElement } from "@/features/canvas/components/document/elements/InputElement";
import { LinkElement } from "@/features/canvas/components/document/elements/LinkElement";
import { ListItemElement } from "@/features/canvas/components/document/elements/ListItemElement";
import { ParagraphElement } from "@/features/canvas/components/document/elements/ParagraphElement";
import { SelectElement } from "@/features/canvas/components/document/elements/SelectElement";
import { SvgElement } from "@/features/canvas/components/document/elements/SvgElement";
import { TableElement } from "@/features/canvas/components/document/elements/TableElement";
import { TextareaElement } from "@/features/canvas/components/document/elements/TextareaElement";
import { VideoElement } from "@/features/canvas/components/document/elements/VideoElement";
import type { DocumentElementComponent } from "@/features/canvas/types/documentRenderer";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { FlowDisplayMode } from "@/features/editor/types/flowLayout";

/**
 * Checkpoint 1.15.6.1.1, Workstream C — the literal Creation Catalog x
 * Layout Mode compatibility sweep this checkpoint's own brief requires
 * (1.15.6.1 fixed the shared root causes but explicitly did not perform
 * this exhaustive pass). Every currently ENABLED Creation Toolbar card
 * (see creationToolbarCategories.ts — a card with no `elementType` is a
 * disabled future placeholder and is correctly excluded per this
 * checkpoint's own section 40) maps to exactly one of the 14 distinct
 * DocumentElementComponents exercised below:
 *
 *   container/section/unorderedList/orderedList/header/nav/main/article/
 *   aside/footer/footerComposition/form/label -> ContainerElement (13 catalog
 *     entries, all registered to the identical component in
 *     documentNodeComponents.ts, verified by direct inspection — grouped
 *     into one representative case per this checkpoint's own section 49
 *     precedent for equivalent Input subtypes, generalized)
 *   heading -> HeadingElement
 *   paragraph -> ParagraphElement
 *   link -> LinkElement
 *   listItem -> ListItemElement
 *   button -> ButtonElement
 *   table -> TableElement
 *   image -> ImageElement
 *   video -> VideoElement
 *   svg -> SvgElement
 *   iframe -> IframeElement
 *   input/emailInput/passwordInput/numberInput/searchInput/urlInput/
 *     telInput/checkboxInput/radioInput -> InputElement (9 catalog entries,
 *     all tag "input", differing only in inputType — confirmed by direct
 *     inspection that InputElement's own sizing/resolver pipeline never
 *     branches on inputType, so one representative case covers all 9)
 *   textarea -> TextareaElement
 *   select -> SelectElement
 *
 * 34 catalog entries in total, collapsing to these 14 representative
 * component cases with no coverage gap — every one of them was directly
 * confirmed (via `grep resolveFlexOrGridChildStyle` across every file in
 * this directory) to run through the exact same shared resolver pipeline
 * this checkpoint's OWN root-cause fixes live in
 * (resolveFlexOrGridChildStyle.ts, elementPositionStyle), so this single
 * parameterized pass validates the fix's universality directly, rather
 * than only its two originally-reported cases (Button, and the two Lists).
 *
 * Deliberately excluded (native-structural, never independently
 * insertable from the Creation Toolbar, and already correctly marked
 * non-resizable in elementCapabilities.ts): thead/tbody/tfoot/tr/th/td,
 * option, page, body — see this checkpoint's own report, section I
 * (Native Limitations).
 */
interface MatrixCase {
  label: string;
  Component: DocumentElementComponent;
  node: EditorElementNode;
}

const CASES: MatrixCase[] = [
  { label: "Container (div/section/ul/ol/header/nav/main/article/aside/footer/form/label)", Component: ContainerElement, node: { id: "n1", tag: "div" } },
  { label: "Heading", Component: HeadingElement, node: { id: "n1", tag: "h1", text: "Title" } },
  { label: "Paragraph", Component: ParagraphElement, node: { id: "n1", tag: "p", text: "Body" } },
  { label: "Link", Component: LinkElement, node: { id: "n1", tag: "a", text: "Learn more", href: "/about" } },
  { label: "List Item", Component: ListItemElement, node: { id: "n1", tag: "li", text: "Item" } },
  { label: "Button", Component: ButtonElement, node: { id: "n1", tag: "button", text: "Go" } },
  { label: "Table", Component: TableElement, node: { id: "n1", tag: "table", children: [] } },
  { label: "Image", Component: ImageElement, node: { id: "n1", tag: "img" } },
  { label: "Video", Component: VideoElement, node: { id: "n1", tag: "video" } },
  { label: "SVG", Component: SvgElement, node: { id: "n1", tag: "svg" } },
  { label: "Iframe", Component: IframeElement, node: { id: "n1", tag: "iframe" } },
  { label: "Input (and every same-tag subtype: email/password/number/search/url/tel/checkbox/radio)", Component: InputElement, node: { id: "n1", tag: "input", inputType: "text" } },
  { label: "Textarea", Component: TextareaElement, node: { id: "n1", tag: "textarea" } },
  { label: "Select", Component: SelectElement, node: { id: "n1", tag: "select", children: [] } },
  { label: "Dialog", Component: DialogElement, node: { id: "n1", tag: "dialog", children: [] } },
];

const FLOW_DISPLAYS: FlowDisplayMode[] = ["block", "flex", "grid"];

describe("Resize Compatibility Matrix (Checkpoint 1.15.6.1.1, Workstream C)", () => {
  describe.each(CASES)("$label", ({ Component, node }) => {
    it.each(FLOW_DISPLAYS)("persists a manual resize in Content Layout mode '%s' — width/height are neither reverted nor forced to 100%%", (parentFlowDisplay) => {
      const resized: EditorElementNode = { ...node, dimensions: { preferredWidth: 222, preferredHeight: 111, offsetX: 0, offsetY: 0 } };

      const { container } = render(
        <Component node={resized} parentId="parent-1" parentLayoutMode="flow" parentFlowDisplay={parentFlowDisplay} />,
      );

      const rendered = container.querySelector('[data-node-id="n1"]') as HTMLElement;
      expect(rendered).not.toBeNull();
      expect(rendered.style.width).toBe("222px");
      expect(rendered.style.height).toBe("111px");
    });

    it("keeps its own authored Free geometry exactly when its Free container retains a stale (inactive) Grid flowLayout — rendered through the real DocumentNodeRenderer tree, not with a contradictory prop combination forced directly onto the leaf component", () => {
      const freeChild: EditorElementNode = { ...node, freeLayout: { x: 10, y: 20, width: 80, height: 40 } };
      const freeContainer: EditorElementNode = {
        id: "parent-1",
        tag: "div",
        layoutMode: "free",
        flowLayout: { display: "grid" },
        children: [freeChild],
      };

      const { container } = render(
        <DocumentNodeRenderer node={freeContainer} parentId={null} parentLayoutMode="flow" parentFlowDisplay="block" />,
      );

      const rendered = container.querySelector('[data-node-id="n1"]') as HTMLElement;
      expect(rendered).not.toBeNull();
      expect(rendered.style.position).toBe("absolute");
      expect(rendered.style.width).toBe("80px");
      expect(rendered.style.height).toBe("40px");
      expect(rendered.style.left).toBe("10px");
      expect(rendered.style.top).toBe("20px");
    });
  });
});
