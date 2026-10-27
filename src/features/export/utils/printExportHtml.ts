import { getDocumentDefaultStyle } from "@/features/canvas";
import type { ExportDiagnostic } from "@/features/export/types/exportDiagnostic";
import type { ExportAttribute, ExportDocument, ExportElement, ExportNode } from "@/features/export/types/exportIr";
import { escapeHtmlAttribute, escapeHtmlText } from "@/features/export/utils/escapeMarkup";
import { buildBehaviorAttributes, type ElementBehaviorAttributes } from "@/features/export/utils/exportBehaviorAttributes";
import { exportElementClassNames } from "@/features/export/utils/exportClassNames";

const VOID_ELEMENTS: ReadonlySet<string> = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

/**
 * Attribute names are generated, never authored, but they are still
 * checked here as the last line of defense: no event handlers (`on*`),
 * nothing a parser could read as more than one attribute. `data-*` and
 * `aria-*` pass; mixed case is allowed for SVG (`viewBox`).
 */
function isSafeAttributeName(name: string): boolean {
  return /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/i.test(name) && !/^on/i.test(name);
}

/**
 * Whether whitespace between this element's children can never render.
 * Collapsible whitespace between flex or grid items generates no box,
 * and table-structure/select/SVG content ignores it — so only there are
 * children placed on their own indented lines. Everywhere else they are
 * printed back to back, exactly like the Canvas DOM (React emits no
 * whitespace), because a stray space between inline-level siblings (links,
 * buttons, inputs) would visibly shift them.
 */
function ignoresWhitespaceBetweenChildren(element: ExportElement): boolean {
  if (["table", "thead", "tbody", "tfoot", "tr", "select", "svg"].includes(element.tag)) return true;
  let display: string | undefined;
  for (const id of element.defaultStyles) {
    for (const [property, value] of getDocumentDefaultStyle(id).declarations) if (property === "display") display = value;
  }
  for (const [property, value] of element.declarations) if (property === "display") display = value;
  return display === "flex" || display === "inline-flex" || display === "grid" || display === "inline-grid";
}

interface PrintContext {
  diagnostics: ExportDiagnostic[];
  inSvg: boolean;
  behaviorAttributes: ReadonlyMap<string, ElementBehaviorAttributes>;
}

/** The element that stands for its editor node (not a media frame's inner element or an SVG shape). */
function isPrimaryElement(element: ExportElement): boolean {
  return /^node-\d+$/.test(element.styleKey);
}

function printAttributes(element: ExportElement, context: PrintContext): string {
  const classNames = exportElementClassNames(element);
  const behavior = isPrimaryElement(element) ? context.behaviorAttributes.get(element.sourceNodeId) : undefined;
  const ids = element.attributes.filter((attribute) => attribute.name === "id");
  if (behavior?.id !== undefined && ids.length === 0) ids.push({ name: "id", value: behavior.id });
  const rest = element.attributes.filter((attribute) => attribute.name !== "id");
  // Deterministic order: id, class, the element's own attributes in recipe
  // order, then accessibility state and interaction-runtime hooks.
  const ordered: ExportAttribute[] = [
    ...ids,
    ...(classNames.length > 0 ? [{ name: "class", value: classNames.join(" ") }] : []),
    ...rest,
    ...(behavior?.attributes ?? []),
  ];
  let printed = "";
  for (const { name, value } of ordered) {
    if (!isSafeAttributeName(name)) {
      context.diagnostics.push({ code: "unsafe-attribute", severity: "error", nodeId: element.sourceNodeId, property: name, message: `The attribute name "${name}" is not allowed in exported markup.` });
      continue;
    }
    printed += value === true ? ` ${name}` : ` ${name}="${escapeHtmlAttribute(value)}"`;
  }
  return printed;
}

function printText(text: string, parentTag: string): string {
  // The HTML parser drops one newline directly after <textarea>; keep the authored one.
  const leadingNewline = parentTag === "textarea" && text.startsWith("\n") ? "\n" : "";
  return leadingNewline + escapeHtmlText(text);
}

function printNode(node: ExportNode, parentTag: string, depth: number, context: PrintContext): string {
  return node.kind === "text" ? printText(node.text, parentTag) : printElement(node, depth, context);
}

