import type { CSSProperties } from "react";
import {
  DOCUMENT_DEFAULT_STYLE_IDS,
  resolveAudioElementStyle,
  resolveBoxElementStyle,
  resolveContainerElementStyle,
  resolveControlElementStyle,
  resolveDialogAccessibleDescription,
  resolveDialogAccessibleName,
  resolveDialogElementStyle,
  resolveImageElementStyle,
  resolveLegacyBodyElementStyle,
  resolveOptionElementStyle,
  resolvePageRootElementStyle,
  resolveSvgElementStyle,
  resolveTableCellElementStyle,
  resolveTableStructureElementStyle,
  resolveTextElementStyle,
  resolveVideoOrIframeElementStyle,
  type CssDeclaration,
  type DocumentDefaultStyleId,
  type ElementStyleContext,
  type ElementStyleRecipe,
} from "@/features/canvas";
import { canParentAcceptChild } from "@/features/editor/rules/insertionRules";
import { editorElementNodeSchema } from "@/features/editor/schemas/editorDocumentSchema";
import { getFlowLayoutSettings } from "@/features/editor/types/flowLayout";
import { getInputType } from "@/features/editor/types/input";
import { getInteractions } from "@/features/editor/types/interactions";
import { getLayoutMode } from "@/features/editor/types/layout";
import { getLinkHref } from "@/features/editor/types/link";
import { getInitialPreviewVisibility } from "@/features/editor/types/previewVisibility";
import { getProgressMax, getProgressValue } from "@/features/editor/types/progress";
import { getSelectedOptionValue } from "@/features/editor/types/select";
import { DEFAULT_SVG_FILL, formatSvgViewBox, getSvgKind, resolveSvgFill, resolveSvgStroke, resolveSvgStrokeWidth, resolveSvgViewBox } from "@/features/editor/types/svg";
import { hasSvgScene, resolveSvgScene, type SvgVectorObject } from "@/features/editor/types/svgScene";
import { getMediaControls } from "@/features/editor/types/video";
import { formatSvgPoints, pathCommandsToD } from "@/features/editor/utils/svgObjectGeometry";
import { SVG_CIRCLE_GEOMETRY, SVG_RECTANGLE_GEOMETRY, SVG_STAR_POINTS, SVG_TRIANGLE_POINTS } from "@/features/editor/utils/svgPrimitiveGeometry";
// Deep import by necessity: the project feature's index.ts also re-exports
// React components, which a pure, DOM-free generator must not load.
import { DEFAULT_PROJECT_LIMITS, type ProjectLimits } from "@/features/project/rules/projectLimits";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { ContainerLayoutMode } from "@/features/editor/types/layout";
import type { FlowDisplayMode } from "@/features/editor/types/flowLayout";
import type { ExportDiagnostic, ExportDiagnosticCode, ExportDiagnosticSeverity } from "@/features/export/types/exportDiagnostic";
import type { ExportAsset, ExportAttribute, ExportDocument, ExportElement, ExportInteraction, ExportNode } from "@/features/export/types/exportIr";
import { escapeCssString, stripNullCharacters } from "@/features/export/utils/escapeMarkup";
import { checkExportUrl, type ExportUrlContext } from "@/features/export/utils/exportUrlPolicy";
import { serializeStyleObject } from "@/features/export/utils/serializeStyleObject";
import { isExportableColor, validateCssDeclarationValue } from "@/features/export/utils/validateExportCssValue";

/*
 * Builds the Export IR from an authored document (EXPORT-1.2). It mirrors
 * DocumentNodeRenderer's traversal — the same parent layout context, the
 * same tag families and the same shared style recipes — rendering the
 * page as it appears in Preview, minus everything editor-only (data-node-*
 * attributes, drag/selection state, placeholder icons, media interaction
 * shields, editing affordances). Pure: no DOM, no React runtime, no store.
 */

