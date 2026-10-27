import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DocumentNodeRenderer } from "@/features/canvas/components/document/DocumentNodeRenderer";
import { documentDefaultClasses } from "@/features/canvas/utils/documentDefaultStyles";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { buildExportDocument } from "@/features/export/utils/buildExportDocument";
import type { ExportAttribute, ExportElement } from "@/features/export/types/exportIr";
import { cn } from "@/lib/utils";
import { catalogDocument, VISUAL_PARITY_DOCUMENTS } from "../../../../test/fixtures/export/exportFixtureDocuments";

/**
 * Drift guard (EXPORT-1.2): renders each fixture with the real Canvas
 * components in Preview mode and checks, node by node, that export chose
 * the same tag, the same inline styles (through the same CSSOM), the same
 * default classes, the same attributes and the same text. Because both
 * sides call the shared element style recipes, a failure here means the
 * export's per-tag mapping or layout context has diverged from the
 * Canvas's.
 */

const initialStoreState = useEditorStore.getState();
afterEach(() => useEditorStore.setState(initialStoreState, true));

// Canvas-only attributes, and attributes whose Canvas form is runtime
// state rather than markup: `open`/`hidden` follow Preview's runtime
// visibility (tested separately), React applies `muted` and an option's
// selection as DOM properties, never attributes. `readonly` is the Canvas's
// own guard that keeps form fields inert outside a text-editing session.
const IGNORED_ATTRIBUTES = new Set(["data-node-id", "data-node-type", "data-parent-id", "style", "class", "contenteditable", "draggable", "readonly", "open", "hidden", "muted", "selected"]);

/**
 * Longhand → value for a style declaration block. Compared per longhand
 * because the CSSOM may serialize the same longhands as a shorthand
 * depending on how they were set (React assigns camelCase properties).
 */
function longhandValues(style: CSSStyleDeclaration): Record<string, string> {
  const values: Record<string, string> = {};
  for (let index = 0; index < style.length; index++) {
    const name = style.item(index);
    values[name] = style.getPropertyValue(name);
  }
  return values;
}

/** The Canvas inline style minus editor-only declarations (SVG's drag-to-draw `user-select: none`). */
function canvasStyle(element: Element): Record<string, string> {
  const values = longhandValues((element as HTMLElement).style);
  if (element.tagName.toLowerCase() === "svg") delete values["user-select"];
  return values;
}

/**
 * React writes `value=""` onto a checkbox/radio with no authored value
 * (its `node.value = ""` reflects to the attribute for toggles). Export
 * omits it, keeping the browser's standard "on" — a Canvas-only artifact.
 */
function withoutReactToggleValue(element: Element, attributes: Record<string, string>): Record<string, string> {
  const type = element.getAttribute("type");
  if (element.tagName.toLowerCase() === "input" && (type === "checkbox" || type === "radio") && attributes.value === "") {
    return Object.fromEntries(Object.entries(attributes).filter(([name]) => name !== "value"));
  }
  return attributes;
}

function exportedStyle(element: ExportElement): Record<string, string> {
  const probe = document.createElement("div");
  for (const [property, value] of element.declarations) probe.style.setProperty(property, value);
  return longhandValues(probe.style);
}

function classTokens(value: string | null): string[] {
  return (value ?? "").split(/\s+/).filter(Boolean).sort();
}

function canvasAttributes(element: Element): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const { name, value } of Array.from(element.attributes)) if (!IGNORED_ATTRIBUTES.has(name)) attributes[name] = value;
  return attributes;
}

function exportAttributes(attributes: readonly ExportAttribute[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const { name, value } of attributes) if (!IGNORED_ATTRIBUTES.has(name)) result[name] = value === true ? "" : value;
  return result;
}

function indexPrimaryElements(root: ExportElement): Map<string, ExportElement> {
  const index = new Map<string, ExportElement>();
  const visit = (element: ExportElement) => {
    if (/^node-\d+$/.test(element.styleKey)) index.set(element.sourceNodeId, element);
    for (const child of element.children) if (child.kind === "element") visit(child);
  };
  visit(root);
  return index;
}

