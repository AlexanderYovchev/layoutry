import type { Page } from "@playwright/test";
import type { ExportElement } from "../../src/features/export/types/exportIr";

/*
 * Browser-side measurement helpers for EXPORT-1.2's visual parity spec.
 * Everything that runs inside page.evaluate is self-contained (it is
 * serialized into the page), so it cannot reference module scope.
 */

/** Computed properties compared element by element. `cursor` is excluded: the Canvas wrapper's pointer cursor is editor chrome. */
export const COMPARED_PROPERTIES = [
  "display", "position", "top", "left", "right", "bottom", "z-index", "box-sizing",
  "width", "height", "min-width", "min-height", "max-width", "max-height", "aspect-ratio",
  "margin-top", "margin-right", "margin-bottom", "margin-left",
  "padding-top", "padding-right", "padding-bottom", "padding-left",
  "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing", "color", "text-align", "text-decoration-line", "text-underline-offset", "-webkit-font-smoothing",
  "background-color", "background-image", "background-size", "background-position", "background-repeat",
  "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
  "border-top-style", "border-right-style", "border-bottom-style", "border-left-style",
  "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
  "border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius",
  "box-shadow", "opacity", "filter", "transform", "clip-path", "overflow-x", "overflow-y", "visibility",
  "flex-direction", "flex-wrap", "justify-content", "align-items", "align-self", "flex-grow", "flex-shrink", "flex-basis", "row-gap", "column-gap",
  "grid-template-columns", "grid-template-rows", "grid-column-start", "grid-column-end", "grid-row-start", "grid-row-end",
  "list-style-type", "list-style-position", "object-fit", "object-position", "vertical-align", "color-scheme",
  "transition-property", "transition-duration", "transition-timing-function", "transition-delay",
] as const;

export interface MeasuredElement {
  key: string;
  tag: string;
  rect: { x: number; y: number; width: number; height: number };
  style: Record<string, string>;
}

/** One entry per printed element, in document (pre-)order — how export DOM elements map back to editor nodes. */
export function exportElementKeys(root: ExportElement): string[] {
  const keys: string[] = [];
  const visit = (element: ExportElement) => {
    keys.push(element.styleKey.endsWith("-media") ? `${element.sourceNodeId}#media` : /-shape-\d+$/.test(element.styleKey) ? `${element.sourceNodeId}#${element.styleKey.replace(/^.*-shape-/, "shape-")}` : element.sourceNodeId);
    for (const child of element.children) if (child.kind === "element") visit(child);
  };
  visit(root);
  return keys;
}

/** Measures every document node on the Canvas (plus inner media and SVG shapes), relative to the page root. */
export function measureCanvas(page: Page): Promise<MeasuredElement[]> {
  return page.evaluate((properties) => {
    const root = document.querySelector('[data-document-surface] [data-node-id="page-root"]');
    if (!root) throw new Error("canvas page root not found");
    const origin = root.getBoundingClientRect();
    // Colors compare by what they paint: the app's CSS build rewrites theme
    // oklch() colors to equivalent lab() values, export keeps oklch().
    const paint = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    const painted = (value: string) => {
      if (!paint) return value;
      paint.clearRect(0, 0, 1, 1);
      paint.fillStyle = "#000";
      paint.fillStyle = value;
      paint.fillRect(0, 0, 1, 1);
      return `rgba(${Array.from(paint.getImageData(0, 0, 1, 1).data).join(", ")})`;
    };
    const read = (computed: CSSStyleDeclaration, property: string) => {
      const value = computed.getPropertyValue(property);
      return /(^|-)color$/.test(property) ? painted(value) : value;
    };
    const measure = (element: Element, key: string) => {
      const rect = element.getBoundingClientRect();
      const computed = getComputedStyle(element);
      const style: Record<string, string> = {};
      for (const property of properties) style[property] = read(computed, property);
      return { key, tag: element.tagName.toLowerCase(), rect: { x: rect.x - origin.x, y: rect.y - origin.y, width: rect.width, height: rect.height }, style };
    };
    const measured = [];
    for (const element of [root, ...Array.from(root.querySelectorAll("[data-node-id]"))]) {
      const nodeId = element.getAttribute("data-node-id") ?? "";
      measured.push(measure(element, nodeId));
      const type = element.getAttribute("data-node-type");
      if (type === "img" || type === "video" || type === "audio" || type === "iframe") {
        const inner = element.firstElementChild;
        if (inner && inner.tagName.toLowerCase() === type) measured.push(measure(inner, `${nodeId}#media`));
      }
      if (type === "svg") Array.from(element.children).forEach((shape, index) => measured.push(measure(shape, `${nodeId}#shape-${index}`)));
    }
    return measured;
  }, [...COMPARED_PROPERTIES]);
}

/** Measures the exported page, mapping its elements (in document order) onto the IR's keys. */
export function measureExport(page: Page, keys: string[]): Promise<MeasuredElement[]> {
  return page.evaluate(
    ([properties, elementKeys]) => {
      const root = document.body.firstElementChild;
      if (!root) throw new Error("export page root not found");
      const elements = [root, ...Array.from(root.querySelectorAll("*"))];
      if (elements.length !== elementKeys.length) throw new Error(`export DOM has ${elements.length} elements, IR has ${elementKeys.length}`);
      const origin = root.getBoundingClientRect();
      // Colors compare by what they paint: the app's CSS build rewrites theme
      // oklch() colors to equivalent lab() values, export keeps oklch().
      const paint = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
      const painted = (value: string) => {
        if (!paint) return value;
        paint.clearRect(0, 0, 1, 1);
        paint.fillStyle = "#000";
        paint.fillStyle = value;
        paint.fillRect(0, 0, 1, 1);
        return `rgba(${Array.from(paint.getImageData(0, 0, 1, 1).data).join(", ")})`;
      };
      const read = (computed: CSSStyleDeclaration, property: string) => {
        const value = computed.getPropertyValue(property);
        return /(^|-)color$/.test(property) ? painted(value) : value;
      };
      return elements.map((element, index) => {
        const rect = element.getBoundingClientRect();
        const computed = getComputedStyle(element);
        const style: Record<string, string> = {};
        for (const property of properties) style[property] = read(computed, property);
        return { key: elementKeys[index], tag: element.tagName.toLowerCase(), rect: { x: rect.x - origin.x, y: rect.y - origin.y, width: rect.width, height: rect.height }, style };
      });
    },
    [[...COMPARED_PROPERTIES], keys] as const,
  );
}