const CONTAINER_TAGS: ReadonlySet<string> = new Set(["div", "section", "ul", "ol", "header", "nav", "main", "article", "aside", "footer", "form", "label", "fieldset", "figure"]);
const TEXT_TAGS: ReadonlySet<string> = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "legend", "figcaption", "a", "button"]);
const TABLE_STRUCTURE_TAGS: ReadonlySet<string> = new Set(["thead", "tbody", "tfoot", "tr"]);
const TABLE_CELL_TAGS: ReadonlySet<string> = new Set(["th", "td", "caption"]);
const RESERVED_CLASS_PREFIX = "ly-";

interface Placement {
  parentLayoutMode: ContainerLayoutMode;
  parentFlowDisplay: FlowDisplayMode;
}

interface BuildState {
  nextIndex: number;
  diagnostics: ExportDiagnostic[];
  usedDefaults: Set<DocumentDefaultStyleId>;
  htmlIds: Map<string, string>;
  interactions: ExportInteraction[];
  assets: ExportAsset[];
  nodeIds: ReadonlySet<string>;
}

export type BuildExportDocumentResult =
  | { ok: true; document: ExportDocument }
  | { ok: false; diagnostics: ExportDiagnostic[] };

function report(state: { diagnostics: ExportDiagnostic[] }, severity: ExportDiagnosticSeverity, code: ExportDiagnosticCode, message: string, nodeId?: string, property?: string) {
  state.diagnostics.push({ code, severity, message, ...(nodeId !== undefined ? { nodeId } : {}), ...(property !== undefined ? { property } : {}) });
}

/** Iterative size/depth scan, run before anything recursive touches untrusted input. */
function checkLimits(document: EditorElementNode, limits: ProjectLimits): ExportDiagnostic[] {
  const diagnostics: ExportDiagnostic[] = [];
  const stack: Array<[unknown, number]> = [[document, 1]];
  let count = 0;
  while (stack.length > 0) {
    const [node, depth] = stack.pop() ?? [undefined, 0];
    count++;
    if (count > limits.maxElementNodes) {
      report({ diagnostics }, "error", "document-too-large", `The document has more than ${limits.maxElementNodes} elements, the most a project may contain.`);
      return diagnostics;
    }
    if (depth > limits.maxElementDepth) {
      report({ diagnostics }, "error", "document-too-deep", `Elements are nested more than ${limits.maxElementDepth} levels deep, the most a project may contain.`);
      return diagnostics;
    }
    const children = typeof node === "object" && node !== null && "children" in node ? node.children : undefined;
    if (Array.isArray(children)) for (const child of children) stack.push([child, depth + 1]);
  }
  return diagnostics;
}

function collectNodeIds(document: EditorElementNode): Set<string> {
  const ids = new Set<string>();
  const stack = [document];
  for (let node = stack.pop(); node; node = stack.pop()) {
    ids.add(node.id);
    if (node.children) stack.push(...node.children);
  }
  return ids;
}

function checkedUrl(state: BuildState, nodeId: string, property: string, url: string | undefined, context: ExportUrlContext): string | undefined {
  if (url === undefined || url === "") return undefined;
  const check = checkExportUrl(url, context);
  if (check.ok) {
    if (check.kind !== "fragment") state.assets.push({ nodeId, property, url: check.url, kind: check.kind });
    if (check.kind === "relative") {
      report(state, "info", "relative-url", `"${url}" is a relative path; the file it points to must be published next to the exported page.`, nodeId, property);
    }
    return check.url;
  }
  if (check.reason === "non-portable") {
    report(state, "warning", "non-portable-url", `The ${check.scheme}: URL in ${property} only exists inside this editor session, so it was not exported.`, nodeId, property);
  } else {
    report(state, "warning", "unsafe-url", `The ${check.scheme ?? ""}: URL in ${property} is not allowed in exported pages, so it was not exported.`, nodeId, property);
  }
  return undefined;
}

const CSS_URL_VALUE = /^url\(("(?:[^"\\]|\\[\s\S])*")\)$/;

