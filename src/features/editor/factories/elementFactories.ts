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