/** Drops the transparent zero-size layers Tailwind's shadow utilities compose in, which paint nothing. */
function normalizeStyleValue(property: string, value: string): string {
  if (property !== "box-shadow") return value;
  const layers = value.split(/,(?![^(]*\))/).map((layer) => layer.trim()).filter((layer) => layer !== "rgba(0, 0, 0, 0) 0px 0px 0px 0px");
  return layers.length > 0 ? layers.join(", ") : "none";
}

export interface ParityDifference {
  key: string;
  property: string;
  canvas: string;
  exported: string;
}

export function compareMeasurements(canvas: MeasuredElement[], exported: MeasuredElement[], geometryTolerance = 0.5): { compared: number; propertyChecks: number; differences: ParityDifference[]; maxGeometryDelta: number } {
  const exportedByKey = new Map(exported.map((element) => [element.key, element]));
  const differences: ParityDifference[] = [];
  let maxGeometryDelta = 0;
  let propertyChecks = 0;
  for (const element of canvas) {
    const match = exportedByKey.get(element.key);
    if (!match) {
      differences.push({ key: element.key, property: "(element)", canvas: element.tag, exported: "missing" });
      continue;
    }
    if (element.tag !== match.tag) differences.push({ key: element.key, property: "(tag)", canvas: element.tag, exported: match.tag });
    // An element with no layout box (an <option> inside a closed <select>)
    // reports an all-zero rect at the viewport origin; there is no geometry to compare.
    const hasNoBox = (rect: MeasuredElement["rect"]) => rect.width === 0 && rect.height === 0;
    if (!(hasNoBox(element.rect) && hasNoBox(match.rect))) for (const axis of ["x", "y", "width", "height"] as const) {
      const delta = Math.abs(element.rect[axis] - match.rect[axis]);
      maxGeometryDelta = Math.max(maxGeometryDelta, delta);
      if (delta > geometryTolerance) differences.push({ key: element.key, property: `rect.${axis}`, canvas: element.rect[axis].toFixed(2), exported: match.rect[axis].toFixed(2) });
    }
    for (const property of Object.keys(element.style)) {
      propertyChecks++;
      const a = normalizeStyleValue(property, element.style[property]);
      const b = normalizeStyleValue(property, match.style[property]);
      if (a !== b) differences.push({ key: element.key, property, canvas: a, exported: b });
    }
  }
  return { compared: canvas.length, propertyChecks, differences, maxGeometryDelta };
}

export interface PixelComparison {
  width: number;
  height: number;
  sameSize: boolean;
  /** Share of pixels that are bit-for-bit identical. */
  exactSimilarity: number;
  /** Share of pixels whose largest channel difference is at most 8/255 (sub-pixel anti-aliasing noise). */
  tolerantSimilarity: number;
  differingPixels: number;
  diffPng: string;
}

/** Pixel-compares two PNG screenshots inside a browser page and renders a diff image (differences in red). */
export function comparePngs(page: Page, canvasPng: Buffer, exportPng: Buffer): Promise<PixelComparison> {
  return page.evaluate(
    async ([a, b]) => {
      const load = (base64: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = reject;
          image.src = `data:image/png;base64,${base64}`;
        });
      const [first, second] = await Promise.all([load(a), load(b)]);
      const width = Math.max(first.width, second.width);
      const height = Math.max(first.height, second.height);
      const pixels = (image: HTMLImageElement) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("no 2d context");
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, width, height).data;
      };
      const pa = pixels(first);
      const pb = pixels(second);
      const diff = document.createElement("canvas");
      diff.width = width;
      diff.height = height;
      const diffContext = diff.getContext("2d");
      if (!diffContext) throw new Error("no 2d context");
      const diffImage = diffContext.createImageData(width, height);
      let exact = 0;
      let tolerant = 0;
      for (let index = 0; index < pa.length; index += 4) {
        const delta = Math.max(Math.abs(pa[index] - pb[index]), Math.abs(pa[index + 1] - pb[index + 1]), Math.abs(pa[index + 2] - pb[index + 2]), Math.abs(pa[index + 3] - pb[index + 3]));
        if (delta === 0) exact++;
        if (delta <= 8) tolerant++;
        const gray = (pa[index] + pa[index + 1] + pa[index + 2]) / 3;
        // Red: beyond anti-aliasing tolerance. Orange: a sub-tolerance (1–8/255) difference.
        diffImage.data.set(delta > 8 ? [255, 0, 0, 255] : delta > 0 ? [255, 160, 0, 255] : [gray, gray, gray, 64], index);
      }
      diffContext.putImageData(diffImage, 0, 0);
      const total = width * height;
      return {
        width,
        height,
        sameSize: first.width === second.width && first.height === second.height,
        exactSimilarity: exact / total,
        tolerantSimilarity: tolerant / total,
        differingPixels: total - tolerant,
        diffPng: diff.toDataURL("image/png").replace(/^data:image\/png;base64,/, ""),
      };
    },
    [canvasPng.toString("base64"), exportPng.toString("base64")] as const,
  );
}
