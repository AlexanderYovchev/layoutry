import { fixtureDocument } from "@/features/editor/fixtureDocument";
import {
  createElementNode,
  INSERTABLE_ELEMENT_TYPES,
} from "@/features/editor/factories/elementFactories";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Test documents for the project feature, built from the editor's own
 * factories and fixture wherever possible (no invented features). Shared by
 * the serialization, loading and round-trip tests.
 */

export function pageWith(...children: EditorElementNode[]): EditorElementNode {
  return { id: "page-root", tag: "page", children };
}

/** One instance of every insertable element/composition the editor can create. */
export function everyFactoryDocument(): EditorElementNode {
  return pageWith(
    ...INSERTABLE_ELEMENT_TYPES.map((type) => createElementNode(type)),
  );
}

/** A container chain `depth` elements deep, root included. */
export function nestedDocument(depth: number): EditorElementNode {
  let node: EditorElementNode = { id: `div-${depth}`, tag: "div" };
  for (let level = depth - 1; level >= 2; level -= 1) {
    node = { id: `div-${level}`, tag: "div", children: [node] };
  }
  return pageWith(node);
}

/** A node using every authored field family the editor supports. */
export function kitchenSinkNode(): EditorElementNode {
  return {
    id: "div-sink",
    tag: "div",
    displayName: "Everything",
    dimensions: {
      preferredWidth: 320,
      preferredHeight: 200,
      offsetX: 4,
      offsetY: -2,
    },
    layoutMode: "free",
    childResizePolicy: "scale",
    aspectRatioLocked: true,
    flowLayout: {
      display: "flex",
      flex: {
        direction: "column",
        wrap: "wrap",
        justifyContent: "space-between",
        alignItems: "center",
        alignContent: "stretch",
        rowGap: 8,
        columnGap: 12,
      },
      grid: { columns: 3, rows: "auto", rowGap: 16, columnGap: 16 },
    },
    spacing: {
      margin: { top: 1, right: 2, bottom: 3, left: 4 },
      padding: { top: 5, right: 6, bottom: 7, left: 8 },
    },
    typography: {
      fontFamily: "Georgia, serif",
      fontSize: { value: 1.25, unit: "rem" },
      fontWeight: 700,
      fontStyle: "italic",
      color: "#ff0000",
      textAlign: "justify",
      lineHeight: { value: 1.5, unit: "unitless" },
      letterSpacing: { value: 0.5, unit: "px" },
      textDecorationLine: "underline",
    },
    background: {
      color: "rgba(0, 0, 0, 0.5)",
      sourceType: "gradient",
      image: "https://example.com/hero.jpg",
      size: "custom",
      customSize: { width: { value: 50, unit: "%" }, height: "auto" },
      position: "bottom-right",
      repeat: "repeat-x",
      attachment: "fixed",
      gradient: {
        type: "radial",
        shape: "circle",
        position: "center",
        stops: [
          { id: "stop-a", color: "#000000", position: 0 },
          { id: "stop-b", color: "#ffffff", position: 100 },
        ],
      },
    },
    border: {
      top: {
        width: { value: 2, unit: "px" },
        style: "dashed",
        color: "#333333",
      },
      left: { style: "none" },
    },
    borderRadius: {
      topLeft: { value: 8, unit: "px" },
      bottomRight: { value: 50, unit: "%" },
    },
    shape: "hexagon",
    boxShadow: [
      {
        id: "shadow-a",
        enabled: true,
        inset: false,
        offsetX: { value: 0, unit: "px" },
        offsetY: { value: 4, unit: "px" },
        blur: { value: 8, unit: "px" },
        spread: { value: 0, unit: "px" },
        color: "rgba(0, 0, 0, 0.25)",
      },
      { id: "shadow-b", enabled: false, inset: true },
    ],
    filters: {
      opacity: 80,
      blur: { value: 2, unit: "px" },
      brightness: 110,
      contrast: 90,
      saturate: 120,
      grayscale: 10,
      hueRotate: 45,
      invert: 0,
      sepia: 5,
    },
    display: {
      display: "inline-block",
      visibility: "visible",
      overflowX: "hidden",
      overflowY: "auto",
      pointerEvents: "auto",
      cursor: "pointer",
      userSelect: "none",
    },
    position: {
      position: "relative",
      top: { value: 10, unit: "px" },
      left: "auto",
      zIndex: 5,
    },
    aspectRatio: { mode: "ratio", width: 16, height: 9 },
    sizeConstraints: {
      minWidth: 100,
      maxWidth: 800,
      minHeight: 50,
      maxHeight: 600,
    },
    htmlId: "hero",
    className: "hero-section featured",
    lockChildStyles: true,
    initialPreviewVisibility: "hidden",
    transition: {
      property: "background-color",
      durationMs: 300,
      timingFunction: "ease-in-out",
      delayMs: 50,
    },
    transform: { translateX: 10, translateY: -5, rotateDeg: 360, scale: -1 },
    interactions: [
      {
        id: "interaction-a",
        trigger: "click",
        action: "toggle",
        targetId: "img-sink",
      },
    ],
    children: [
      {
        id: "img-sink",
        tag: "img",
        src: "https://example.com/photo.png",
        title: "Photo",
        freeLayout: { x: 10, y: 20, width: 100, height: 80 },
        mediaFit: {
          objectFit: "cover",
          objectPositionX: { value: 25, unit: "%" },
          objectPositionY: { value: 75, unit: "%" },
        },
        flexChild: { grow: 1, shrink: 0, basis: 120, alignSelf: "end" },
        gridChild: {
          columnStart: 2,
          columnSpan: 2,
          rowStart: "auto",
          rowSpan: 1,
        },
      },
      {
        id: "video-sink",
        tag: "video",
        src: "clip.mp4",
        poster: "poster.jpg",
        controls: true,
        autoplay: false,
        muted: true,
        loop: true,
      },
      {
        id: "input-sink",
        tag: "input",
        inputType: "email",
        name: "email",
        placeholder: "you@example.com",
        value: "a@b.c",
        checked: false,
      },
      {
        id: "select-sink",
        tag: "select",
        children: [
          {
            id: "option-sink",
            tag: "option",
            text: "One",
            value: "1",
            selected: true,
          },
        ],
      },
      {
        id: "progress-sink",
        tag: "progress",
        progressValue: 30,
        progressMax: 100,
      },
      { id: "a-sink", tag: "a", href: "https://example.com", text: "Link" },
      {
        id: "svg-sink",
        tag: "svg",
        svgKind: "star",
        svgViewBox: { minX: 0, minY: 0, width: 100, height: 100 },
        svgFill: "#3b82f6",
        svgStroke: "#000000",
        svgStrokeWidth: 2,
        svgScene: {
          objects: [
            {
              id: "rect-1",
              type: "rect",
              x: 0,
              y: 0,
              width: 10,
              height: 10,
              fill: "#ff0000",
            },
            { id: "ellipse-1", type: "ellipse", cx: 5, cy: 5, rx: 3, ry: 2 },
            {
              id: "line-1",
              type: "line",
              x1: 0,
              y1: 0,
              x2: 10,
              y2: 10,
              stroke: "#000000",
              strokeWidth: 1,
            },
            {
              id: "polygon-1",
              type: "polygon",
              points: [
                { x: 0, y: 0 },
                { x: 5, y: 10 },
                { x: 10, y: 0 },
              ],
            },
            {
              id: "path-1",
              type: "path",
              commands: [
                { kind: "M", x: 0, y: 0 },
                { kind: "L", x: 4, y: 4 },
                { kind: "Z" },
              ],
            },
          ],
        },
      },
    ],
  };
}

export { fixtureDocument };
