import { createElementNode, INSERTABLE_ELEMENT_TYPES } from "@/features/editor/factories/elementFactories";
import type { EditorElementNode } from "@/features/editor/types/document";

/*
 * Authored documents for EXPORT-1.2's fidelity tests — shared by the jsdom
 * Canvas/export parity test, the determinism/security unit tests and the
 * Playwright visual parity spec. Every document uses fixed ids and only
 * offline assets (data: URLs), so renders are reproducible.
 */

let counter = 0;
function id(tag: string): string {
  counter += 1;
  return `${tag}-fx${counter}`;
}

function node(tag: string, fields: Omit<EditorElementNode, "id" | "tag"> = {}): EditorElementNode {
  return { id: id(tag), tag, ...fields };
}

const px = (value: number) => ({ value, unit: "px" as const });
const spacing = (padding: number, margin = 0) => ({
  margin: { top: margin, right: margin, bottom: margin, left: margin },
  padding: { top: padding, right: padding, bottom: padding, left: padding },
});
const block = { display: "block" as const };

/** A small offline raster-free image: a two-tone SVG as a data: URL. */
export const FIXTURE_IMAGE_SRC =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200"><rect width="400" height="200" fill="#0ea5e9"/><circle cx="120" cy="100" r="60" fill="#f97316"/><rect x="220" y="40" width="140" height="120" fill="#22c55e"/></svg>',
  );

function page(children: EditorElementNode[]): EditorElementNode {
  return { id: "page-root", tag: "page", children };
}

function section(children: EditorElementNode[], extra: Omit<EditorElementNode, "id" | "tag"> = {}): EditorElementNode {
  return node("section", { flowLayout: block, spacing: spacing(24), children, ...extra });
}

export function typographyDocument(): EditorElementNode {
  counter = 0;
  return page([
    section([
      node("h1", { text: "Heading One" }),
      node("h2", { text: "Heading Two — default size matches every level" }),
      node("p", { text: "A default paragraph uses the base size, relaxed leading and the prose measure so long lines wrap the way the Canvas wraps them." }),
      node("p", {
        text: "Authored typography",
        typography: {
          fontSize: px(22),
          fontWeight: 700,
          fontStyle: "italic",
          color: "#1d4ed8",
          letterSpacing: px(1),
          lineHeight: { value: 1.8, unit: "unitless" },
          textAlign: "center",
          textDecorationLine: "underline",
        },
      }),
      node("a", { text: "Default link", href: "https://example.com/" }),
      node("a", { text: "Link without underline", href: "#section", typography: { textDecorationLine: "none", color: "rgb(220, 38, 38)" } }),
      node("ul", { flowLayout: block, spacing: spacing(8), children: [node("li", { text: "First bullet" }), node("li", { text: "Second bullet" })] }),
      node("ol", { children: [node("li", { text: "Legacy ordered item" })] }),
      node("figure", { flowLayout: block, spacing: spacing(0), children: [node("figcaption", { text: "A figure caption" })] }),
      node("fieldset", { flowLayout: block, spacing: spacing(12), children: [node("legend", { text: "Legend text" })] }),
    ]),
  ]);
}

export function boxStylesDocument(): EditorElementNode {
  counter = 0;
  const tile = (fields: Omit<EditorElementNode, "id" | "tag">, label: string) =>
    node("div", { flowLayout: block, spacing: spacing(16), dimensions: { preferredWidth: 180, preferredHeight: 90, offsetX: 0, offsetY: 0 }, children: [node("p", { text: label })], ...fields });
  return page([
    section(
      [
        tile({ background: { color: "#fde68a" } }, "Background color"),
        tile({ background: { sourceType: "gradient", gradient: { type: "linear", angle: 135, stops: [{ id: "s1", color: "#6366f1", position: 0 }, { id: "s2", color: "#ec4899", position: 100 }] } } }, "Linear"),
        tile({ background: { sourceType: "gradient", gradient: { type: "radial", shape: "circle", position: "center", stops: [{ id: "s3", color: "#fef3c7", position: 0 }, { id: "s4", color: "#f59e0b", position: 100 }] } } }, "Radial"),
        tile({ background: { sourceType: "image", image: FIXTURE_IMAGE_SRC, size: "cover", position: "center", repeat: "no-repeat" } }, "Image"),
        tile({ border: { top: { width: px(4), style: "solid", color: "#0f172a" }, right: { width: px(2), style: "dashed", color: "#dc2626" }, bottom: { width: px(6), style: "dotted", color: "#16a34a" }, left: { width: px(1), style: "solid", color: "#2563eb" } } }, "Borders"),
        tile({ borderRadius: { topLeft: px(24), topRight: px(4), bottomRight: { value: 50, unit: "%" }, bottomLeft: px(0) }, background: { color: "#bae6fd" } }, "Radius"),
        tile({ boxShadow: [{ id: "b1", enabled: true, inset: false, offsetX: px(0), offsetY: px(8), blur: px(16), spread: px(-4), color: "rgba(15, 23, 42, 0.35)" }, { id: "b2", enabled: true, inset: true, offsetX: px(2), offsetY: px(2), blur: px(0), spread: px(0), color: "#f97316" }] }, "Shadows"),
        tile({ filters: { opacity: 0.6, grayscale: 0.5 }, background: { color: "#22c55e" }, transition: { property: "opacity", durationMs: 200, timingFunction: "ease-in-out", delayMs: 50 } }, "Opacity + filter"),
        tile({ transform: { rotateDeg: 6, scale: 0.9, translateX: 10 }, background: { color: "#e9d5ff" } }, "Transform"),
        tile({ shape: "circle", background: { color: "#fca5a5" } }, "Shape"),
        tile({ display: { overflow: "hidden" }, background: { color: "#f1f5f9" }, children: [node("p", { text: "Overflowing content that is much longer than this small tile can show, so it is clipped by overflow hidden." })] }, "Overflow"),
      ],
      { flowLayout: { display: "flex", flex: { direction: "row", wrap: "wrap", justifyContent: "start", alignItems: "start", rowGap: 16, columnGap: 16 } } },
    ),
  ]);
}

