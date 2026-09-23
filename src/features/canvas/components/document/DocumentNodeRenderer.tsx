import { documentNodeComponents } from "@/features/canvas/components/document/documentNodeComponents";
import { FallbackElement } from "@/features/canvas/components/document/elements/FallbackElement";
import { getLayoutMode } from "@/features/editor/types/layout";
import { getFlowLayoutSettings } from "@/features/editor/types/flowLayout";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { ContainerLayoutMode } from "@/features/editor/types/layout";
import type { FlowDisplayMode } from "@/features/editor/types/flowLayout";

interface DocumentNodeRendererProps {
  node: EditorElementNode;
  /** Id of node's parent, or null when node is the document root. */
  parentId: string | null;
  /** node's own parent's layoutMode — see DocumentElementProps.parentLayoutMode. "flow" for the document root. */
  parentLayoutMode: ContainerLayoutMode;
  /** node's own parent's resolved flowLayout.display — see DocumentElementProps.parentFlowDisplay. "block" for the document root. */
  parentFlowDisplay: FlowDisplayMode;
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
  parentFlowDisplay,
}: DocumentNodeRendererProps) {
  // Runtime visibility override (Checkpoint 1.15.6.8, Part D/section 18) —
  // Preview-only, ephemeral, never touches this node's own authored
  // flowLayout/display: a node explicitly hidden via an authored click
  // interaction simply isn't rendered for this pass at all (its authored
  // CSS is never read back as "none" and is never mutated), which also
  // means its siblings reflow to fill the gap exactly like a real
  // collapsed panel would. In Design mode this override is always
  // ignored — `runtimeHidden` only has a chance to be true once
  // editorMode is "preview" (see enterPreview, which always resets
  // runtimeVisibility to {} first, and every other lookup below).
  const isRuntimeHidden = useEditorStore(
    (state) => state.editorMode === "preview" && state.runtimeVisibility[node.id] === false,
  );
  const ElementComponent = documentNodeComponents[node.tag] ?? FallbackElement;

  if (isRuntimeHidden) return null;
  const childLayoutMode = getLayoutMode(node);
  // A Free container's flowLayout is deliberately RETAINED (not cleared)
  // across a Flow -> Free conversion, so switching back to Flow restores
  // whatever Flex/Grid configuration was there before (see
  // layoutCommands.ts / useConvertContainerToFreeLayout.ts). That's
  // correct for the container's OWN future Flow settings, but it means a
  // stale flowLayout.display of "flex"/"grid" must never reach this
  // container's actual Free children as their parentFlowDisplay — Free
  // children are positioned purely via freeLayout (see freeChildStyle),
  // and resolveFlexOrGridChildStyle has no concept of "free": passing it
  // a leftover "grid" would force width/height to 100% on an absolutely
  // positioned Free child, corrupting its authored geometry the moment a
  // Grid/Flex container is switched to Free (Checkpoint 1.15.6.1,
  // "Child Containment" — a real bug found during that checkpoint's own
  // architecture audit, not a hypothetical). "block" is always inert for
  // a Free parent's children (resolveFlexOrGridChildStyle only ever acts
  // on "flex"/"grid"), so it's the correct value to force here regardless
  // of what the container's own retained flowLayout says.
  const childFlowDisplay = childLayoutMode === "free" ? "block" : getFlowLayoutSettings(node).display;

  const children = (node.children ?? []).map((child) => (
    <DocumentNodeRenderer
      key={child.id}
      node={child}
      parentId={node.id}
      parentLayoutMode={childLayoutMode}
      parentFlowDisplay={childFlowDisplay}
    />
  ));

  return (
    <ElementComponent
      node={node}
      parentId={parentId}
      parentLayoutMode={parentLayoutMode}
      parentFlowDisplay={parentFlowDisplay}
    >
      {children}
    </ElementComponent>
  );
}