/** The authored style object as validated CSS declarations, in cascade order. */
function exportDeclarations(state: BuildState, nodeId: string, style: CSSProperties): CssDeclaration[] {
  const declarations: CssDeclaration[] = [];
  for (const [property, value] of serializeStyleObject(style)) {
    if (property === "background-image" && value.startsWith("url(")) {
      // resolveBackgroundStyle writes url(<JSON string>); re-check the URL
      // and re-serialize it with CSS (not JSON) string escaping.
      const match = CSS_URL_VALUE.exec(value);
      let raw: unknown;
      try {
        raw = match ? JSON.parse(match[1]) : undefined;
      } catch {
        raw = undefined;
      }
      const url = typeof raw === "string" ? checkedUrl(state, nodeId, property, raw, "image") : undefined;
      if (url !== undefined) declarations.push([property, `url(${escapeCssString(url)})`]);
      else if (typeof raw !== "string") report(state, "warning", "invalid-css-value", "The background image value could not be read, so it was not exported.", nodeId, property);
      continue;
    }
    const check = validateCssDeclarationValue(property, value);
    if (check.ok) declarations.push([property, value]);
    else report(state, "warning", check.code, check.message, nodeId, property);
  }
  return declarations;
}

/** The authored HTML id and class tokens, validated — applied to the node's genuine element. */
function identity(state: BuildState, node: EditorElementNode): { attributes: ExportAttribute[]; classNames: string[] } {
  const attributes: ExportAttribute[] = [];
  if (node.htmlId !== undefined && node.htmlId !== "") {
    if (/\s/.test(node.htmlId)) {
      report(state, "warning", "invalid-html-id", `"${node.htmlId}" contains whitespace, which an HTML id cannot, so it was not exported.`, node.id, "id");
    } else {
      const firstOwner = state.htmlIds.get(node.htmlId);
      if (firstOwner === undefined) state.htmlIds.set(node.htmlId, node.id);
      else report(state, "warning", "duplicate-html-id", `The id "${node.htmlId}" is used by more than one element; ids must be unique in a page.`, node.id, "id");
      attributes.push({ name: "id", value: node.htmlId });
    }
  }
  const classNames: string[] = [];
  for (const token of (node.className ?? "").split(/\s+/)) {
    if (token === "") continue;
    if (token.startsWith(RESERVED_CLASS_PREFIX)) {
      report(state, "warning", "reserved-class-name", `The class "${token}" uses the "${RESERVED_CLASS_PREFIX}" prefix reserved for generated classes, so it was not exported.`, node.id, "class");
      continue;
    }
    classNames.push(token);
  }
  return { attributes, classNames };
}

function text(state: BuildState, node: EditorElementNode, value: string | undefined): ExportNode[] {
  if (value === undefined || value === "") return [];
  const { text: stripped, changed } = stripNullCharacters(value);
  if (changed) report(state, "info", "control-characters-removed", "NUL characters were removed from the text.", node.id);
  return [{ kind: "text", text: stripped }];
}

function attribute(name: string, value: string | number | boolean | undefined): ExportAttribute[] {
  if (value === undefined || value === false) return [];
  return [{ name, value: value === true ? true : String(value) }];
}

function makeElement(
  state: BuildState,
  node: EditorElementNode,
  tag: string,
  styleKey: string,
  recipe: { defaults: readonly DocumentDefaultStyleId[]; style: CSSProperties },
  attributes: ExportAttribute[],
  classNames: string[],
  children: ExportNode[],
): ExportElement {
  for (const id of recipe.defaults) state.usedDefaults.add(id);
  return {
    kind: "element",
    tag,
    sourceNodeId: node.id,
    styleKey,
    defaultStyles: [...recipe.defaults],
    declarations: exportDeclarations(state, node.id, recipe.style),
    attributes,
    authoredClassNames: classNames,
    children,
  };
}

function svgPaint(state: BuildState, nodeId: string, name: "fill" | "stroke", value: string | undefined): ExportAttribute[] {
  if (value === undefined) return [];
  if (value === "none" || isExportableColor(value)) return [{ name, value }];
  report(state, "warning", "invalid-svg-paint", `"${value}" is not a valid SVG ${name} color, so it was not exported.`, nodeId, name);
  return [];
}