export function spacingNestingDocument(): EditorElementNode {
  counter = 0;
  return page([
    section([
      node("div", {
        flowLayout: block,
        spacing: { margin: { top: 12, right: 0, bottom: 20, left: 32 }, padding: { top: 8, right: 24, bottom: 16, left: 4 } },
        background: { color: "#eef2ff" },
        children: [
          node("div", {
            flowLayout: block,
            spacing: spacing(12, 6),
            background: { color: "#c7d2fe" },
            children: [node("p", { text: "Nested three levels deep", spacing: spacing(4, 2) })],
          }),
          node("h3", { text: "Resized heading", dimensions: { preferredWidth: 260, preferredHeight: 44, offsetX: 16, offsetY: 8 } }),
          node("p", { text: "Size constraints clamp this paragraph.", sizeConstraints: { maxWidth: 220, minHeight: 60 }, background: { color: "#fef9c3" } }),
          node("div", { aspectRatio: { mode: "ratio", width: 16, height: 9 }, dimensions: { preferredWidth: 240, preferredHeight: 100, offsetX: 0, offsetY: 0 }, background: { color: "#a7f3d0" } }),
        ],
      }),
      node("div", { children: [node("p", { text: "A legacy container without flow or spacing data" })] }),
    ]),
  ]);
}

export function freeLayoutDocument(): EditorElementNode {
  counter = 0;
  return page([
    section([
      node("div", {
        layoutMode: "free",
        flowLayout: { display: "flex", flex: { direction: "row", wrap: "nowrap", justifyContent: "start", alignItems: "start", rowGap: 0, columnGap: 0 } },
        spacing: spacing(10),
        dimensions: { preferredWidth: 640, preferredHeight: 320, offsetX: 0, offsetY: 0 },
        background: { color: "#f8fafc" },
        children: [
          node("h2", { text: "Free heading", freeLayout: { x: 20, y: 16, width: 300, height: 48 } }),
          node("button", { text: "Free button", freeLayout: { x: 420, y: 24, width: 140, height: 40 } }),
          node("p", { text: "A free paragraph never gets the prose measure.", freeLayout: { x: 24, y: 96, width: 260, height: 80 } }),
          node("div", {
            layoutMode: "free",
            freeLayout: { x: 320, y: 120, width: 280, height: 170 },
            background: { color: "#dbeafe" },
            children: [node("div", { freeLayout: { x: 30, y: 40, width: 120, height: 60 }, background: { color: "#2563eb" } })],
          }),
        ],
      }),
    ]),
  ]);
}

export function flexboxDocument(): EditorElementNode {
  counter = 0;
  const item = (label: string, fields: Omit<EditorElementNode, "id" | "tag"> = {}) => node("div", { flowLayout: block, spacing: spacing(8), background: { color: "#e0e7ff" }, children: [node("p", { text: label })], ...fields });
  return page([
    section([
      node("div", {
        flowLayout: { display: "flex", flex: { direction: "row", wrap: "wrap", justifyContent: "space-between", alignItems: "center", rowGap: 12, columnGap: 20 } },
        spacing: spacing(12),
        background: { color: "#f1f5f9" },
        children: [
          item("grow 1", { flexChild: { grow: 1, shrink: 1, basis: "auto", alignSelf: "auto" } }),
          item("basis 200", { flexChild: { grow: 0, shrink: 1, basis: 200, alignSelf: "end" } }),
          item("self start", { flexChild: { grow: 0, shrink: 0, basis: "auto", alignSelf: "start" } }),
          node("button", { text: "Button item" }),
          node("a", { text: "Link item", href: "#" }),
        ],
      }),
      node("div", {
        flowLayout: { display: "flex", flex: { direction: "column", wrap: "nowrap", justifyContent: "center", alignItems: "stretch", rowGap: 8, columnGap: 0 } },
        spacing: spacing(12),
        dimensions: { preferredWidth: 360, preferredHeight: 220, offsetX: 0, offsetY: 0 },
        background: { color: "#ecfeff" },
        children: [item("column A"), item("column B resized", { dimensions: { preferredWidth: 180, preferredHeight: 50, offsetX: 0, offsetY: 0 } })],
      }),
    ]),
  ]);
}

