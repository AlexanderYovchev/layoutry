import { generateNodeId } from "@/features/editor/utils/generateNodeId";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { ElementSpacing } from "@/features/editor/types/spacing";

/** Checkpoint 3.5's stated default for a newly created container: Block display, 16px padding on every side, zero margin. */
const DEFAULT_CONTAINER_SPACING: ElementSpacing = {
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
  padding: { top: 16, right: 16, bottom: 16, left: 16 },
};

/**
 * Every element type this checkpoint's insertion system can create.
 * Deliberately a plain string union owned by the editor feature — the
 * Creation Toolbar (components/layout, which must not import features)
 * mirrors these exact string values locally rather than importing this
 * type; see creationToolbarCategories.ts.
 */
export type InsertableElementType =
  | "container"
  | "heading"
  | "paragraph"
  | "button"
  | "image";

export function createContainerNode(): EditorElementNode {
  return {
    id: generateNodeId("div"),
    tag: "div",
    children: [],
    flowLayout: { display: "block" },
    spacing: DEFAULT_CONTAINER_SPACING,
  };
}

export function createHeadingNode(): EditorElementNode {
  return { id: generateNodeId("h1"), tag: "h1", text: "New Heading" };
}

export function createParagraphNode(): EditorElementNode {
  return { id: generateNodeId("p"), tag: "p", text: "New paragraph text." };
}

export function createButtonNode(): EditorElementNode {
  return { id: generateNodeId("button"), tag: "button", text: "Button" };
}

/**
 * A generic placeholder photo, not a real asset — this app has no image
 * upload/picker yet (out of scope for Checkpoint 3.5.1). An inline SVG
 * with explicit width/height gives the <img> a real, non-square intrinsic
 * aspect ratio (4:3), which is what actually makes object-fit meaningful:
 * a plain colored box has no "natural size" for object-fit to preserve.
 */
const DEFAULT_IMAGE_SRC =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">' +
      '<rect width="400" height="300" fill="#e4e4e7"/>' +
      '<path d="M0 230 L110 130 L190 190 L270 100 L400 230 V300 H0 Z" fill="#a1a1aa"/>' +
      '<circle cx="320" cy="70" r="28" fill="#a1a1aa"/>' +
      "</svg>",
  );

export function createImageNode(): EditorElementNode {
  return { id: generateNodeId("img"), tag: "img", src: DEFAULT_IMAGE_SRC };
}

const FACTORIES_BY_TYPE: Record<InsertableElementType, () => EditorElementNode> = {
  container: createContainerNode,
  heading: createHeadingNode,
  paragraph: createParagraphNode,
  button: createButtonNode,
  image: createImageNode,
};

/** Every element factory dispatches through here — the one place new insertable types get registered. */
export function createElementNode(type: InsertableElementType): EditorElementNode {
  return FACTORIES_BY_TYPE[type]();
}

export function isInsertableElementType(value: string): value is InsertableElementType {
  return value in FACTORIES_BY_TYPE;
}

/**
 * A freshly created node has no dimensions at all — it sizes itself
 * naturally in Flow. A Free container has no such thing as "size itself
 * naturally" (every direct child needs an explicit width/height), so
 * insertion into a Free parent (see useInsertElement) and clipboard
 * placement into a Free parent (see resolveClonePlacementForFreeParent in
 * useEditorStore) both need a reasonable starting size per element type.
 */
const DEFAULT_FREE_ELEMENT_SIZE: Record<InsertableElementType, { width: number; height: number }> = {
  container: { width: 200, height: 150 },
  heading: { width: 240, height: 48 },
  paragraph: { width: 240, height: 80 },
  button: { width: 120, height: 40 },
  image: { width: 200, height: 150 },
};

const DEFAULT_FREE_SIZE_FALLBACK = { width: 160, height: 120 };

/** Reverse of FACTORIES_BY_TYPE's tag choice, for resolving a default size from a tag alone (see getDefaultFreeElementSize). */
const INSERTABLE_TYPE_BY_TAG: Record<string, InsertableElementType> = {
  div: "container",
  h1: "heading",
  p: "paragraph",
  button: "button",
  img: "image",
};

/** Falls back to a generic size for a tag with no InsertableElementType entry (e.g. a pasted/duplicated node whose tag isn't one of the five catalog types). */
export function getDefaultFreeElementSize(tag: string): { width: number; height: number } {
  const type = INSERTABLE_TYPE_BY_TAG[tag];
  return type ? DEFAULT_FREE_ELEMENT_SIZE[type] : DEFAULT_FREE_SIZE_FALLBACK;
}