/** The SVG's vector content, exactly as SvgElement / SvgVectorObjectRenderer draw it outside edit mode. */
function svgContent(state: BuildState, node: EditorElementNode, styleKey: string): ExportElement[] {
  const shape = (tag: string, index: number, attributes: ExportAttribute[]): ExportElement => ({
    kind: "element",
    tag,
    sourceNodeId: node.id,
    styleKey: `${styleKey}-shape-${index}`,
    defaultStyles: [],
    declarations: [],
    attributes,
    authoredClassNames: [],
    children: [],
  });
  if (hasSvgScene(node)) {
    return resolveSvgScene(node).objects.map((object: SvgVectorObject, index) => {
      const presentation = [...svgPaint(state, node.id, "fill", object.fill ?? "none"), ...(object.stroke ? [...svgPaint(state, node.id, "stroke", object.stroke), ...attribute("stroke-width", object.strokeWidth ?? 1)] : [])];
      switch (object.type) {
        case "rect":
          return shape("rect", index, [...attribute("x", object.x), ...attribute("y", object.y), ...attribute("width", object.width), ...attribute("height", object.height), ...presentation]);
        case "ellipse":
          return shape("ellipse", index, [...attribute("cx", object.cx), ...attribute("cy", object.cy), ...attribute("rx", object.rx), ...attribute("ry", object.ry), ...presentation]);
        case "line":
          // A fill-only line is invisible, so it always gets a stroke (SvgVectorObjectRenderer).
          return shape("line", index, [...attribute("x1", object.x1), ...attribute("y1", object.y1), ...attribute("x2", object.x2), ...attribute("y2", object.y2), ...svgPaint(state, node.id, "stroke", object.stroke ?? DEFAULT_SVG_FILL), ...attribute("stroke-width", object.strokeWidth ?? 1)]);
        case "polygon":
          return shape("polygon", index, [...attribute("points", formatSvgPoints(object.points)), ...presentation]);
        case "path":
          return shape("path", index, [...attribute("d", pathCommandsToD(object.commands)), ...presentation]);
      }
    });
  }
  const stroke = resolveSvgStroke(node);
  const presentation = [...svgPaint(state, node.id, "fill", resolveSvgFill(node)), ...(stroke ? [...svgPaint(state, node.id, "stroke", stroke), ...attribute("stroke-width", resolveSvgStrokeWidth(node))] : [])];
  switch (getSvgKind(node)) {
    case "rectangle":
      return [shape("rect", 0, [...attribute("x", SVG_RECTANGLE_GEOMETRY.x), ...attribute("y", SVG_RECTANGLE_GEOMETRY.y), ...attribute("width", SVG_RECTANGLE_GEOMETRY.width), ...attribute("height", SVG_RECTANGLE_GEOMETRY.height), ...presentation])];
    case "circle":
      return [shape("circle", 0, [...attribute("cx", SVG_CIRCLE_GEOMETRY.cx), ...attribute("cy", SVG_CIRCLE_GEOMETRY.cy), ...attribute("r", SVG_CIRCLE_GEOMETRY.r), ...presentation])];
    case "triangle":
      return [shape("polygon", 0, [...attribute("points", SVG_TRIANGLE_POINTS), ...presentation])];
    case "star":
      return [shape("polygon", 0, [...attribute("points", SVG_STAR_POINTS), ...presentation])];
  }
}

function childPlacement(node: EditorElementNode): Placement {
  const layoutMode = getLayoutMode(node);
  // A Free container's retained flowLayout must never reach its children
  // (see DocumentNodeRenderer): Free children are positioned by freeLayout.
  return { parentLayoutMode: layoutMode, parentFlowDisplay: layoutMode === "free" ? "block" : getFlowLayoutSettings(node).display };
}

