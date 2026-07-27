import { generateNodeId } from "@/features/editor/utils/generateNodeId";
import type { EditorElementNode } from "@/features/editor/types/document";

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
  return { id: generateNodeId("div"), tag: "div", children: [] };
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

export function createImageNode(): EditorElementNode {
  return { id: generateNodeId("img"), tag: "img" };
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
