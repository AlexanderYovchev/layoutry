import { describe, expect, it } from "vitest";
import { documentNodeComponents } from "@/features/canvas/components/document/documentNodeComponents";
import { INSERTABLE_ELEMENT_TYPES } from "@/features/editor/factories/elementFactories";
import type { EditorElementNode } from "@/features/editor/types/document";
import { DEFAULT_PROJECT_LIMITS } from "@/features/project/rules/projectLimits";
import type { ExportDocument, ExportElement } from "@/features/export/types/exportIr";
import { buildExportDocument } from "@/features/export/utils/buildExportDocument";
import { catalogDocument } from "../../../../test/fixtures/export/exportFixtureDocuments";

function page(children: EditorElementNode[]): EditorElementNode {
  return { id: "page-root", tag: "page", children };
}

function build(document: EditorElementNode): ExportDocument {
  const result = buildExportDocument(document);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.document;
}

function find(root: ExportElement, sourceNodeId: string, suffix = ""): ExportElement {
  const stack: ExportElement[] = [root];
  for (let element = stack.pop(); element; element = stack.pop()) {
    if (element.sourceNodeId === sourceNodeId && (suffix === "" ? /^node-\d+$/.test(element.styleKey) : element.styleKey.endsWith(suffix))) return element;
    for (const child of element.children) if (child.kind === "element") stack.push(child);
  }
  throw new Error(`no export element for ${sourceNodeId}${suffix}`);
}

const declarationMap = (element: ExportElement) => Object.fromEntries(element.declarations);
const attributeMap = (element: ExportElement) => Object.fromEntries(element.attributes.map(({ name, value }) => [name, value]));

describe("buildExportDocument — validation boundaries", () => {
  it("refuses a document that fails the project schema", () => {
    const result = buildExportDocument(page([{ id: "x-1", tag: "script", text: "alert(1)" }]));
    expect(result).toMatchObject({ ok: false, diagnostics: [{ code: "invalid-document", severity: "error" }] });
  });

  it("refuses documents beyond the project's element and depth limits before parsing them", () => {
    const wide = page(Array.from({ length: 5 }, (_, index) => ({ id: `p-${index}`, tag: "p" })));
    expect(buildExportDocument(wide, { ...DEFAULT_PROJECT_LIMITS, maxElementNodes: 3 })).toMatchObject({ ok: false, diagnostics: [{ code: "document-too-large" }] });

    let deep: EditorElementNode = { id: "leaf", tag: "div" };
    for (let level = 0; level < 150; level++) deep = { id: `div-${level}`, tag: "div", children: [deep] };
    expect(buildExportDocument(page([deep]))).toMatchObject({ ok: false, diagnostics: [{ code: "document-too-deep" }] });
  });
});

describe("buildExportDocument — layout context", () => {
  it("positions Free children absolutely inside a relatively positioned host, ignoring its retained grid", () => {
    const document = build(
      page([
        {
          id: "free-1",
          tag: "div",
          layoutMode: "free",
          flowLayout: { display: "grid", grid: { columns: 2, rows: "auto", rowGap: 0, columnGap: 0 } },
          children: [{ id: "child-1", tag: "p", text: "x", freeLayout: { x: 12, y: 34, width: 100, height: 40 } }],
        },
      ]),
    );
    expect(declarationMap(find(document.root, "free-1"))).toMatchObject({ position: "relative" });
    expect(declarationMap(find(document.root, "free-1"))["display"]).toBeUndefined();
    const child = declarationMap(find(document.root, "child-1"));
    expect(child).toMatchObject({ position: "absolute", left: "12px", top: "34px", width: "100px", height: "40px" });
    expect(child["grid-column"]).toBeUndefined();
    // A paragraph in a Free parent never gets the prose measure.
    expect(find(document.root, "child-1").defaultStyles).toEqual(["paragraph"]);
  });

  it("gives Flex and Grid children their item CSS from the parent's own flow display", () => {
    const document = build(
      page([
        { id: "flex-1", tag: "div", flowLayout: { display: "flex", flex: { direction: "row", wrap: "nowrap", justifyContent: "center", alignItems: "center", rowGap: 4, columnGap: 8 } }, children: [{ id: "item-1", tag: "div", flexChild: { grow: 2, shrink: 0, basis: 100, alignSelf: "end" } }] },
        { id: "grid-1", tag: "div", flowLayout: { display: "grid", grid: { columns: 3, rows: 2, rowGap: 0, columnGap: 0 } }, children: [{ id: "cell-1", tag: "div", gridChild: { columnStart: 2, columnSpan: 2, rowStart: "auto", rowSpan: 1 } }] },
      ]),
    );
    expect(declarationMap(find(document.root, "flex-1"))).toMatchObject({ display: "flex", "flex-direction": "row", "justify-content": "center", "row-gap": "4px", "column-gap": "8px" });
    expect(declarationMap(find(document.root, "item-1"))).toMatchObject({ "flex-grow": "2", "flex-shrink": "0", "flex-basis": "100px", "align-self": "flex-end" });
    expect(declarationMap(find(document.root, "grid-1"))).toMatchObject({ display: "grid", "grid-template-columns": "repeat(3, minmax(0, 1fr))", "grid-template-rows": "repeat(2, minmax(0, 1fr))" });
    expect(declarationMap(find(document.root, "cell-1"))).toMatchObject({ "grid-column": "2 / span 2", "grid-row": "span 1", width: "100%", height: "100%" });
  });

  it("keeps a legacy container's fallback presentation and nested structure", () => {
    const document = build(page([{ id: "legacy-1", tag: "div", children: [{ id: "inner-1", tag: "section", children: [] }] }]));
    expect(find(document.root, "legacy-1").defaultStyles).toEqual(["container-radius", "container-border", "container-flow", "container-padding"]);
    expect(find(document.root, "legacy-1").children).toHaveLength(1);
  });
});

