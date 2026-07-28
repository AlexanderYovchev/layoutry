import type { ComponentType, ReactNode } from "react";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { ContainerLayoutMode } from "@/features/editor/types/layout";
import type { FlowDisplayMode } from "@/features/editor/types/flowLayout";

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
  /**
   * The parent's own resolved flowLayout.display (Checkpoint 3.5) —
   * decides whether this node also gets flex-item/grid-item CSS via
   * resolveFlexOrGridChildStyle. Meaningless (but still passed, always
   * "block") while parentLayoutMode is "free", since Free's own
   * absolute-positioning model has no Flex/Grid placement concept.
   */
  parentFlowDisplay: FlowDisplayMode;
  /** Already-rendered child nodes, recursively produced by DocumentNodeRenderer. */
  children?: ReactNode;
}

/** A component that knows how to present one document node type. Registered in documentNodeComponents by tag. */
export type DocumentElementComponent = ComponentType<DocumentElementProps>;