function buildChildren(state: BuildState, node: EditorElementNode): ExportNode[] {
  const placement = childPlacement(node);
  const children: ExportNode[] = [];
  for (const child of node.children ?? []) {
    if (node.tag !== "page" && !canParentAcceptChild(node.tag, child.tag)) {
      report(state, "warning", "invalid-nesting", `A <${child.tag}> inside a <${node.tag}> is not a structure the editor creates; it was exported as authored.`, child.id);
    }
    children.push(buildNode(state, child, placement));
  }
  return children;
}

function ignoreChildren(state: BuildState, node: EditorElementNode) {
  if (node.children && node.children.length > 0) {
    report(state, "warning", "ignored-children", `<${node.tag}> elements cannot contain other elements, so ${node.children.length} child element(s) were not exported (the Canvas does not render them either).`, node.id);
  }
}

function buildSelect(state: BuildState, node: EditorElementNode, styleKey: string, context: ElementStyleContext): ExportElement {
  const own = identity(state, node);
  const selectedValue = getSelectedOptionValue(node);
  let selectionApplied = false;
  const options: ExportNode[] = [];
  for (const child of node.children ?? []) {
    if (child.tag !== "option") {
      report(state, "warning", "invalid-nesting", `A <${child.tag}> inside a <select> is not a structure the editor creates; it was exported as authored.`, child.id);
      options.push(buildNode(state, child, childPlacement(node)));
      continue;
    }
    const optionKey = `node-${state.nextIndex++}`;
    const optionIdentity = identity(state, child);
    // The Canvas sets select.value to the selected option's value, which
    // selects the FIRST option carrying that value — mirrored here.
    const isSelected = !selectionApplied && selectedValue !== undefined && (child.value ?? child.text ?? "") === selectedValue;
    if (isSelected) selectionApplied = true;
    options.push(
      makeElement(state, child, "option", optionKey, resolveOptionElementStyle(child), [...optionIdentity.attributes, ...attribute("value", child.value), ...attribute("selected", isSelected)], optionIdentity.classNames, text(state, child, child.text)),
    );
    ignoreChildren(state, child);
  }
  return makeElement(state, node, "select", styleKey, resolveControlElementStyle(node, context), [...own.attributes, ...attribute("name", node.name)], own.classNames, options);
}

function buildMediaFrame(
  state: BuildState,
  node: EditorElementNode,
  styleKey: string,
  recipe: { defaults: DocumentDefaultStyleId[]; style: CSSProperties; innerStyle: CSSProperties },
  inner: { tag: string; attributes: ExportAttribute[] } | undefined,
): ExportElement {
  const children: ExportNode[] = [];
  if (inner) {
    const own = identity(state, node);
    children.push(makeElement(state, node, inner.tag, `${styleKey}-media`, { defaults: [], style: recipe.innerStyle }, [...own.attributes, ...inner.attributes], own.classNames, []));
  }
  ignoreChildren(state, node);
  // The outer frame is a layout box only: the authored id/class belong to the genuine inner element.
  return makeElement(state, node, "div", styleKey, recipe, [], [], children);
}