export function gridDocument(): EditorElementNode {
  counter = 0;
  const cell = (label: string, fields: Omit<EditorElementNode, "id" | "tag"> = {}) => node("div", { flowLayout: block, spacing: spacing(8), background: { color: "#fae8ff" }, children: [node("p", { text: label })], ...fields });
  return page([
    section([
      node("div", {
        flowLayout: { display: "grid", grid: { columns: 3, rows: "auto", rowGap: 12, columnGap: 16 } },
        spacing: spacing(12),
        background: { color: "#faf5ff" },
        children: [
          cell("span 2", { gridChild: { columnStart: "auto", columnSpan: 2, rowStart: "auto", rowSpan: 1 } }),
          cell("auto"),
          cell("placed col 3 row 2", { gridChild: { columnStart: 3, columnSpan: 1, rowStart: 2, rowSpan: 2 } }),
          cell("resized", { dimensions: { preferredWidth: 120, preferredHeight: 50, offsetX: 0, offsetY: 0 } }),
          cell("last"),
        ],
      }),
      node("div", {
        flowLayout: { display: "grid", grid: { columns: 2, rows: 2, rowGap: 4, columnGap: 4 } },
        spacing: spacing(4),
        dimensions: { preferredWidth: 300, preferredHeight: 160, offsetX: 0, offsetY: 0 },
        children: [cell("1"), cell("2"), cell("3"), cell("4")],
      }),
    ]),
  ]);
}

export function mediaAndFormsDocument(): EditorElementNode {
  counter = 0;
  return page([
    section([
      node("img", { src: FIXTURE_IMAGE_SRC, displayName: "Fixture image", mediaFit: { objectFit: "contain" } }),
      node("img", { src: FIXTURE_IMAGE_SRC, dimensions: { preferredWidth: 220, preferredHeight: 140, offsetX: 0, offsetY: 0 }, mediaFit: { objectFit: "cover", objectPositionX: { value: 0, unit: "%" }, objectPositionY: { value: 50, unit: "%" } } }),
      node("svg", { svgKind: "star", svgFill: "#f59e0b", svgStroke: "#92400e", svgStrokeWidth: 2 }),
      node("svg", {
        svgViewBox: { minX: 0, minY: 0, width: 200, height: 100 },
        aspectRatio: { mode: "ratio", width: 2, height: 1 },
        svgScene: {
          objects: [
            { id: "o1", type: "rect", x: 10, y: 10, width: 80, height: 50, fill: "#22c55e" },
            { id: "o2", type: "ellipse", cx: 140, cy: 50, rx: 40, ry: 30, fill: "#3b82f6", stroke: "#1e3a8a", strokeWidth: 3 },
            { id: "o3", type: "line", x1: 0, y1: 95, x2: 200, y2: 95 },
            { id: "o4", type: "path", commands: [{ kind: "M", x: 100, y: 5 }, { kind: "L", x: 120, y: 30 }, { kind: "L", x: 80, y: 30 }, { kind: "Z" }], fill: "#ef4444" },
          ],
        },
      }),
      node("hr"),
      node("input", { inputType: "text", placeholder: "Your name", name: "name" }),
      node("input", { inputType: "email", value: "ada@example.com" }),
      node("label", { flowLayout: { display: "flex", flex: { direction: "row", wrap: "nowrap", justifyContent: "start", alignItems: "center", rowGap: 0, columnGap: 8 } }, spacing: spacing(0), children: [node("input", { inputType: "checkbox", checked: true }), node("p", { text: "Checked box" })] }),
      node("textarea", { value: "Multi-line\nauthored value" }),
      node("select", { children: [node("option", { text: "First" }), node("option", { text: "Second", selected: true })] }),
      node("progress", { progressValue: 40, progressMax: 100 }),
    ]),
  ]);
}

/** Every catalog entry's factory output, in catalog order, inside one page. */
export function catalogDocument(): EditorElementNode {
  return { id: "page-root", tag: "page", children: INSERTABLE_ELEMENT_TYPES.map((type) => createElementNode(type)) };
}

/** Named visual-parity fixtures, in report order. */
export const VISUAL_PARITY_DOCUMENTS: ReadonlyArray<{ name: string; build: () => EditorElementNode }> = [
  { name: "typography", build: typographyDocument },
  { name: "box-styles", build: boxStylesDocument },
  { name: "spacing-nesting", build: spacingNestingDocument },
  { name: "free-layout", build: freeLayoutDocument },
  { name: "flexbox", build: flexboxDocument },
  { name: "grid", build: gridDocument },
  { name: "media-forms", build: mediaAndFormsDocument },
];