describe("buildExportDocument — Preview semantics and editor-only state", () => {
  it("exports authored transitions, which Design mode suppresses on the Canvas", () => {
    const document = build(page([{ id: "t-1", tag: "div", transition: { property: "opacity", durationMs: 300, timingFunction: "ease", delayMs: 0 } }]));
    expect(declarationMap(find(document.root, "t-1"))).toMatchObject({ "transition-property": "opacity", "transition-duration": "300ms" });
  });

  it("marks authored-hidden nodes hidden, and leaves an initially-hidden dialog closed", () => {
    const document = build(
      page([
        { id: "panel-1", tag: "div", initialPreviewVisibility: "hidden" },
        { id: "dialog-1", tag: "dialog", initialPreviewVisibility: "hidden", children: [] },
        { id: "dialog-2", tag: "dialog", children: [] },
      ]),
    );
    expect(attributeMap(find(document.root, "panel-1"))).toMatchObject({ hidden: true });
    expect(attributeMap(find(document.root, "dialog-1"))).not.toHaveProperty("open");
    expect(attributeMap(find(document.root, "dialog-1"))).not.toHaveProperty("hidden");
    expect(attributeMap(find(document.root, "dialog-2"))).toMatchObject({ open: true });
    // Only the dialog that opens at load needs the runtime (to re-open it modally).
    expect(document.behaviors.targets).toEqual([{ token: 1, nodeId: "dialog-2", kind: "dialog", initiallyVisible: true, domId: "ly-target-1", generatedDomId: true }]);
    expect(document.diagnostics).toEqual([]);
  });

  it("records interactions and their runtime behavior, skipping bindings to missing nodes", () => {
    const document = build(
      page([
        { id: "button-1", tag: "button", text: "Toggle", interactions: [{ id: "i-1", trigger: "click", action: "toggle", targetId: "panel-1" }, { id: "i-2", trigger: "click", action: "show", targetId: "gone-1" }] },
        { id: "panel-1", tag: "div" },
      ]),
    );
    expect(document.interactions).toEqual([{ triggerNodeId: "button-1", targetNodeId: "panel-1", trigger: "click", action: "toggle" }]);
    expect(document.behaviors.triggers).toEqual([{ nodeId: "button-1", actions: [{ action: "toggle", targetToken: 1 }], dismissibleTargetTokens: [], expandsTargetToken: 1, opensDialog: false }]);
    expect(document.diagnostics).toEqual([]);
  });

  it("drops editor-only fields and children the Canvas does not render", () => {
    const document = build(page([{ id: "h-1", tag: "h2", text: "Title", displayName: "Hero title", lockChildStyles: true, aspectRatioLocked: true, children: [{ id: "stray-1", tag: "p", text: "never rendered" }] }]));
    const heading = find(document.root, "h-1");
    expect(heading.attributes).toEqual([]);
    expect(heading.children).toEqual([{ kind: "text", text: "Title" }]);
    expect(document.diagnostics).toContainEqual(expect.objectContaining({ code: "ignored-children", nodeId: "h-1" }));
  });

  it("puts a media element's id and classes on the genuine inner element, not the layout frame", () => {
    const document = build(page([{ id: "img-1", tag: "img", src: "https://example.com/a.png", htmlId: "hero", className: "photo", displayName: "Team photo" }]));
    expect(attributeMap(find(document.root, "img-1"))).toEqual({});
    const inner = find(document.root, "img-1", "-media");
    expect(attributeMap(inner)).toEqual({ id: "hero", src: "https://example.com/a.png", alt: "Team photo" });
    expect(inner.authoredClassNames).toEqual(["photo"]);
    expect(document.assets).toEqual([{ nodeId: "img-1", property: "src", url: "https://example.com/a.png", kind: "remote" }]);
  });

  it("selects the first option carrying the authored selection's value", () => {
    const document = build(page([{ id: "s-1", tag: "select", children: [{ id: "o-1", tag: "option", text: "A" }, { id: "o-2", tag: "option", text: "B", value: "b", selected: true }, { id: "o-3", tag: "option", text: "C", value: "b" }] }]));
    expect(attributeMap(find(document.root, "o-2"))).toMatchObject({ selected: true, value: "b" });
    expect(attributeMap(find(document.root, "o-3"))).not.toHaveProperty("selected");
  });
});