function buildElement(state: BuildState, node: EditorElementNode, styleKey: string, context: ElementStyleContext): ExportElement {
  const { tag } = node;

  if (tag === "page") return makeElement(state, node, "div", styleKey, resolvePageRootElementStyle(), [], [], buildChildren(state, node));
  if (tag === "body") return makeElement(state, node, "div", styleKey, resolveLegacyBodyElementStyle(), [], [], buildChildren(state, node));

  if (CONTAINER_TAGS.has(tag)) {
    const own = identity(state, node);
    return makeElement(state, node, tag, styleKey, resolveContainerElementStyle(node, context), own.attributes, own.classNames, buildChildren(state, node));
  }

  if (TEXT_TAGS.has(tag)) {
    const own = identity(state, node);
    const extra: ExportAttribute[] = [];
    if (tag === "a") extra.push({ name: "href", value: checkedUrl(state, node.id, "href", getLinkHref(node), "link") ?? "#" });
    if (tag === "button") extra.push({ name: "type", value: "button" });
    ignoreChildren(state, node);
    return makeElement(state, node, tag, styleKey, resolveTextElementStyle(node, context), [...own.attributes, ...extra], own.classNames, text(state, node, node.text));
  }

  if (tag === "input") {
    const own = identity(state, node);
    ignoreChildren(state, node);
    const attributes = [
      ...own.attributes,
      { name: "type", value: getInputType(node) },
      ...attribute("name", node.name),
      ...attribute("placeholder", node.placeholder),
      ...attribute("value", node.value),
      ...attribute("checked", node.checked === true),
    ];
    return makeElement(state, node, "input", styleKey, resolveControlElementStyle(node, context), attributes, own.classNames, []);
  }

  if (tag === "textarea") {
    const own = identity(state, node);
    ignoreChildren(state, node);
    const attributes = [...own.attributes, ...attribute("name", node.name), ...attribute("placeholder", node.placeholder)];
    return makeElement(state, node, "textarea", styleKey, resolveControlElementStyle(node, context), attributes, own.classNames, text(state, node, node.value));
  }

  if (tag === "select") return buildSelect(state, node, styleKey, context);

  if (tag === "table") {
    const own = identity(state, node);
    return makeElement(state, node, "table", styleKey, resolveControlElementStyle(node, context), own.attributes, own.classNames, buildChildren(state, node));
  }

  if (TABLE_STRUCTURE_TAGS.has(tag)) {
    const own = identity(state, node);
    return makeElement(state, node, tag, styleKey, resolveTableStructureElementStyle(node), own.attributes, own.classNames, buildChildren(state, node));
  }

  if (TABLE_CELL_TAGS.has(tag)) {
    const own = identity(state, node);
    ignoreChildren(state, node);
    return makeElement(state, node, tag, styleKey, resolveTableCellElementStyle(node, context), own.attributes, own.classNames, text(state, node, node.text));
  }

  if (tag === "option") {
    // Only reachable for an option outside a <select> (buildSelect handles the normal case).
    const own = identity(state, node);
    return makeElement(state, node, "option", styleKey, resolveOptionElementStyle(node), [...own.attributes, ...attribute("value", node.value)], own.classNames, text(state, node, node.text));
  }

  if (tag === "hr" || tag === "progress") {
    const own = identity(state, node);
    ignoreChildren(state, node);
    const extra = tag === "progress" ? [...attribute("value", getProgressValue(node)), ...attribute("max", getProgressMax(node))] : [];
    return makeElement(state, node, tag, styleKey, resolveBoxElementStyle(node, context), [...own.attributes, ...extra], own.classNames, []);
  }

  if (tag === "img") {
    const src = checkedUrl(state, node.id, "src", node.src, "image");
    if (src === undefined && !node.src) report(state, "warning", "missing-media-source", "The image has no source, so its exported frame is empty (the Canvas shows a placeholder icon there).", node.id, "src");
    // alt mirrors the Canvas, which uses the element's display name.
    return buildMediaFrame(state, node, styleKey, resolveImageElementStyle(node, context), src === undefined ? undefined : { tag: "img", attributes: [{ name: "src", value: src }, { name: "alt", value: node.displayName ?? "" }] });
  }

  if (tag === "video" || tag === "audio") {
    const src = checkedUrl(state, node.id, "src", node.src, "media");
    const poster = tag === "video" ? checkedUrl(state, node.id, "poster", node.poster, "image") : undefined;
    const attributes = [...attribute("src", src), ...attribute("poster", poster), ...attribute("controls", getMediaControls(node)), ...attribute("autoplay", node.autoplay === true), ...attribute("muted", node.muted === true), ...attribute("loop", node.loop === true)];
    const recipe = tag === "video" ? resolveVideoOrIframeElementStyle(node, context) : resolveAudioElementStyle(node, context);
    return buildMediaFrame(state, node, styleKey, recipe, { tag, attributes });
  }

  if (tag === "iframe") {
    const src = checkedUrl(state, node.id, "src", node.src, "frame");
    return buildMediaFrame(state, node, styleKey, resolveVideoOrIframeElementStyle(node, context), { tag: "iframe", attributes: [...attribute("src", src), ...attribute("title", node.title)] });
  }

  if (tag === "svg") {
    const own = identity(state, node);
    ignoreChildren(state, node);
    return makeElement(state, node, "svg", styleKey, resolveSvgElementStyle(node, context), [...own.attributes, { name: "viewBox", value: formatSvgViewBox(resolveSvgViewBox(node)) }], own.classNames, svgContent(state, node, styleKey));
  }

  if (tag === "dialog") {
    const own = identity(state, node);
    const isOpen = getInitialPreviewVisibility(node) !== "hidden";
    report(state, "warning", "dialog-requires-runtime", isOpen ? "This dialog is open when Preview starts; standalone HTML shows it non-modally until the interaction runtime (EXPORT-1.3) opens it as a modal." : "This dialog starts closed; opening it needs the interaction runtime (EXPORT-1.3).", node.id);
    const attributes = [...own.attributes, ...attribute("aria-label", resolveDialogAccessibleName(node)), ...attribute("aria-description", resolveDialogAccessibleDescription(node)), ...attribute("open", isOpen)];
    return makeElement(state, node, "dialog", styleKey, resolveDialogElementStyle(node, context), attributes, own.classNames, buildChildren(state, node));
  }

  // FallbackElement: an unrendered tag becomes a plain, unstyled <div> around its children.
  report(state, "warning", "unsupported-element", `<${tag}> has no renderer, so it was exported as a plain <div>, matching the Canvas.`, node.id);
  const empty: ElementStyleRecipe = { defaults: [], style: {} };
  return makeElement(state, node, "div", styleKey, empty, [], [], buildChildren(state, node));
}

