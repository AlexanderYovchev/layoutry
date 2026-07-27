import type { ComponentType, ReactNode } from "react";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { ContainerLayoutMode } from "@/features/editor/types/layout";

export interface DocumentElementProps {
  node: EditorElementNode;
  /** Id of the node's parent, or null for the document root. */
  parentId: string | null;
  /**
   * The parent's own layoutMode ("flow" | "free") — decides whether this
   * node positions itself via elementDimensionsStyle (Flow) or
   * freeChildStyle (Free); see elementPositionStyle. "flow" for the
   * document root, which has no parent of its own.
   */
  parentLayoutMode: ContainerLayoutMode;
  /** Already-rendered child nodes, recursively produced by DocumentNodeRenderer. */
  children?: ReactNode;
}

/** A component that knows how to present one document node type. Registered in documentNodeComponents by tag. */
export type DocumentElementComponent = ComponentType<DocumentElementProps>;