function printElement(element: ExportElement, depth: number, context: PrintContext): string {
  const open = `<${element.tag}${printAttributes(element, context)}`;
  if (VOID_ELEMENTS.has(element.tag) && !context.inSvg) return `${open}>`;

  const childContext: PrintContext = { ...context, inSvg: context.inSvg || element.tag === "svg" };
  if (element.children.length === 0) return childContext.inSvg && element.tag !== "svg" ? `${open} />` : `${open}></${element.tag}>`;

  const hasElementChildren = element.children.some((child) => child.kind === "element");
  if (hasElementChildren && ignoresWhitespaceBetweenChildren(element)) {
    const indent = "  ".repeat(depth + 1);
    const children = element.children.map((child) => `\n${indent}${printNode(child, element.tag, depth + 1, childContext)}`).join("");
    return `${open}>${children}\n${"  ".repeat(depth)}</${element.tag}>`;
  }
  const children = element.children.map((child) => printNode(child, element.tag, depth + 1, childContext)).join("");
  return `${open}>${children}</${element.tag}>`;
}

export type ExportStylesheetPlacement = { kind: "embedded"; css: string } | { kind: "linked"; href: string };

export type ExportScriptPlacement = { kind: "embedded"; source: string } | { kind: "linked"; src: string };

export interface PrintExportHtmlOptions {
  title: string;
  lang: string;
  stylesheet: ExportStylesheetPlacement;
  /** The interaction runtime, when the page needs one (EXPORT-1.3). Static pages get no script. */
  script?: ExportScriptPlacement;
}

function collectTags(element: ExportElement, tags: Map<string, string>) {
  if (isPrimaryElement(element)) tags.set(element.sourceNodeId, element.tag);
  for (const child of element.children) if (child.kind === "element") collectTags(child, tags);
}

function printScript(script: ExportScriptPlacement): string {
  if (script.kind === "linked") return `<script src="${escapeHtmlAttribute(script.src)}"></script>`;
  // The runtime is a constant, but it is embedded in HTML: anything that
  // could end the element early (or open a comment that changes how the
  // parser reads it) is refused outright.
  if (/<\/script|<!--/i.test(script.source)) throw new Error("Refusing to embed a script that contains </script or <!--.");
  return `<script>\n${script.source}</script>`;
}

/**
 * A complete HTML5 document for the Export IR (EXPORT-1.2). The page root
 * becomes the body's only child. When the page has interactions, the
 * runtime script follows it at the end of <body> (EXPORT-1.3), after every
 * element it reads, and the elements carry the generated attributes it
 * reads (see exportInteractionRuntime.ts). Findings (an unsafe attribute
 * name) are appended to `diagnostics`.
 */
export function printExportHtml(document: ExportDocument, options: PrintExportHtmlOptions, diagnostics: ExportDiagnostic[]): string {
  let stylesheet: string;
  if (options.stylesheet.kind === "embedded") {
    // Every value was validated to contain no "<" (url() strings escape it),
    // so the stylesheet cannot close its own <style> element. Checked again
    // here because a failure would be a code-injection bug, not bad content.
    if (/<\/style/i.test(options.stylesheet.css)) throw new Error("Refusing to embed a stylesheet that contains </style.");
    stylesheet = `<style>\n${options.stylesheet.css}</style>`;
  } else {
    stylesheet = `<link rel="stylesheet" href="${escapeHtmlAttribute(options.stylesheet.href)}">`;
  }
  const tags = new Map<string, string>();
  collectTags(document.root, tags);
  const behaviorAttributes = buildBehaviorAttributes(document.behaviors, tags);
  const body = printElement(document.root, 1, { diagnostics, inSvg: false, behaviorAttributes });
  return [
    "<!DOCTYPE html>",
    `<html lang="${escapeHtmlAttribute(options.lang)}">`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtmlText(options.title)}</title>`,
    stylesheet,
    "</head>",
    "<body>",
    `  ${body}`,
    ...(options.script ? [printScript(options.script)] : []),
    "</body>",
    "</html>",
    "",
  ].join("\n");
}