function buildNode(state: BuildState, node: EditorElementNode, placement: Placement): ExportElement {
  const styleKey = `node-${state.nextIndex++}`;
  const element = buildElement(state, node, styleKey, { ...placement, isPreview: true });

  // Preview starts with authored-hidden nodes removed; `hidden` reproduces
  // that statically (a dialog's own closed state already does).
  if (node.tag !== "dialog" && getInitialPreviewVisibility(node) === "hidden") element.attributes.push({ name: "hidden", value: true });

  const bindings = getInteractions(node);
  if (bindings.length > 0) {
    for (const binding of bindings) {
      if (!state.nodeIds.has(binding.targetId)) continue;
      state.interactions.push({ triggerNodeId: node.id, targetNodeId: binding.targetId, trigger: binding.trigger, action: binding.action });
    }
    report(state, "warning", "interaction-requires-runtime", `This element has ${bindings.length} click interaction(s); they are exported as static structure only until the interaction runtime (EXPORT-1.3).`, node.id);
  }
  return element;
}

/**
 * Validates an authored document with the project's own boundaries
 * (limits, then the strict schema) and converts it to the Export IR.
 * Any error-severity finding refuses the export.
 */
export function buildExportDocument(document: EditorElementNode, limits: ProjectLimits = DEFAULT_PROJECT_LIMITS): BuildExportDocumentResult {
  const limitDiagnostics = checkLimits(document, limits);
  if (limitDiagnostics.length > 0) return { ok: false, diagnostics: limitDiagnostics };

  const parsed = editorElementNodeSchema.safeParse(document);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      diagnostics: [{ code: "invalid-document", severity: "error", message: `The document is not a valid Layoutry document (${issue?.message ?? "invalid"} at ${issue?.path.join(".") || "root"}).` }],
    };
  }

  const state: BuildState = {
    nextIndex: 1,
    diagnostics: [],
    usedDefaults: new Set(),
    htmlIds: new Map(),
    interactions: [],
    assets: [],
    nodeIds: collectNodeIds(parsed.data),
  };
  const root = buildNode(state, parsed.data, { parentLayoutMode: "flow", parentFlowDisplay: "block" });
  return {
    ok: true,
    document: {
      root,
      defaultStyles: DOCUMENT_DEFAULT_STYLE_IDS.filter((id) => state.usedDefaults.has(id)),
      interactions: state.interactions,
      assets: state.assets,
      diagnostics: state.diagnostics,
    },
  };
}
