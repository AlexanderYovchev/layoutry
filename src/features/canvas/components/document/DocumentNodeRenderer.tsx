import { documentNodeComponents } from "@/features/canvas/components/document/documentNodeComponents";
import { FallbackElement } from "@/features/canvas/components/document/elements/FallbackElement";
import { getLayoutMode } from "@/features/editor/types/layout";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { ContainerLayoutMode } from "@/features/editor/types/layout";

interface DocumentNodeRendererProps {
  node: EditorElementNode;
  /** Id of node's parent, or null when node is the document root. */
  parentId: string | null;
  /** node's own parent's layoutMode — see DocumentElementProps.parentLayoutMode. "flow" for the document root. */
  parentLayoutMode: ContainerLayoutMode;
}

/**
 * Recursively renders one document node and its descendants. This is the
 * only place that walks EditorElementNode.children — element components
 * stay dumb, receiving their already-rendered children as a prop instead
 * of recursing themselves, which keeps the dispatch registry and the
 * element components free of circular imports.
 */
export function DocumentNodeRenderer({
  node,
  parentId,
  parentLayoutMode,
}: DocumentNodeRendererProps) {
  const ElementComponent = documentNodeComponents[node.tag] ?? FallbackElement;
  const childLayoutMode = getLayoutMode(node);

  const children = (node.children ?? []).map((child) => (
    <DocumentNodeRenderer
      key={child.id}
      node={child}
      parentId={node.id}
      parentLayoutMode={childLayoutMode}
    />
  ));

  return (
    <ElementComponent node={node} parentId={parentId} parentLayoutMode={parentLayoutMode}>
      {children}
    </ElementComponent>
  );
}
