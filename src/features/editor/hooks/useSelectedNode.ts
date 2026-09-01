import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { findNodeById, findParentId } from "@/features/editor/utils/findNodeById";
import { collectNodeIds } from "@/features/editor/utils/collectNodeIds";
import { getLayoutMode } from "@/features/editor/types/layout";
import { getFlowLayoutSettings } from "@/features/editor/types/flowLayout";
import { normalizeSelection } from "@/features/editor/types/selection";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { ContainerLayoutMode } from "@/features/editor/types/layout";
import type { FlowDisplayMode } from "@/features/editor/types/flowLayout";

export interface SelectedNode {
  node: EditorElementNode;
  parentId: string | null;
  /** The selected node's own parent's layoutMode — "flow" when there is no parent (the document root is selected) or the parent has none set. Drives both the Canvas resize/move session choice and the Inspector's Free geometry fields. */
  parentLayoutMode: ContainerLayoutMode;
  /** The selected node's own parent's resolved flowLayout.display (Checkpoint 3.5) — "block" when there is no parent or the parent has none set. Drives the Inspector's Flex/Grid child sections. */
  parentFlowDisplay: FlowDisplayMode;
}

function resolveSelectedNode(documentModel: EditorElementNode, id: string): SelectedNode | null {
  const node = findNodeById(documentModel, id);
  if (!node) return null;

  const parentId = findParentId(documentModel, id);
  const parentNode = parentId ? findNodeById(documentModel, parentId) : undefined;

  return {
    node,
    parentId,
    parentLayoutMode: parentNode ? getLayoutMode(parentNode) : "flow",
    parentFlowDisplay: parentNode ? getFlowLayoutSettings(parentNode).display : "block",
  };
}

/**
 * Resolves the shared selection's PRIMARY id against the current
 * document — unchanged single-node contract this hook has had since
 * before Checkpoint 1.15.2 (every existing single-selection consumer —
 * Canvas drag/resize sessions, the single-selection Inspector view,
 * CanvasOverlay's primary handles — keeps working through this exact
 * function, now backed by `selection.primaryId` instead of the old
 * `selectedElementId`). Fails safely to null both when nothing is
 * selected and when the primary id no longer resolves in the document,
 * rather than throwing. See useSelectedNodes for the full multi-selection
 * list.
 */
export function useSelectedNode(): SelectedNode | null {
  const documentModel = useEditorStore((state) => state.document);
  const primaryId = useEditorStore((state) => state.selection.primaryId);

  if (!primaryId) return null;
  return resolveSelectedNode(documentModel, primaryId);
}

export interface SelectedNodesResult {
  /** Every currently-selected node that still resolves in the document, in selection order — a stale id (deleted, undone-away, ...) is silently dropped here rather than surfacing to any consumer (Checkpoint 1.15.2, Part 18). */
  nodes: SelectedNode[];
  /** Same as useSelectedNode()'s own result — the primary among `nodes`, or null if the primary itself no longer resolves (falls back to the last remaining resolved node, matching normalizeSelection's own reassignment rule). */
  primary: SelectedNode | null;
}

/**
 * The multi-selection counterpart to useSelectedNode (Checkpoint 1.15.2)
 * — CanvasOverlay (all selected outlines), the Structure tree (all
 * selected rows), and InspectorContent (the multi-selection Inspector
 * view) all read this one hook rather than each re-deriving "which
 * selected ids still exist" independently. Reconciliation happens here,
 * at read time, via normalizeSelection — nothing upstream (delete, undo,
 * redo, a list/select/table count shrink, ...) needs its own "does this
 * id still exist" check.
 */
export function useSelectedNodes(): SelectedNodesResult {
  const documentModel = useEditorStore((state) => state.document);
  const selection = useEditorStore((state) => state.selection);

  const existingIds = collectNodeIds(documentModel);
  const resolved = normalizeSelection(selection, existingIds);

  const nodes = resolved.ids
    .map((id) => resolveSelectedNode(documentModel, id))
    .filter((entry): entry is SelectedNode => entry !== null);

  const primary = resolved.primaryId ? (nodes.find((entry) => entry.node.id === resolved.primaryId) ?? null) : null;

  return { nodes, primary };
}
