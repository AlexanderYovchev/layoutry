import type { ComponentType, ReactNode } from "react";
import type { EditorElementNode } from "@/features/editor/types/document";

export interface DocumentElementProps {
  node: EditorElementNode;
  /** Id of the node's parent, or null for the document root. */
  parentId: string | null;
  /** Already-rendered child nodes, recursively produced by DocumentNodeRenderer. */
  children?: ReactNode;
}

/** A component that knows how to present one document node type. Registered in documentNodeComponents by tag. */
export type DocumentElementComponent = ComponentType<DocumentElementProps>;