function elementText(element: ExportElement): string {
  return element.children.map((child) => (child.kind === "text" ? child.text : "")).join("");
}

function compareElement(canvas: Element, exported: ExportElement, label: string) {
  expect(canvas.tagName.toLowerCase(), `${label} tag`).toBe(exported.tag);
  expect(canvasStyle(canvas), `${label} style`).toEqual(exportedStyle(exported));
  expect(withoutReactToggleValue(canvas, canvasAttributes(canvas)), `${label} attributes`).toEqual(exportAttributes(exported.attributes));
}

function assertParity(documentNode: EditorElementNode) {
  useEditorStore.setState({ editorMode: "preview", runtimeVisibility: {} });
  const { container } = render(<DocumentNodeRenderer node={documentNode} parentId={null} parentLayoutMode="flow" parentFlowDisplay="block" />);

  const built = buildExportDocument(documentNode);
  if (!built.ok) throw new Error(JSON.stringify(built.diagnostics));
  const exported = indexPrimaryElements(built.document.root);

  const canvasNodes = Array.from(container.querySelectorAll("[data-node-id]"));
  expect(canvasNodes.length).toBe(exported.size);

  for (const canvas of canvasNodes) {
    const nodeId = canvas.getAttribute("data-node-id") ?? "";
    const element = exported.get(nodeId);
    expect(element, `export element for ${nodeId}`).toBeDefined();
    if (!element) continue;
    const isMediaFrame = element.children.length === 1 && element.children[0].kind === "element" && element.children[0].styleKey.endsWith("-media");
    const isEmptyImageFrame = canvas.getAttribute("data-node-type") === "img" && element.children.length === 0;

    compareElement(canvas, element, nodeId);
    const authored = isMediaFrame ? [] : element.authoredClassNames;
    expect(classTokens(canvas.getAttribute("class")), `${nodeId} classes`).toEqual(classTokens(cn(documentDefaultClasses(element.defaultStyles), ...authored)));

    if (isMediaFrame && element.children[0].kind === "element") {
      const inner = element.children[0];
      const canvasInner = canvas.firstElementChild;
      expect(canvasInner, `${nodeId} inner media`).not.toBeNull();
      if (canvasInner) {
        compareElement(canvasInner, inner, `${nodeId} inner`);
        expect(classTokens(canvasInner.getAttribute("class"))).toEqual(classTokens(inner.authoredClassNames.join(" ")));
      }
    } else if (isEmptyImageFrame) {
      // The Canvas's placeholder icon is editor-only and never exported.
      expect(canvas.querySelector("svg[aria-hidden='true']")).not.toBeNull();
    } else if (element.tag === "svg") {
      const shapes = element.children.filter((child): child is ExportElement => child.kind === "element");
      const canvasShapes = Array.from(canvas.children);
      expect(canvasShapes.map((shape) => shape.tagName.toLowerCase())).toEqual(shapes.map((shape) => shape.tag));
      canvasShapes.forEach((shape, index) => expect(canvasAttributes(shape), `${nodeId} shape ${index}`).toEqual(exportAttributes(shapes[index].attributes)));
    } else if (element.children.every((child) => child.kind === "text") && element.children.length > 0) {
      expect(canvas.textContent, `${nodeId} text`).toBe(elementText(element));
    }

    if (element.tag === "select") {
      const selected = element.children.find((child) => child.kind === "element" && child.attributes.some((attribute) => attribute.name === "selected"));
      const expectedValue = selected && selected.kind === "element" ? (selected.attributes.find((attribute) => attribute.name === "value")?.value ?? elementText(selected)) : (canvas as HTMLSelectElement).options[0]?.value;
      expect((canvas as HTMLSelectElement).value, `${nodeId} selected option`).toBe(expectedValue);
    }
  }
}

describe("Canvas/export parity", () => {
  it.each(VISUAL_PARITY_DOCUMENTS.map(({ name, build }) => [name, build] as const))("%s fixture exports exactly what the Canvas renders", (_name, build) => {
    assertParity(build());
  });

  it("every catalog entry exports exactly what the Canvas renders", () => {
    assertParity(catalogDocument());
  });
});