describe("buildExportDocument — security diagnostics", () => {
  it("replaces an unsafe link with the Canvas's own '#' fallback and drops unsafe media", () => {
    const document = build(
      page([
        { id: "a-1", tag: "a", text: "x", href: "vbscript:msgbox(1)" },
        { id: "img-1", tag: "img", src: "data:text/html,<script>alert(1)</script>" },
        { id: "frame-1", tag: "iframe", src: "data:text/html,<script>alert(1)</script>", title: "x" },
      ]),
    );
    expect(attributeMap(find(document.root, "a-1"))).toMatchObject({ href: "#" });
    expect(find(document.root, "img-1").children).toEqual([]);
    expect(attributeMap(find(document.root, "frame-1", "-media"))).not.toHaveProperty("src");
    expect(document.diagnostics.filter((diagnostic) => diagnostic.code === "unsafe-url")).toHaveLength(3);
  });

  it("drops injected CSS values, invalid colors and font families with a diagnostic each", () => {
    const document = build(
      page([
        { id: "p-1", tag: "p", text: "x", typography: { color: "red;}</style><script>alert(1)</script>", fontFamily: "Arial; background: red" }, background: { color: "notacolor" } },
        { id: "p-2", tag: "p", text: "y", typography: { fontFamily: "3D Font", color: "#123456" } },
      ]),
    );
    expect(find(document.root, "p-1").declarations).toEqual([]);
    expect(find(document.root, "p-2").declarations).toEqual([["color", "#123456"]]);
    expect(document.diagnostics.map((diagnostic) => `${diagnostic.nodeId}:${diagnostic.property}:${diagnostic.code}`).sort()).toEqual([
      "p-1:background-color:invalid-color",
      "p-1:color:invalid-css-value",
      "p-1:font-family:invalid-css-value",
      "p-2:font-family:invalid-font-family",
    ]);
  });

  it("re-serializes background image URLs with CSS escaping", () => {
    const document = build(page([{ id: "d-1", tag: "div", background: { sourceType: "image", image: "https://example.com/a(1)</style>.png" } }]));
    expect(declarationMap(find(document.root, "d-1"))["background-image"]).toBe('url("https://example.com/a(1)\\3c /style>.png")');
  });

  it("validates authored ids and reserves the generated class prefix", () => {
    const document = build(
      page([
        { id: "d-1", tag: "div", htmlId: "hero", className: "card ly-node-1 featured" },
        { id: "d-2", tag: "div", htmlId: "hero" },
        { id: "d-3", tag: "div", htmlId: "has space" },
      ]),
    );
    expect(find(document.root, "d-1").authoredClassNames).toEqual(["card", "featured"]);
    expect(attributeMap(find(document.root, "d-3"))).not.toHaveProperty("id");
    expect(document.diagnostics.map((diagnostic) => diagnostic.code).sort()).toEqual(["duplicate-html-id", "invalid-html-id", "reserved-class-name"]);
  });
});

describe("buildExportDocument — coverage", () => {
  it("handles every tag the Canvas has a renderer for without falling back", () => {
    const tags = Object.keys(documentNodeComponents).filter((tag) => tag !== "page");
    const document = build(page(tags.map((tag, index) => ({ id: `n-${index}`, tag }))));
    expect(document.diagnostics.filter((diagnostic) => diagnostic.code === "unsupported-element")).toEqual([]);
  });

  it("exports all 81 catalog entries, flagging only source-less images", () => {
    expect(INSERTABLE_ELEMENT_TYPES).toHaveLength(81);
    const document = build(catalogDocument());
    const codes = new Set(document.diagnostics.map((diagnostic) => diagnostic.code));
    expect([...codes].sort()).toEqual(["missing-media-source"]);
    // Only image cards whose factory leaves the image empty for the user to fill in.
    for (const diagnostic of document.diagnostics.filter((entry) => entry.code === "missing-media-source")) expect(diagnostic.nodeId).toMatch(/^img-/);
  });
});
