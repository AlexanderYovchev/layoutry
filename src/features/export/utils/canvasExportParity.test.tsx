import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DocumentNodeRenderer } from "@/features/canvas/components/document/DocumentNodeRenderer";
import { getDocumentDefaultStyle } from "@/features/canvas/utils/documentDefaultStyles";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { buildExportDocument } from "@/features/export/utils/buildExportDocument";
import type { ExportAttribute, ExportElement } from "@/features/export/types/exportIr";
import { catalogDocument, VISUAL_PARITY_DOCUMENTS } from "../../../../test/fixtures/export/exportFixtureDocuments";
import { generatedStyleOf, installDocumentStyles } from "../../../../test/documentStyles";

/**
 * Drift guard (EXPORT-1.2): renders each fixture with the real Canvas
 * components in Preview mode and checks, node by node, that export chose
 * the same tag, the same effective declarations (through the same CSSOM),
 * the same classes, the same attributes and the same text.
 *
 * BC-17.3: the Canvas no longer carries default classes or inline authored
 * styles — the generated Preview stylesheet (the shared compiler) holds
 * both. So each Canvas element is compared by what that installed sheet
 * declares for it (defaults, then its own base rule, in cascade order)
 * against the export's default presentations followed by its own
 * declarations. Its inline style must be empty (no live gesture), and it
 * carries its generated class plus exactly the exported authored classes.
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
function canvasInlineStyle(element: Element): Record<string, string> {
  const values = longhandValues((element as HTMLElement).style);
  if (element.tagName.toLowerCase() === "svg") delete values["user-select"];
  return values;
}

/** What the installed Preview sheet declares for the Canvas element (inline style excluded: it must be empty). */
function canvasStyle(element: Element): Record<string, string> {
  const values = longhandValues(generatedStyleOf(element as HTMLElement));
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

/** The export element's default presentations (table order; @media skipped, as on the Canvas side), then its own declarations. */
function exportedStyle(element: ExportElement): Record<string, string> {
  const probe = document.createElement("div");
  for (const id of element.defaultStyles) for (const [property, value] of getDocumentDefaultStyle(id).declarations) probe.style.setProperty(property, value);
  for (const [property, value] of element.declarations) probe.style.setProperty(property, value);
  // Read back through a stylesheet rule, exactly as generatedStyleOf reads the Canvas side (the CSSOM lists
  // shorthands differently for inline and rule declarations).
  const sheet = document.createElement("style");
  sheet.textContent = `.parity-probe { ${probe.style.cssText} }`;
  document.head.appendChild(sheet);
  const rule = sheet.sheet?.cssRules[0];
  const read = document.createElement("div").style;
  if (rule instanceof CSSStyleRule) for (const name of Array.from(rule.style)) read.setProperty(name, rule.style.getPropertyValue(name), rule.style.getPropertyPriority(name));
  sheet.remove();
  return longhandValues(read);
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
  expect(canvasInlineStyle(canvas), `${label} inline style`).toEqual({});
  expect(canvasStyle(canvas), `${label} style`).toEqual(exportedStyle(exported));
  expect(withoutReactToggleValue(canvas, canvasAttributes(canvas)), `${label} attributes`).toEqual(exportAttributes(exported.attributes));
}

function assertParity(documentNode: EditorElementNode) {
  useEditorStore.setState({ editorMode: "preview", runtimeVisibility: {} });
  const { container } = render(<DocumentNodeRenderer node={documentNode} parentId={null} parentLayoutMode="flow" parentFlowDisplay="block" />);
  installDocumentStyles(documentNode, { surface: "preview" });

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
    expect(classTokens(canvas.getAttribute("class")), `${nodeId} classes`).toEqual([`ly-n-${nodeId}`, ...authored].sort());

    if (isMediaFrame && element.children[0].kind === "element") {
      const inner = element.children[0];
      const canvasInner = canvas.firstElementChild;
      expect(canvasInner, `${nodeId} inner media`).not.toBeNull();
      if (canvasInner) {
        compareElement(canvasInner, inner, `${nodeId} inner`);
        expect(classTokens(canvasInner.getAttribute("class"))).toEqual([`ly-ni-${nodeId}`, ...inner.authoredClassNames].sort());
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

  // BC-17.3: ~270 elements compared through the jsdom cascade over a real generated sheet; a larger budget than the default 5 s.
  it("every catalog entry exports exactly what the Canvas renders", { timeout: 20000 }, () => {
    assertParity(catalogDocument());
  });
});
